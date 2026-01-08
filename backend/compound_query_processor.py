from __future__ import annotations

import numpy as np
from numpy.typing import NDArray
from typing import List, Literal, Optional, Union

from pydantic import BaseModel

from utilities import get_cropped_image, sigmoid, decode_data_url, decode_audio_url

# --------------------- Pydantic models ---------------------
class CropQuery(BaseModel):
    current_index: int
    crop_box: List[float]

class ImageQuery(BaseModel):
    image_data: str

class AudioQuery(BaseModel):
    audio_data: str

class QueryUnit(BaseModel):
    text_query: Optional[str] = None
    image_query: Optional[ImageQuery] = None
    crop_query: Optional[CropQuery] = None
    audio_query: Optional[AudioQuery] = None
    logic: Optional[str] = None  # could be OR, AND, NOT, etc.

# --------------------- Expression Tree ---------------------
class ExprNode:
    def __init__(self, op: str, children: list):
        self.op = op
        self.children = children


# --------------------- Main processor ----------------------
class CompoundQueryProcessor:
    model: any
    video_path: str
    FPS: int
    video_embeddings: NDArray[np.float32 | np.float16]

    def __init__(self, vit_model: any, video_path: str = "", FPS: int = 10) -> None:
        self.model = vit_model
        self.video_path = video_path
        self.FPS = FPS

        if self.model.video_embeddings is None:
            self.model.video_embeddings = self.model.get_video_features()

        self.video_embeddings = self.model.video_embeddings  # (n_frames, D)

    # ---------------- embedding helpers ---------------------
    def get_query_embedding(self, q: QueryUnit) -> NDArray:
        if q.text_query:
            return self.model.get_text_features(texts=[q.text_query])

        if q.image_query:
            img = decode_data_url(q.image_query.image_data)
            return self.model.get_image_features(images=[img])
        
        if q.crop_query:
            crop = q.crop_query
            crop_box = [int(v) for v in crop.crop_box]
            crop_img = get_cropped_image(self.video_path, crop_box, crop.current_index, self.FPS)
            return self.model.get_image_features(images=[crop_img])

        if q.audio_query:
            audio = decode_audio_url(q.audio_query.audio_data)
            return self.model.get_audio_features(audios=[audio])
        raise ValueError("QueryUnit has no valid query field")

    # ---------------- geometric operators ---------------------
    def union_vec(self, a: NDArray, b: NDArray) -> NDArray:
        return np.stack([a.reshape(-1), b.reshape(-1)], axis=1)  # d×2

    def intersection_vec(self, a: NDArray, b: NDArray) -> NDArray:
        bis = a.reshape(-1) + b.reshape(-1)
        n = np.linalg.norm(bis)
        return bis / n if n > 0 else bis

    def negate_score(self, s: NDArray) -> NDArray:
        return np.sqrt(np.maximum(0.0, 1 - s**2))

    # ---------------- evaluation primitives ---------------------
    def eval_span(self, span: NDArray, V: NDArray) -> NDArray:
        pinv = np.linalg.pinv(span)               # 2×d
        proj = V @ pinv.T                         # (T,2)
        recon = proj @ span.T                     # (T,d)
        return np.linalg.norm(recon, axis=1) / np.linalg.norm(V, axis=1)

    def eval_vec(self, vec: NDArray, V: NDArray) -> NDArray:
        v = vec.reshape(1, -1)
        cos = self.model.cosine_similarity(V, v)  # (T,)
        return cos

    # ---------------- parse flat sequence into expression tree ---------------------
    def build_expr_tree(self, queries: List[QueryUnit]) -> ExprNode:
        """
        Builds an expression tree from an *infix* sequence like:
        [A, OR, B, AND, C]
        using operator precedence: NOT > AND > OR / WO
        This is a classic shunting-yard style parser.
        """
        output: List[ExprNode] = []
        ops: List[str] = []

        def apply_op():
            op = ops.pop()
            if op == "NOT":
                child = output.pop()
                output.append(ExprNode("NOT", [child]))
            else:
                right = output.pop()
                left = output.pop()
                output.append(ExprNode(op, [left, right]))

        for q in queries:
            if q.logic is None:
                output.append(ExprNode("leaf", [q]))
                continue

            op = q.logic.upper()

            if op == "(":
                ops.append(op)
                continue

            if op == ")":
                while ops and ops[-1] != "(":
                    apply_op()
                if not ops:
                    raise ValueError("Mismatched parentheses")
                ops.pop()  # remove "("
                continue

            # normal operator
            while (
                ops
                and ops[-1] != "("
                and precedence.get(ops[-1], 0) >= precedence.get(op, 0)
            ):
                apply_op()

            ops.append(op)

        while ops:
            if ops[-1] == "(":
                raise ValueError("Unclosed parenthesis")
            apply_op()

        if len(output) != 1:
            raise ValueError("Invalid expression")

        return output[0]

    # ---------------- recursively evaluate expression tree ---------------------

    def eval_tree(self, node: ExprNode, V: NDArray):
        if node.op == "leaf":
            emb = self.get_query_embedding(node.children[0])  # (1,d)
            return emb, self.eval_vec(emb, V)

        if node.op == "NOT":
            _, score = self.eval_tree(node.children[0], V)
            return None, self.negate_score(score)

        A_emb, A_score = self.eval_tree(node.children[0], V)
        B_emb, B_score = self.eval_tree(node.children[1], V)

        if A_emb is None or B_emb is None:
            raise ValueError("Logical operator cannot combine pure scalar nodes.")

        A_vec = A_emb.reshape(-1)
        B_vec = B_emb.reshape(-1)

        if node.op == "AND":
            I_vec = self.intersection_vec(A_vec, B_vec)
            score = self.eval_vec(I_vec, V)
            return I_vec.reshape(1, -1), score

        if node.op == "OR":
            U_span = self.union_vec(A_vec, B_vec)
            score = self.eval_span(U_span, V)
            return U_span, score

        if node.op in ("W/O", "WO"):
            score = A_score * (1 - B_score)
            weight_a = float(np.mean(A_score))
            weight_b = float(1 - np.mean(B_score))
            wsum = weight_a + weight_b if weight_a + weight_b > 0 else 1.0
            new_vec = ((weight_a * A_vec) + (weight_b * B_vec)) / wsum
            return new_vec.reshape(1, -1), score

        raise ValueError(f"Unknown operator {node.op}")

    # ---------------- main ---------------------
    def __call__(self, queries: List[QueryUnit]) -> List[float]:
        V = self.video_embeddings
        tree = self.build_expr_tree(queries)
        _, scores = self.eval_tree(tree, V)
        return scores.tolist()
