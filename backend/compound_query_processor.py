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
    logic: Optional[Literal["AND", "OR", "W/O"]] = None

# --------------------- Main processor ----------------------
class CompoundQueryProcessor:
    def __init__(
        self,
        vit_model: any,
        video_path: str = "",
        FPS: int = 10
    ) -> None:
        self.model = vit_model
        self.video_path = video_path
        self.FPS = FPS
        self.overlap_corrector = 0.5

        if self.model.video_embeddings is None:
            self.model.video_embeddings = self.model.get_video_features()

        if self.model.audio_embeddings is None:
            self.model.audio_embeddings, _ = self.model.get_audio_features()

        self.video_embeddings = self.model.video_embeddings
        self.audio_embeddings = self.model.audio_embeddings

    # ---------------- embeddings ----------------
    def get_query_embedding(self, q: QueryUnit):
        if q.text_query:
            _, text_features, _ = self.model.get_features(texts=[q.text_query])
            return text_features

        if q.image_query:
            img = decode_data_url(q.image_query.image_data)
            image_features, _, _ = self.model.get_features(images=[img])
            return image_features

        if q.crop_query:
            crop = q.crop_query
            crop_img = get_cropped_image(
                self.video_path,
                [int(v) for v in crop.crop_box],
                crop.current_index,
                self.FPS
            )
            crop_features, _, _ = self.model.get_features(images=[crop_img])
            return crop_features

        if q.audio_query:
            audio_path = decode_audio_url(q.audio_query.audio_data)
            try:
                _, _, audio_features = self.model.get_features(audios=[str(audio_path)])
                return audio_features
            finally:
                audio_path.unlink(missing_ok=True)

        raise ValueError("Invalid QueryUnit")

    # ---------------- similarities ----------------
    def video_similarity(self, emb):
        return sigmoid(self.model.cosine_similarity(self.video_embeddings, emb))

    def audio_similarity(self, emb):
        if self.audio_embeddings is None:
            return None
        return sigmoid(self.model.cosine_similarity(self.audio_embeddings, emb))

    def inter_query_similarity(self, embA, embB) -> float:
        return float(sigmoid(self.model.cosine_similarity(embA, embB)))

    # ---------------- logic ops ----------------
    def and_score(self, sA, sB, rho):
        return sA * sB * (1.0 - self.overlap_corrector * rho)

    def or_score(self, sA, sB, inter_ab):
        return sA + sB - inter_ab

    def wo_score(self, sA, sB, rho):
        return sA * (1.0 - sB * rho)

    # ---------------- main ----------------
    def __call__(self, queries: List[QueryUnit]) -> List[float]:
        video_scores = []
        audio_scores = []
        embeddings = []
        logics = []

        # leaf extraction
        for q in queries:
            if q.logic:
                logics.append(q.logic)
                continue

            emb = self.get_query_embedding(q)
            embeddings.append(emb)

            video_scores.append(self.video_similarity(emb))
            audio_scores.append(self.audio_similarity(emb))

        if not video_scores:
            return []

        idx = 0

        for op in logics:
            vA, vB = video_scores[idx], video_scores[idx + 1]
            aA, aB = audio_scores[idx], audio_scores[idx + 1]
            rho = self.inter_query_similarity(embeddings[idx], embeddings[idx + 1])

            if op == "AND":
                vC = self.and_score(vA, vB, rho)
                aC = self.and_score(aA, aB, rho) if aA is not None else None

            elif op == "OR":
                inter_v = self.and_score(vA, vB, rho)
                vC = self.or_score(vA, vB, inter_v)

                if aA is not None:
                    inter_a = self.and_score(aA, aB, rho)
                    aC = self.or_score(aA, aB, inter_a)
                else:
                    aC = None

            elif op in ("W/O", "WO"):
                vC = self.wo_score(vA, vB, rho)
                aC = self.wo_score(aA, aB, rho) if aA is not None else None

            else:
                raise ValueError(op)

            video_scores[idx] = vC
            audio_scores[idx] = aC

            del video_scores[idx + 1]
            del audio_scores[idx + 1]
            del embeddings[idx + 1]

        v_final = video_scores[0].flatten()
        a_final = audio_scores[0].flatten() if audio_scores[0] is not None else None

        if a_final is None:
            return v_final.tolist(), None
    
        return v_final.tolist(), a_final.tolist()
