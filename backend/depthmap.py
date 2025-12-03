import cv2
import torch
import numpy as np

from typing import Optional, Tuple
from tqdm import tqdm
from transformers import (
    GLPNImageProcessor,
    GLPNForDepthEstimation,
)

class DepthMapEstimation:
    def __init__(
        self,
        fps: Optional[int],
        video_path: str = "",
        checkpoint: str = "vinvino02/glpn-nyu",
    ) -> None:

        self.video_path: str = video_path
        self.depth_video: Optional[np.ndarray] = None
        self.fps: Optional[float] = fps

        # model
        self.preprocessor: GLPNImageProcessor = GLPNImageProcessor.from_pretrained(checkpoint)
        self.depth_model: GLPNForDepthEstimation = GLPNForDepthEstimation.from_pretrained(checkpoint)

        self.device: str = "cuda" if torch.cuda.is_available() else "cpu"
        self.depth_model.to(self.device)

        print("Using device: ", self.device)

    def load_video(self) -> cv2.VideoCapture:
        vid = cv2.VideoCapture(self.video_path)
        assert vid.isOpened
        if self.fps is None:
            self.fps = int(vid.get(cv2.CAP_PROP_FPS))
        return vid

    def get_image_depth(self, image: np.ndarray) -> np.ndarray:
        inputs = self.preprocessor(images=image, return_tensors="pt").to(self.device)

        with torch.no_grad():
            outputs = self.depth_model(**inputs)

        initial_depth: np.ndarray = (
            torch.nn.functional.interpolate(
                outputs.predicted_depth.unsqueeze(1),
                size=(image.shape[0], image.shape[1]),
                mode="bicubic",
                align_corners=False,
            )
            .detach()
            .squeeze()
            .cpu()
            .numpy()
        )

        depth_map: np.ndarray = (
            (initial_depth - initial_depth.min())
            / (initial_depth.max() - initial_depth.min())
            * 255
        ).astype("uint8")

        depth_map = 255 - depth_map
        return depth_map

    def get_depth_video(self) -> None:
        vid: cv2.VideoCapture = self.load_video()

        self.fps = vid.get(cv2.CAP_PROP_FPS)
        frameCount: int = int(vid.get(cv2.CAP_PROP_FRAME_COUNT))
        frameWidth: int = int(vid.get(cv2.CAP_PROP_FRAME_WIDTH))
        frameHeight: int = int(vid.get(cv2.CAP_PROP_FRAME_HEIGHT))
        originalFps: int = int(vid.get(cv2.CAP_PROP_FPS))

        skipAhead: int = 0
        if originalFps > self.fps:
            skipAhead = int(originalFps / self.fps)
            frameCount = int(frameCount * self.fps / originalFps)

        self.depth_video = np.zeros((frameCount, frameHeight, frameWidth), dtype="uint8")

        with tqdm(total=frameCount, desc="Processing video depth map: ") as pbar:
            for i in range(frameCount):
                for _ in range(skipAhead - 1):
                    okay, _ = vid.read()
                    if not okay:
                        break

                okay, frame = vid.read()
                if not okay:
                    break

                depth_frame: np.ndarray = self.get_image_depth(
                    cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                )

                self.depth_video[i, :, :] = depth_frame
                pbar.update(1)

        print("Done")

    def save_depth_video(self, save_path: str, save_video: bool = False) -> None:
        if self.depth_video is None:
            return

        frameCount, frameHeight, frameWidth = self.depth_video.shape

        if save_video:
            depth_video = cv2.VideoWriter(
                f"{save_path}.mp4",
                cv2.VideoWriter_fourcc(*"mp4v"),
                self.fps,
                (frameWidth, frameHeight),
                isColor=False,
            )

        with tqdm(total=frameCount, desc="Saving video depth map: ") as pbar:
            for i in range(frameCount):
                if save_video:
                    depth_video.write(self.depth_video[i, :, :])
                else:
                    cv2.imwrite(f"{save_path}/depth_frame_{i}.png", self.depth_video[i, :, :])
                pbar.update(1)

        if save_video:
            depth_video.release()

        print("Done")

    def __call__(self, save_path: str, save_video: bool = False) -> None:
        vid: cv2.VideoCapture = self.load_video()

        self.fps = vid.get(cv2.CAP_PROP_FPS)
        frameCount: int = int(vid.get(cv2.CAP_PROP_FRAME_COUNT))
        frameWidth: int = int(vid.get(cv2.CAP_PROP_FRAME_WIDTH))
        frameHeight: int = int(vid.get(cv2.CAP_PROP_FRAME_HEIGHT))
        originalFps: int = int(vid.get(cv2.CAP_PROP_FPS))

        skipAhead: int = 0
        if originalFps > self.fps:
            skipAhead = int(originalFps / self.fps)
            frameCount = int(frameCount * self.fps / originalFps)

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out: Optional[cv2.VideoWriter] = None

        if save_video:
            out = cv2.VideoWriter(
                f"{save_path}.mp4",
                fourcc,
                self.fps,
                (frameWidth, frameHeight),
                isColor=False,
            )

        with tqdm(total=frameCount, desc="Processing video depth map: ") as pbar:
            for i in range(frameCount):
                for _ in range(skipAhead - 1):
                    okay, _ = vid.read()
                    if not okay:
                        break

                okay, frame = vid.read()
                if not okay:
                    break

                depth_frame: np.ndarray = self.get_image_depth(
                    cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                )

                if save_video and out is not None:
                    out.write(depth_frame)
                else:
                    cv2.imwrite(f"{save_path}/depth_frame_{i}.png", depth_frame)

                pbar.update(1)

        if save_video and out is not None:
            out.release()
