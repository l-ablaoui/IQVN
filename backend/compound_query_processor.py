import numpy as np

from pydantic import BaseModel
from typing import List, Literal, Optional

from utilities import get_cropped_image, sigmoid, decode_data_url

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

class CompoundQueryProcessor:
    """
    Evaluates an ordered list of QueryUnit objects against a video (per-frame embeddings)
    using pseudo-probabilistic composition rules that account for query-query similarity.
    """

    def __init__(self, vit_model, video_path="", FPS=10):
        self.model = vit_model
        self.video_path = video_path
        self.FPS=FPS
        self.overlap_corrector = 0.5
        #expect video embeddings to exist in vit_model.video_embeddings (n_frames x D)
        if self.model.video_embeddings is None:
            #call model to compute video embeddings if not present
            self.model.video_embeddings = self.model.get_video_features()
        self.video_embeddings = self.model.video_embeddings  #(n_frames, D)

    #--- embedding helpers ------------------------------------------------
    def get_query_embedding(self, q: QueryUnit) -> np.ndarray:
        """
        Return a shape (1, D) embedding for a single query.
        - text_query: string
        - image_query: path or identifier string (you must adapt loading to your case)
        - crop_query: expects the caller to provide the cropped image content path or coordinates
        """
        if q.text_query:
            query_embed = self.model.get_text_features([q.text_query])  #returns (1, D)
            return query_embed

        if q.image_query:
            if isinstance(q.image_query, ImageQuery):
                data_url = q.image_query.image_data
            else:
                raise ValueError("image_query has unsupported format; expect data URL string or {image_data: ...}")
            query_image = decode_data_url(data_url)
            query_embed = self.model.get_image_features(query_image)
            return query_embed

        if q.crop_query:
            crop = q.crop_query
            crop_box = [int(val) for val in crop.crop_box]
            crop_img = get_cropped_image(self.video_path, crop_box, crop.current_index, self.FPS)
            query_embed = self.model.get_image_features([crop_img])
            return query_embed

        raise ValueError("Query unit has no content field set")

    #--- similarity helpers -----------------------------------------------
    def video_similarity(self, query_emb: np.ndarray) -> np.ndarray:
        """
        Returns array shape (n_frames, 1) of similarities in [0,1]
        """
        return self.model.cosine_similarity(self.video_embeddings, query_emb)  #(n_frames, 1)

    def inter_query_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """
        Returns scalar similarity in [0,1] between two 1xD embeddings.
        """
        #model.cosine_similarity returns array; flatten to scalar
        sim = self.model.cosine_similarity(emb1, emb2)  #shape (1,1)
        return float(sim.squeeze())

    #--- composition primitives ------------------------------------------
    def and_score(self, sA: np.ndarray, sB: np.ndarray, rho: float) -> np.ndarray:
        """
        correlation-aware AND:
        s_and = (sA * sB) * (1 - alpha * rho)
        sA and sB are arrays shape (n_frames, 1)
        alpha and rho scalars in [0,1]
        """
        return sA * sB * (1.0 - self.overlap_corrector * rho)

    def or_score(self, sA: np.ndarray, sB: np.ndarray, inter_ab: np.ndarray) -> np.ndarray:
        """
        Inclusion-exclusion with intersection already computed as inter_ab:
        s_or = sA + sB - inter_ab
        inter_ab should already be the per-frame intersection value (same shape as sA)
        """
        return sA + sB - inter_ab

    def wo_score(self, sA: np.ndarray, sB: np.ndarray, rho: float) -> np.ndarray:
        """
        W/O (A without B) correlation-aware:
        s_A_minus_B = sA * (1 - sB * rho)
        """
        return sA * (1.0 - sB * rho)

    #--- main processing -----------------------------------------------
    def __call__(self, queries: List[QueryUnit]) -> List[float]:
        """
        Accepts an ordered list of QueryUnit objects: content and logic tokens interleaved.
        Example: [A, logic, B, logic, C, ...]
        Returns per-frame final compound score as a Python list.
        """
        #step 1: extract content embeddings and per-frame scores, track logic ops
        embeddings = []       #list of (1, D)
        per_frame_scores = [] #list of (n_frames, 1) arrays
        logics = []           #list of logic tokens in order

        for unit in queries:
            if unit.logic:
                logics.append(unit.logic)
            else:
                emb = self.get_query_embedding(unit)     #(1, D)
                embeddings.append(emb)
                sim = self.video_similarity(emb)         #(n_frames, 1)
                per_frame_scores.append(sim)

        if not per_frame_scores:
            #nothing to score
            return []

        #step 2: sequential evaluation (left-to-right)
        #we'll combine pairwise following the logics list (assumes valid alternating structure)
        combined = per_frame_scores[0]  #(n_frames, 1)
        idx = 0  #index for left operand of next logic (embeddings/per_frame_scores index)

        for op in logics:
            #A is at index idx, B is at index idx+1
            sA = per_frame_scores[idx]    #(n_frames,1)
            sB = per_frame_scores[idx+1]  #(n_frames,1)
            embA = embeddings[idx]        #(1,D)
            embB = embeddings[idx+1]      #(1,D)

            #compute inter-query scalar rho
            rho = self.inter_query_similarity(embA, embB)  #scalar in [0,1]

            if op == "AND":
                inter_ab = self.and_score(sA, sB, rho)
                combined = inter_ab

            elif op == "OR":
                #intersection per-frame used in inclusion-exclusion should be the AND per-frame
                inter_ab = self.and_score(sA, sB, rho)
                combined = self.or_score(sA, sB, inter_ab)

            elif op in ("W/O", "WO", "W/O "):
                #A W/O B -> A minus B
                #Use corr-aware variant
                combined = self.wo_score(sA, sB, rho)

            else:
                raise ValueError(f"Unknown logic operator: {op}")

            #Advance: after applying op to A and B, treat result as "A" for next op
            #Replace embeddings/scores at idx with the combined representation
            #For embedding of combined result we approximate with weighted avg of embA and embB
            #weighted by per-frame average importance (simple heuristic)
            #If you don't want to approximate an embedding for the result, compute rho for next ops using a fallback.
            embA_vec = embA.reshape(-1)
            embB_vec = embB.reshape(-1)
            #produce a new "pseudo-embedding" for combined to compute future rhos:
            #weight by mean score across frames
            weightA = float(np.mean(sA))
            weightB = float(np.mean(sB))
            wsum = (weightA + weightB) if (weightA + weightB) > 0 else 1.0
            new_emb = ((weightA * embA_vec) + (weightB * embB_vec)) / wsum
            new_emb = new_emb.reshape(1, -1)  #(1,D)

            #Update lists: replace idx with combined, remove idx+1
            embeddings[idx] = new_emb
            per_frame_scores[idx] = combined
            del embeddings[idx+1]
            del per_frame_scores[idx+1]

            #next op will again use idx (left) vs idx+1 (right) until logics exhausted
        #final combined is per_frame_scores[0]
        final_scores = per_frame_scores[0].squeeze()  #(n_frames,)
        return final_scores.tolist()
