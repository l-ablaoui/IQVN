from __future__ import annotations

import numpy as np
from numpy.typing import NDArray
from typing import List, Optional
from abc import ABC, abstractmethod

from pydantic import BaseModel

from utilities import get_cropped_image, sigmoid, decode_data_url, decode_audio_url

# ---------- Query models ------------
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
    logic: Optional[str] = None

# ---------- Expression tree ----------
class ExprNode:
    def __init__(self, op: str, children: list):
        self.op = op
        self.children = children

precedence = {"NOT": 3, "AND": 2, "W/O": 2, "OR": 1}

# ---------- Algebra abstraction ----------
class AlgebraValue:
    def __init__(self, rep, score: NDArray):
        self.rep = rep        # vector, span, or None
        self.score = score    # (T,) timeline

class QueryAlgebra(ABC):
    def __init__(self, model):
        self.model = model

    @abstractmethod
    def leaf(self, emb: NDArray, V: NDArray) -> AlgebraValue:
        pass

    @abstractmethod
    def AND(self, A: AlgebraValue, B: AlgebraValue, V: NDArray) -> AlgebraValue:
        pass

    @abstractmethod
    def OR(self, A: AlgebraValue, B: AlgebraValue, V: NDArray) -> AlgebraValue:
        pass

    @abstractmethod
    def NOT(self, A: AlgebraValue, V: NDArray) -> AlgebraValue:
        pass

# ---------- Geometric algebra ----------
class GeometricAlgebra(QueryAlgebra):
    # --- vector ops ---
    def union_vec(self, a: NDArray, b: NDArray) -> NDArray:
        return np.stack([a.reshape(-1), b.reshape(-1)], axis=1)

    def intersection_vec(self, a: NDArray, b: NDArray) -> NDArray:
        v = a.reshape(-1) + b.reshape(-1)
        n = np.linalg.norm(v)
        return v / n if n > 0 else v

    def negate_score(self, s: NDArray) -> NDArray:
        return np.sqrt(np.maximum(0.0, 1 - s**2))

    # --- evaluators ---
    def eval_vec(self, vec: NDArray, V: NDArray) -> NDArray:
        return self.model.cosine_similarity(V, vec.reshape(1, -1))

    def eval_span(self, span: NDArray, V: NDArray) -> NDArray:
        pinv = np.linalg.pinv(span)
        proj = V @ pinv.T
        recon = proj @ span.T
        return np.linalg.norm(recon, axis=1) / np.linalg.norm(V, axis=1)

    # --- logic ---
    def leaf(self, emb: NDArray, V: NDArray) -> AlgebraValue:
        score = self.eval_vec(emb, V)
        return AlgebraValue(emb, score)

    def AND(self, A: AlgebraValue, B: AlgebraValue, V: NDArray) -> AlgebraValue:
        I = self.intersection_vec(A.rep, B.rep)
        score = self.eval_vec(I, V)
        return AlgebraValue(I.reshape(1, -1), score)

    def OR(self, A: AlgebraValue, B: AlgebraValue, V: NDArray) -> AlgebraValue:
        span = self.union_vec(A.rep, B.rep)
        score = self.eval_span(span, V)
        return AlgebraValue(span, score)

    def NOT(self, A: AlgebraValue, V: NDArray) -> AlgebraValue:
        return AlgebraValue(None, self.negate_score(A.score))

# ---------- Pseudo-probabilistic algebra ----------
class ProbabilisticAlgebra(QueryAlgebra):
    overlap_corrector: float

    def __init__(self, model, overlap_corrector: float = 0.5):
        super(ProbabilisticAlgebra, self).__init__(model)
        self.overlap_corrector = overlap_corrector

    def leaf(self, emb: NDArray, V: NDArray) -> AlgebraValue:
        score = sigmoid(self.model.cosine_similarity(V, emb))
        return AlgebraValue(None, score)

    def AND(self, A: AlgebraValue, B: AlgebraValue, V: NDArray) -> AlgebraValue:
        rho = float(np.mean(A.score * B.score))
        score = A.score * B.score * (1 - self.overlap_corrector * rho)
        return AlgebraValue(None, score)

    def OR(self, A: AlgebraValue, B: AlgebraValue, V: NDArray) -> AlgebraValue:
        inter = self.AND(A, B, V).score
        score = A.score + B.score - inter
        return AlgebraValue(None, score)

    def NOT(self, A: AlgebraValue, V: NDArray) -> AlgebraValue:
        return AlgebraValue(None, 1 - A.score)

