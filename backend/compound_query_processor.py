import numpy as np
from pydantic import BaseModel
from typing import List, Literal, Optional

class CropQuery(BaseModel):
    current_index: int
    crop_box: List[float]

class QueryUnit(BaseModel):
    text_query: Optional[str] = None
    image_query: Optional[str] = None
    crop_query: Optional[CropQuery] = None
    logic: Optional[Literal["AND", "OR", "W/O"]] = None

class CompoundQueryProcessor:
    """
    Evaluates an ordered list of QueryUnit objects against a video (per-frame embeddings)
    using pseudo-probabilistic composition rules that account for query-query similarity.
    """

    def __init__(self, vit_model):
        self.model = vit_model
        # expect video embeddings to exist in vit_model.video_embeddings (n_frames x D)
        if self.model.video_embeddings is None:
            # call model to compute video embeddings if not present
            self.model.video_embeddings = self.model.get_video_features()
        self.video_embeddings = self.model.video_embeddings  # (n_frames, D)

    # --- embedding helpers ------------------------------------------------
    def get_query_embedding(self, q: QueryUnit) -> np.ndarray:
        """
        Return a shape (1, D) embedding for a single query.
        - text_query: string
        - image_query: path or identifier string (you must adapt loading to your case)
        - crop_query: expects the caller to provide the cropped image content path or coordinates
        """
        if q.text_query:
            emb = self.model.get_text_features([q.text_query])  # returns (1, D)
            return emb
        if q.image_query:
            # Here we assume image_query is a path on the server or an identifier you can resolve
            # If you instead accept raw bytes, adapt logic to decode and pass actual image
            emb = self.model.get_image_features([q.image_query])
            return emb
        if q.crop_query:
            # You must supply a function to extract crop pixels by (current_index, crop_box).
            # This code assumes you can obtain the cropped image as an array variable `crop_img`.
            # Implement `get_crop_image(current_index, crop_box)` in your app.
            crop = q.crop_query
            crop_img = get_crop_image(crop.current_index, crop.crop_box)
            emb = self.model.get_image_features([crop_img])
            return emb

        raise ValueError("Query unit has no content field set")

    # --- similarity helpers -----------------------------------------------
    def video_similarity(self, query_emb: np.ndarray) -> np.ndarray:
        """
        Returns array shape (n_frames, 1) of similarities in [0,1]
        """
        return self.model.cosine_similarity(self.video_embeddings, query_emb)  # (n_frames, 1)

    def inter_query_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """
        Returns scalar similarity in [0,1] between two 1xD embeddings.
        """
        # model.cosine_similarity returns array; flatten to scalar
        sim = self.model.cosine_similarity(emb1, emb2)  # shape (1,1)
        return float(sim.squeeze())

    # --- composition primitives ------------------------------------------
    @staticmethod
    def and_score(sA: np.ndarray, sB: np.ndarray, rho: float) -> np.ndarray:
        """
        correlation-aware AND:
        s_and = (sA * sB) / (1 + rho)
        sA and sB are arrays shape (n_frames, 1)
        rho scalar in [0,1]
        """
        denom = 1.0 + rho 
        return np.clip((sA * sB) / denom, 0.0, 1.0)

    @staticmethod
    def or_score(sA: np.ndarray, sB: np.ndarray, inter_ab: np.ndarray) -> np.ndarray:
        """
        Inclusion-exclusion with intersection already computed as inter_ab:
        s_or = sA + sB - inter_ab
        inter_ab should already be the per-frame intersection value (same shape as sA)
        """
        return np.clip(sA + sB - inter_ab, 0.0, 1.0)

    @staticmethod
    def wo_score(sA: np.ndarray, sB: np.ndarray, rho: float) -> np.ndarray:
        """
        W/O (A without B) correlation-aware:
        s_A_minus_B = sA * (1 - sB * rho)
        """
        return np.clip(sA * (1.0 - sB * rho), 0.0, 1.0)

    # --- main processing -----------------------------------------------
    def __call__(self, queries: List[QueryUnit]) -> List[float]:
        """
        Accepts an ordered list of QueryUnit objects: content and logic tokens interleaved.
        Example: [A, logic, B, logic, C, ...]
        Returns per-frame final compound score as a Python list.
        """
        # Step 1: extract content embeddings and per-frame scores, track logic ops
        embeddings = []       # list of (1, D)
        per_frame_scores = [] # list of (n_frames, 1) arrays
        logics = []           # list of logic tokens in order

        for unit in queries:
            if unit.logic:
                logics.append(unit.logic)
            else:
                emb = self.get_query_embedding(unit)     # (1, D)
                embeddings.append(emb)
                sim = self.video_similarity(emb)         # (n_frames, 1)
                per_frame_scores.append(sim)

        if not per_frame_scores:
            # nothing to score
            return []

        # Step 2: sequential evaluation (left-to-right)
        # We'll combine pairwise following the logics list (assumes valid alternating structure)
        combined = per_frame_scores[0]  # (n_frames, 1)
        idx = 0  # index for left operand of next logic (embeddings/per_frame_scores index)

        for op in logics:
            # A is at index idx, B is at index idx+1
            sA = per_frame_scores[idx]    # (n_frames,1)
            sB = per_frame_scores[idx+1]  # (n_frames,1)
            embA = embeddings[idx]        # (1,D)
            embB = embeddings[idx+1]      # (1,D)

            # compute inter-query scalar rho
            rho = self.inter_query_similarity(embA, embB)  # scalar in [0,1]

            if op == "AND":
                inter_ab = self.and_score(sA, sB, rho)
                combined = inter_ab

            elif op == "OR":
                # intersection per-frame used in inclusion-exclusion should be the AND per-frame
                inter_ab = self.and_score(sA, sB, rho)
                combined = self.or_score(sA, sB, inter_ab)

            elif op in ("W/O", "WO", "W/O "):
                # A W/O B -> A minus B
                # Use corr-aware variant
                combined = self.wo_score(sA, sB, rho)

            else:
                raise ValueError(f"Unknown logic operator: {op}")

            # Advance: after applying op to A and B, treat result as "A" for next op
            # Replace embeddings/scores at idx with the combined representation
            # For embedding of combined result we approximate with weighted avg of embA and embB
            # weighted by per-frame average importance (simple heuristic)
            # If you don't want to approximate an embedding for the result, compute rho for next ops using a fallback.
            embA_vec = embA.reshape(-1)
            embB_vec = embB.reshape(-1)
            # produce a new "pseudo-embedding" for combined to compute future rhos:
            # weight by mean score across frames
            weightA = float(np.mean(sA))
            weightB = float(np.mean(sB))
            wsum = (weightA + weightB) if (weightA + weightB) > 0 else 1.0
            new_emb = ((weightA * embA_vec) + (weightB * embB_vec)) / wsum
            new_emb = new_emb.reshape(1, -1)  # (1,D)

            # Update lists: replace idx with combined, remove idx+1
            embeddings[idx] = new_emb
            per_frame_scores[idx] = combined
            del embeddings[idx+1]
            del per_frame_scores[idx+1]

            # next op will again use idx (left) vs idx+1 (right) until logics exhausted
        # final combined is per_frame_scores[0]
        final_scores = per_frame_scores[0].squeeze()  # (n_frames,)
        return final_scores.tolist()
