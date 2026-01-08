import cv2
import numpy as np

from typing import List, Optional, Tuple, Union

#audio handling
import ffmpeg
import os
import soundfile as sf
from scipy.signal import medfilt

#model
import torch

import sys
from pathlib import Path
ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
sys.path.append(str(ASSETS_DIR))

# expected a multimodal foundation model with support for encoding images, text and audio
from multimodal_interface import MultiModal

#logs
from tqdm import tqdm
import os

class VisionTransformer:
    video_path: str
    fps: Optional[int]
    video_embeddings: Optional[np.ndarray]
    image_embeddings: Optional[np.ndarray]
    text_embeddings: Optional[np.ndarray]
    scores: Optional[np.ndarray]
    reduction: Optional[np.ndarray]
    model: MultiModal
    device: str
    batch_size: int

    def __init__(
        self,
        fps: Optional[int],
        video_path: str = "",
        batch_size: int = 64,
        audio_chunk_duration: int = 10,
        audio_stride: int = 5
    ) -> None:

        # input video path
        self.video_path = video_path
        self.fps = fps
        self.duration = audio_chunk_duration
        self.stride = audio_stride

        # outputs
        self.video_embeddings = None
        self.image_embeddings = None
        self.audio_embeddings = None
        self.text_embeddings = None 
        self.video_scores = None
        self.audio_scores = None
        self.reduction = None

        #model loading
        self.model = MultiModal()

        #batch size for processing frames
        self.batch_size = batch_size

    def load_video(self) -> cv2.VideoCapture:
        vid = cv2.VideoCapture(self.video_path)
        assert vid.isOpened
        if self.fps is None:
            self.fps = int(vid.get(cv2.CAP_PROP_FPS))
        return vid
    
    def get_energy(self, x: np.ndarray) -> float:
        if x.ndim == 2:
            x = x.flatten()
        if np.max(np.abs(x)) > 0: #normalize (in case)
            x = x / np.max(np.abs(x))
        rms = np.sqrt(np.mean(x**2)) #compute RMS
        return rms 

    def save_audio(self, output_audio_path: str, is_split: bool = True, duration: int = 10, stride: int = 5)\
        -> Union[List[str], Tuple[List[str], List[bool]]]:
        #check if video has audio stream first
        try:
            probe = ffmpeg.probe(self.video_path)
            audio_streams = [stream for stream in probe['streams'] if stream['codec_type'] == 'audio']
            print(type(audio_streams), audio_streams[0] if audio_streams else None)
            
            if not audio_streams:
                print(f"Warning: No audio stream found in {self.video_path}")
                #return None or create a dummy audio embedding
                return None, None
            
            #extract audio with error handling
            (
                ffmpeg
                .input(self.video_path)
                .output(output_audio_path, acodec='pcm_s16le', ac=1, ar='16000')
                .overwrite_output()
                .run()
            )

            if not is_split:
                return [output_audio_path], [False]
            
        except ffmpeg.Error as e:
            print(f"FFmpeg error: {e}")
            return None, None
        
        except Exception as e:
            print(f"Error loading audio: {e}")
            return None, None
        
        try:
            output_dir = self.video_path.split(".")[0]
            audio_data, sample_rate = sf.read(output_audio_path)
            total_samples = audio_data.shape[0]

            chunk_samples = int(duration * sample_rate)
            stride_samples = int(stride * sample_rate)

            chunk_paths = []
            energies = []
            i = 0
            start = 0
            while start + stride_samples < total_samples:
                end = min(start + chunk_samples, total_samples)
                chunk = audio_data[start:end]
                chunk_path = os.path.join(output_dir, f"audio_{i:03d}.wav")
                sf.write(chunk_path, chunk, sample_rate)
                chunk_paths.append(chunk_path)
                energies.append(self.get_energy(chunk)) #adjust threshold as needed
                i += 1
                start += chunk_samples - stride_samples

            #choose silence threshold
            threshold = np.min(energies) + (np.max(energies) - np.min(energies)) / 10 #bottom 10%
            print(np.min(energies), np.max(energies))
            is_silent_segment = [e < threshold for e in energies]
            silent_segments = np.asarray(is_silent_segment, dtype=bool)
            np.save(f"{output_dir}/embedding_audio_silence.npy", silent_segments)

            return chunk_paths, silent_segments

        except Exception as e:
            print(f"Audio chunking error: {e}")
            return []

    def get_features(self, images: Optional[torch.Tensor] = None, texts: Optional[torch.Tensor] = None, audios: Optional[torch.Tensor] = None) -> Tuple[Optional[np.ndarray], Optional[np.ndarray], Optional[np.ndarray]]:
        with torch.no_grad():
            outputs = {}
            
            if images is not None:
                outputs["vision"] = self.model.get_image_features(images)
            
            if texts is not None:
                outputs["text"] = self.model.get_text_features(texts)
                
            if audios is not None:
                outputs["audio"] = self.model.get_audio_features(audios)
            
        return (
            outputs["vision"].detach().cpu().numpy() if images is not None else None, 
            outputs["text"].detach().cpu().numpy() if texts is not None else None, 
            outputs["audio"].detach().cpu().numpy() if audios is not None else None
        )

    def get_video_features(self):
        vid = self.load_video()
        frame_count = int(vid.get(cv2.CAP_PROP_FRAME_COUNT))
        original_fps = vid.get(cv2.CAP_PROP_FPS)
        duration = frame_count / original_fps
        total_frames_to_extract = int(duration * self.fps)

        embeddings = []
        frames = []

        #sample every `step` seconds
        step = 1 / self.fps
        current_time = 0

        with tqdm(total=total_frames_to_extract, desc="computing video embeddings: ") as pbar:
            for _ in range(total_frames_to_extract):
                vid.set(cv2.CAP_PROP_POS_MSEC, current_time * 1000)  #milliseconds
                okay, frame = vid.read()
                if not okay:
                    break

                frames.append(frame)

                if len(frames) == self.batch_size:
                    batch_embeddings, _, _ = self.get_features(images=frames)
                    embeddings.append(batch_embeddings)
                    frames = []

                current_time += step
                pbar.update(1)

            #process leftovers
            if frames:
                batch_embeddings, _, _ = self.get_features(images=frames)
                embeddings.append(batch_embeddings)

        vid.release()
        return np.vstack(embeddings)

    def get_audio_features(self):
        audio_path, silent_segments = self.save_audio("videos/audio.wav", duration=self.duration, stride=self.stride)
        _, _, self.audio_embeddings = self.get_features(audios=audio_path)
        return self.audio_embeddings, silent_segments

    def load_video_features(self, output_path: str, frame_count: int) -> None:
        embeddings: List[np.ndarray] = [
            np.load(f"{output_path}/embedding_{i}.npy")
            for i in range(frame_count)
        ]
        self.video_embeddings = np.vstack(embeddings)

    def load_audio_features(self, output_path, frame_count):
        if not os.path.exists(output_path+f"/embedding_audio_0.npy"):
            self.audio_embeddings = None
            return

        embeddings = []
        for i in range(int(frame_count / (self.duration - self.stride) / self.fps)):
            if not os.path.exists(output_path+f"/embedding_audio_{i}.npy"):
                continue
            embeddings.append(np.load(output_path+f"/embedding_audio_{i}.npy"))
        self.audio_embeddings = np.vstack(embeddings)

    def cosine_similarity(
        self,
        embeds1: np.ndarray,
        embeds2: np.ndarray
    ) -> np.ndarray:
        #reshape 1D arrays to 2D if necessary
        if embeds1.ndim == 1:
            embeds1 = embeds1.reshape(1, -1)

        if embeds2.ndim == 1:
            embeds2 = embeds2.reshape(1, -1)

        #compute the dot product between the embeddings
        dot_product = np.dot(embeds1, embeds2.T)

        #compute the L2 norms of the embeddings
        norm_x = np.linalg.norm(embeds1, axis=1, keepdims=True)
        norm_y = np.linalg.norm(embeds2, axis=1, keepdims=True)

        #compute the cosine similarity
        cosine_similarity = dot_product / (norm_x * norm_y.T)

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
        input_images: Optional[List[np.ndarray]] = None,
        input_texts: Optional[List[str]] = None
    ) -> None:

        self.video_embeddings = self.get_video_features()
        self.audio_embeddings, silent_segments = self.get_audio_features()

        video_image_cosine: Optional[np.ndarray] = None
        audio_image_cosine: Optional[np.ndarray] = None
        video_text_cosine: Optional[np.ndarray] = None
        audio_text_cosine: Optional[np.ndarray] = None

        if input_images is not None:
            self.image_embeddings, _, self.audio_embeddings = self.get_features(images=input_images, audios=audio_path)
            video_image_cosine = self.cosine_similarity(self.video_embeddings, self.image_embeddings)
            audio_image_cosine = self.cosine_similarity(self.audio_embeddings, self.image_embeddings) if self.audio_embeddings is not None else None,
            self.video_scores = video_image_cosine
            self.audio_scores = audio_image_cosine
        
        if input_texts is not None:
            _, self.text_embeddings, self.audio_embeddings = self.get_features(texts=input_texts, audios=audio_path)
            video_text_cosine = self.cosine_similarity(self.video_embeddings, self.text_embeddings)
            audio_text_cosine = self.cosine_similarity(self.audio_embeddings, self.text_embeddings) if self.audio_embeddings is not None else None,
            
            #in case of silent segments, set audio scores to 0
            if silent_segments is not None and self.audio_embeddings is not None:
                for i, is_silent in enumerate(silent_segments):
                    if is_silent:
                        audio_text_cosine[i, :] = 0.0
            
            if input_images is None:
                self.video_scores = video_text_cosine 
                self.audio_scores = audio_text_cosine
            else:
                self.scores = np.concatenate((self.video_scores, video_text_cosine), axis = 0)
                self.audio_scores = np.concatenate((self.audio_scores, audio_text_cosine), axis = 0)
    
