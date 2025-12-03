from __future__ import annotations

import torch
from torch import Tensor
import numpy as np
from numpy.typing import NDArray
import pandas as pd
import cv2

from typing import Any, List, Optional, Tuple, Union
from time import time
from tqdm import tqdm

Frame = NDArray[np.uint8]  # OpenCV BGR image

class ObjectDetector:
    video_path: str
    fps: Optional[int]
    output_results: str
    model: Any
    classes: List[str]
    device: str

    def __init__(
        self,
        video_path: str,
        output_results: str,
        model_name: Optional[str],
        fps: Optional[int]
    ) -> None:
        self.video_path = video_path
        self.fps = fps
        self.output_results = output_results
        self.model = self.load_model(model_name)
        self.classes = self.model.names
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print("Using Device:", self.device)

    def get_video_capture(self) -> cv2.VideoCapture:
        vid = cv2.VideoCapture(self.video_path)
        assert vid.isOpened
        if self.fps is None:
            self.fps = int(vid.get(cv2.CAP_PROP_FPS))
        return vid

    def load_model(self, model_name: Optional[str]) -> Any:
        if model_name:
            model = torch.hub.load(
                "ultralytics/yolov5",
                "custom",
                path=model_name,
                force_reload=True
            )
        else:
            model = torch.hub.load(
                "ultralytics/yolov5",
                "yolov5s",
                pretrained=True
            )
        return model

    def score_frame(
        self,
        frame: Union[Frame, np.ndarray, list, tuple]
    ) -> Tuple[Tensor, Tensor, pd.DataFrame]:
        """
        Returns: (labels, coordinates, df_xyxy)
        """
        self.model.to(self.device)
        results = self.model([frame])

        labels: Tensor = results.xyxyn[0][:, -1]
        cord: Tensor = results.xyxyn[0][:, :-1]
        df: pd.DataFrame = results.pandas().xyxy[0]

        return labels, cord, df
    
    def class_to_label(self, x: Union[int, float]) -> str:
        return self.classes[int(x)]

    def plot_boxes(
        self,
        results: Tuple[Tensor, Tensor, pd.DataFrame],
        frame: Frame
    ) -> Frame:
        labels, cord, _ = results
        n = len(labels)

        x_shape = frame.shape[1]
        y_shape = frame.shape[0]

        for i in range(n):
            row = cord[i]
            if float(row[4]) >= 0.3:
                x1 = int(row[0] * x_shape)
                y1 = int(row[1] * y_shape)
                x2 = int(row[2] * x_shape)
                y2 = int(row[3] * y_shape)

                bgr = (0, 255, 0)
                cv2.rectangle(frame, (x1, y1), (x2, y2), bgr, 2)
                cv2.putText(
                    frame,
                    self.class_to_label(labels[i]),
                    (x1, y1),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.9,
                    bgr,
                    2
                )
        return frame

    def predict_image(self, image_path: str) -> None:
        img: Frame = cv2.imread(image_path, cv2.IMREAD_COLOR)
        results = self.score_frame(img)
        annotated = self.plot_boxes(results, img)

        parts = image_path.split("/")
        output_path = parts[0] + "/annotated-" + parts[1]
        cv2.imwrite(output_path, annotated)

    def __call__(self, image: Optional[str] = None) -> None:
        if image is not None:
            self.predict_image(image)
            return

        cap = self.get_video_capture()
        assert cap.isOpened()

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        original_fps = int(cap.get(cv2.CAP_PROP_FPS))

        frame_predictions: List[pd.DataFrame] = []
        i = 0

        skipAhead = 0
        if original_fps > (self.fps or 0):
            skipAhead = int(original_fps / self.fps)
            frame_count = int(frame_count * self.fps / original_fps)

        with tqdm(total=frame_count, desc="detecting objects: ") as pbar:
            while True:
                for _ in range(skipAhead - 1):
                    ok, _ = cap.read()
                    if not ok:
                        break

                ret, frame = cap.read()
                if not ret:
                    break

                frame = cv2.resize(frame, (width, height))

                results = self.score_frame(frame)
                df = results[-1]

                df["timestamp"] = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
                df["frame"] = i

                frame_predictions.append(df)

                i += 1
                pbar.update(1)

        cap.release()

        output_predictions = pd.concat(frame_predictions)
        output_predictions.to_csv(self.output_results, index=False)