# ---------- Processor ----------
class CompoundQueryProcessor:
    def __init__(self, model, video_path: str, FPS: int, algebra: QueryAlgebra):
        self.model = model
        self.video_path = video_path
        self.FPS = FPS
        self.algebra = algebra

        if self.model.video_embeddings is None:
            self.model.video_embeddings = self.model.get_video_features()
        
        if self.model.audio_embeddings is None:
            self.model.audio_embeddings, _ = self.model.get_audio_features()

    # --- embedding extraction ---
    def get_query_embedding(self, q: QueryUnit) -> NDArray:
        if q.text_query:
            _, t, _ = self.model.get_features(texts=[q.text_query])
            return t

        if q.image_query:
            img = decode_data_url(q.image_query.image_data)
            i, _, _ = self.model.get_features(images=[img])
            return i

        if q.crop_query:
            crop = q.crop_query
            img = get_cropped_image(self.video_path, crop.crop_box, crop.current_index, self.FPS)
            i, _, _ = self.model.get_features(images=[img])
            return i

        if q.audio_query:
            path = decode_audio_url(q.audio_query.audio_data)
            try:
                _, _, a = self.model.get_features(audios=[str(path)])
                return a
            finally:
                path.unlink(missing_ok=True)

        raise ValueError("Invalid QueryUnit")

    # --- parser ---
    def build_expr_tree(self, queries: List[QueryUnit]) -> ExprNode:
        output, ops = [], []

        def apply():
            op = ops.pop()
            if op == "NOT":
                c = output.pop()
                output.append(ExprNode(op, [c]))
            else:
                b, a = output.pop(), output.pop()
                output.append(ExprNode(op, [a, b]))

        for q in queries:
            if q.logic is None:
                output.append(ExprNode("leaf", [q]))
                continue

            op = q.logic.upper()
            while ops and precedence.get(ops[-1], 0) >= precedence.get(op, 0):
                apply()
            ops.append(op)

        while ops:
            apply()

        return output[0]

    # --- evaluation ---
    def eval_tree(self, node: ExprNode, embeddings: NDArray) -> AlgebraValue:
        if node.op == "leaf":
            emb = self.get_query_embedding(node.children[0])
            return self.algebra.leaf(emb, embeddings)

        if node.op == "NOT":
            A = self.eval_tree(node.children[0], embeddings)
            return self.algebra.NOT(A, embeddings)

        A = self.eval_tree(node.children[0], embeddings)
        B = self.eval_tree(node.children[1], embeddings)

        if node.op == "AND":
            return self.algebra.AND(A, B, embeddings)
        if node.op == "OR":
            return self.algebra.OR(A, B, embeddings)
        if node.op in ("W/O", "WO"):
            return self.algebra.AND(A, self.algebra.NOT(B, embeddings), embeddings)

        raise ValueError(node.op)

    def __call__(self, queries: List[QueryUnit]):
        # --- retrieve embeddings ---
        video_embeddings = self.model.video_embeddings  # (Tv, d)
        audio_embeddings = self.model.audio_embeddings  # (Ta, d)

        if audio_embeddings is None:
            # keep backward compatibility
            tree = self.build_expr_tree(queries)
            result = self.eval_tree(tree, video_embeddings)
            return result.score.tolist(), None

        # --- sanity checks ---
        if video_embeddings.shape[1] != audio_embeddings.shape[1]:
            raise ValueError(
                f"Embedding dim mismatch: "
                f"video {video_embeddings.shape}, audio {audio_embeddings.shape}"
            )

        Tv = video_embeddings.shape[0]
        Ta = audio_embeddings.shape[0]

        # --- concatenate timelines ---
        combined_embeddings = np.vstack([video_embeddings, audio_embeddings])
        print(combined_embeddings.shape)
        # shape: (Tv + Ta, d)

        # --- evaluate once ---
        tree = self.build_expr_tree(queries)
        result = self.eval_tree(tree, combined_embeddings)
        scores = result.score  # (Tv + Ta,)

        # --- split back ---
        video_scores = scores[:Tv].flatten().tolist()
        audio_scores = scores[Tv:].flatten().tolist()

        return video_scores, audio_scores
