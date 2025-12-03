from __future__ import annotations

import numpy as np
from numpy.typing import NDArray
from typing import List, Literal, Optional, Union

from pydantic import BaseModel

from utilities import get_cropped_image, sigmoid, decode_data_url

# --------------------- Pydantic models ---------------------
class CropQuery(BaseModel):
    current_index: int
    crop_box: List[float]

class ImageQuery(BaseModel):
    image_data: str

class QueryUnit(BaseModel):
    text_query: Optional[str] = None
    image_query: Optional[ImageQuery] = None
    crop_query: Optional[CropQuery] = None
    logic: Optional[Literal["AND", "OR", "W/O"]] = None

# --------------------- Main processor ----------------------
class CompoundQueryProcessor:
    """
    Evaluates ordered QueryUnit objects against video embeddings.
    """
    model: any
    video_path: str
    FPS: int
    overlap_corrector: float
    video_embeddings: NDArray[np.float32]

    def __init__(self, vit_model: any, video_path: str = "", FPS: int = 10) -> None:
        self.model = vit_model
        self.video_path = video_path
        self.FPS = FPS
        self.overlap_corrector = 0.5

        if self.model.video_embeddings is None:
            self.model.video_embeddings = self.model.get_video_features()

        self.video_embeddings = self.model.video_embeddings  # (n_frames, D)

    # ---------------- embedding helpers ---------------------
    def get_query_embedding(self, q: QueryUnit) -> NDArray[np.float32]:
        """
        Returns a (1, D) embedding.
        """
        if q.text_query:
            return self.model.get_text_features([q.text_query])

        if q.image_query:
            if not isinstance(q.image_query, ImageQuery):
                raise ValueError("image_query has invalid format")

            img = decode_data_url(q.image_query.image_data)
            return self.model.get_image_features(img)

        if q.crop_query:
            crop = q.crop_query
            crop_box = [int(v) for v in crop.crop_box]
            crop_img = get_cropped_image(self.video_path, crop_box, crop.current_index, self.FPS)
            return self.model.get_image_features([crop_img])

        raise ValueError("QueryUnit has no valid query field")

    # ---------------- similarity helpers ---------------------
    def video_similarity(self, query_emb: NDArray[np.float32]) -> NDArray[np.float32]:
        return self.model.cosine_similarity(self.video_embeddings, query_emb)

    def inter_query_similarity(
        self,
        emb1: NDArray[np.float32],
        emb2: NDArray[np.float32]
    ) -> float:
        sim: NDArray[np.float32] = self.model.cosine_similarity(emb1, emb2)
        return float(sim.squeeze())

    # ---------------- composition primitives ---------------------
    def and_score(
        self,
        sA: NDArray[np.float32],
        sB: NDArray[np.float32],
        rho: float
    ) -> NDArray[np.float32]:
        return sA * sB * (1.0 - self.overlap_corrector * rho)

    def or_score(
        self,
        sA: NDArray[np.float32],
        sB: NDArray[np.float32],
        inter_ab: NDArray[np.float32]
    ) -> NDArray[np.float32]:
        return sA + sB - inter_ab

    def wo_score(
        self,
        sA: NDArray[np.float32],
        sB: NDArray[np.float32],
        rho: float
    ) -> NDArray[np.float32]:
        return sA * (1.0 - sB * rho)

    # ---------------- main processor ---------------------
    def __call__(self, queries: List[QueryUnit]) -> List[float]:
        embeddings: List[NDArray[np.float32]] = []
        per_frame_scores: List[NDArray[np.float32]] = []
        logics: List[str] = []

        # extract scores + ops
        for unit in queries:
            if unit.logic:
                logics.append(unit.logic)
            else:
                emb = self.get_query_embedding(unit)
                embeddings.append(emb)
                sim = self.video_similarity(emb)
                per_frame_scores.append(sim)

        if not per_frame_scores:
            return []

        combined: NDArray[np.float32] = per_frame_scores[0]
        idx = 0

        for op in logics:
            sA = per_frame_scores[idx]
            sB = per_frame_scores[idx + 1]
            embA = embeddings[idx]
            embB = embeddings[idx + 1]

            rho = self.inter_query_similarity(embA, embB)

            if op == "AND":
                combined = self.and_score(sA, sB, rho)

            elif op == "OR":
                inter_ab = self.and_score(sA, sB, rho)
                combined = self.or_score(sA, sB, inter_ab)

            elif op in ("W/O", "WO", "W/O "):
                combined = self.wo_score(sA, sB, rho)

            else:
                raise ValueError(f"Unknown operator {op}")

            # update merged embedding (1, D)
            embA_vec = embA.reshape(-1)
            embB_vec = embB.reshape(-1)

            weightA = float(np.mean(sA))
            weightB = float(np.mean(sB))
            wsum = weightA + weightB if (weightA + weightB) > 0 else 1.0

            new_emb = ((weightA * embA_vec) + (weightB * embB_vec)) / wsum
            new_emb = new_emb.reshape(1, -1).astype(np.float32)

            embeddings[idx] = new_emb
            per_frame_scores[idx] = combined

            del embeddings[idx + 1]
            del per_frame_scores[idx + 1]

        final_scores: NDArray[np.float32] = per_frame_scores[0].squeeze()
        return final_scores.tolist()
