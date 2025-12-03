import cv2
import torch
import numpy as np

from typing import List, Optional, Tuple, Union
from transformers import AutoModel, AutoProcessor
from tqdm import tqdm
import os
import time

class VisionTransformer:
    video_path: str
    fps: Optional[int]
    video_embeddings: Optional[np.ndarray]
    image_embeddings: Optional[np.ndarray]
    text_embeddings: Optional[np.ndarray]
    scores: Optional[np.ndarray]
    reduction: Optional[np.ndarray]
    model: AutoModel
    processor: AutoProcessor
    device: str
    batch_size: int

    def __init__(
        self,
        fps: Optional[int],
        video_path: str = "",
        checkpoint: str = "openai/clip-vit-base-patch16",
        batch_size: int = 256,
    ) -> None:

        # input video path
        self.video_path = video_path
        self.fps = fps

        # outputs
        self.video_embeddings = None
        self.image_embeddings = None
        self.text_embeddings = None
        self.scores = None
        self.reduction = None

        # model loading
        start = time.time()
        if not os.path.exists("models"):
            os.mkdir("models")

        self.model, self.processor = self.load_model(
            checkpoint,
            "models/processor.pth",
            "models/clip-vit-b16.pth",
        )
        print("loading in ", time.time() - start)

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print("Using device: ", self.device)
        self.model.to(self.device)
        self.batch_size = batch_size

    def load_video(self) -> cv2.VideoCapture:
        vid = cv2.VideoCapture(self.video_path)
        assert vid.isOpened
        if self.fps is None:
            self.fps = int(vid.get(cv2.CAP_PROP_FPS))
        return vid

    def load_model(
        self,
        checkpoint: str,
        preprocessor_path: str,
        model_path: str
    ) -> Tuple[AutoModel, AutoProcessor]:

        if not os.path.exists(preprocessor_path):
            processor: AutoProcessor = AutoProcessor.from_pretrained(checkpoint)
            torch.save(processor, preprocessor_path)
        else:
            processor = torch.load(preprocessor_path, weights_only=False)

        if not os.path.exists(model_path):
            model: AutoModel = AutoModel.from_pretrained(checkpoint)
            torch.save(model, model_path)
        else:
            model = torch.load(model_path, weights_only=False)

        return model, processor

    def get_image_features(
        self,
        images: List[np.ndarray]
    ) -> np.ndarray:

        with torch.no_grad():
            img_input: dict = self.processor(
                images=images,
                text=None,
                padding=True,
                return_tensors="pt"
            ).to(self.device)

            outputs: torch.Tensor = self.model.get_image_features(**img_input)
            return outputs.detach().cpu().numpy()

    def get_text_features(self, texts: List[str]) -> np.ndarray:
        with torch.no_grad():
            inputs: dict = self.processor(
                images=None,
                text=texts,
                padding=True,
                return_tensors="pt"
            ).to(self.device)

            outputs: torch.Tensor = self.model.get_text_features(**inputs)
            return outputs.detach().cpu().numpy()

    def get_video_features(self) -> np.ndarray:
        vid: cv2.VideoCapture = self.load_video()
        frame_count: int = int(vid.get(cv2.CAP_PROP_FRAME_COUNT))
        original_fps: int = int(vid.get(cv2.CAP_PROP_FPS))

        skip_ahead: int = 0

        if original_fps > (self.fps or original_fps):
            skip_ahead = int(original_fps / self.fps)
            frame_count = int(frame_count * self.fps / original_fps)

        embeddings: List[np.ndarray] = []
        frames: List[np.ndarray] = []

        with tqdm(total=frame_count, desc="computing video embeddings: ") as pbar:
            while vid.isOpened:
                for _ in range(skip_ahead - 1):
                    ok, _ = vid.read()
                    if not ok:
                        break

                ok, frame = vid.read()
                if not ok:
                    break

                frames.append(frame)

                if len(frames) == self.batch_size:
                    batch_embeddings = self.get_image_features(frames)
                    embeddings.append(batch_embeddings)
                    frames = []

                pbar.update(1)

            if frames:
                batch_embeddings = self.get_image_features(frames)
                embeddings.append(batch_embeddings)

        vid.release()
        return np.vstack(embeddings)

    def load_video_features(self, output_path: str, frame_count: int) -> None:
        embeddings: List[np.ndarray] = [
            np.load(f"{output_path}/embedding_{i}.npy")
            for i in range(frame_count)
        ]
        self.video_embeddings = np.vstack(embeddings)

    def cosine_similarity(
        self,
        embeds1: np.ndarray,
        embeds2: np.ndarray
    ) -> np.ndarray:

        if embeds1.ndim == 1:
            embeds1 = embeds1.reshape(1, -1)

        if embeds2.ndim == 1:
            embeds2 = embeds2.reshape(1, -1)

        dot_product: np.ndarray = np.dot(embeds1, embeds2.T)
        norm_x: np.ndarray = np.linalg.norm(embeds1, axis=1, keepdims=True)
        norm_y: np.ndarray = np.linalg.norm(embeds2, axis=1, keepdims=True)

        cosine_similarity: np.ndarray = dot_product / (norm_x * norm_y.T)
        cosine_similarity = (cosine_similarity + 1) / 2

        return cosine_similarity

    def tsne_reduction(
        self,
        embeddings: np.ndarray,
        normalize: bool = True,
        random_state: int = 0,
        n_iter: int = 1000,
        metric: str = "cosine",
    ) -> np.ndarray:

        from sklearn.manifold import TSNE
        from sklearn.preprocessing import StandardScaler

        tsne = TSNE(
            random_state=random_state,
            n_iter=n_iter,
            metric=metric
        )

        if normalize:
            embeddings = StandardScaler().fit_transform(embeddings)

        embeddings2d: np.ndarray = tsne.fit_transform(embeddings)
        return embeddings2d

    def pca_reduction(
        self,
        embeddings: np.ndarray
    ) -> np.ndarray:

        from sklearn.decomposition import PCA
        from sklearn.preprocessing import StandardScaler

        normalizer = StandardScaler()
        pca = PCA(n_components=2)

        embeddings2d: np.ndarray = pca.fit_transform(
            normalizer.fit_transform(embeddings)
        )
        return embeddings2d

    def umap_reduction(
        self,
        embeddings: np.ndarray,
        normalize: bool = True,
        random_state: int = 0
    ) -> np.ndarray:

        from sklearn.preprocessing import StandardScaler
        import umap

        u_map = umap.UMAP(n_components=2, random_state=random_state)

        if normalize:
            embeddings = StandardScaler().fit_transform(embeddings)

        embeddings2d: np.ndarray = u_map.fit_transform(embeddings)
        return embeddings2d

    def __call__(
        self,
        images: Optional[List[np.ndarray]] = None,
        texts: Optional[List[str]] = None
    ) -> None:

        self.video_embeddings = self.get_video_features()

        image_cosine: Optional[np.ndarray] = None
        text_cosine: Optional[np.ndarray] = None

        if images is not None:
            self.image_embeddings = self.get_image_features(images)
            image_cosine = self.cosine_similarity(
                self.video_embeddings,
                self.image_embeddings
            )
            self.scores = image_cosine

        if texts is not None:
            self.text_embeddings = self.get_text_features(texts)
            text_cosine = self.cosine_similarity(
                self.video_embeddings,
                self.text_embeddings
            )

            if images is None:
                self.scores = text_cosine
            else:
                self.scores = np.concatenate(
                    (self.scores, text_cosine),
                    axis=0
                )
