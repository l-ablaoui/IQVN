import torch
import numpy as np
import pandas as pd
import cv2
from time import time

from tqdm import tqdm

class OD:

    def __init__(self, capture_video, output_results, model_name):
        """
        Initializes the class with youtube url and output file.
        :param url: Has to be as youtube URL,on which prediction is made.
        :param out_file: A valid output file name.
        """
        self.capture_video = capture_video
        self.output_results = output_results
        self.model = self.load_model(model_name)
        self.classes = self.model.names
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        print("Using Device: ", self.device)

    def get_video_capture(self):
        """
        Creates a new video streaming object to extract video frame by frame to make prediction on.
        :return: opencv2 video capture object, with lowest quality frame available for video.
        """
    
        return cv2.VideoCapture(self.capture_video)

    def load_model(self, model_name):
        """
        Loads Yolo5 model from pytorch hub.
        :return: Trained Pytorch model.
        """
        if model_name:
            model = torch.hub.load('ultralytics/yolov5', 'custom', path=model_name, force_reload=True)
        else:
            model = torch.hub.load('ultralytics/yolov5', 'yolov5s', pretrained=True)
        return model

    def score_frame(self, frame):
        """
        Takes a single frame as input, and scores the frame using yolo5 model.
        :param frame: input frame in numpy/list/tuple format.
        :return: Labels and Coordinates of objects detected by model in the frame.
        """
        self.model.to(self.device)
        frame = [frame]
        results = self.model(frame)
        labels, cord = results.xyxyn[0][:, -1], results.xyxyn[0][:, :-1]
        return labels, cord, results.pandas().xyxy[0]

    def class_to_label(self, x):
        """
        For a given label value, return corresponding string label.
        :param x: numeric label
        :return: corresponding string label
        """
        return self.classes[int(x)]

    def plot_boxes(self, results, frame):
        """
        Takes a frame and its results as input, and plots the bounding boxes and label on to the frame.
        :param results: contains labels and coordinates predicted by model on the given frame.
        :param frame: Frame which has been scored.
        :return: Frame with bounding boxes and labels ploted on it.
        """
        labels, cord, _ = results
        n = len(labels)
        x_shape, y_shape = frame.shape[1], frame.shape[0]
        for i in range(n):
            row = cord[i]
            if row[4] >= 0.3:
                x1, y1, x2, y2 = int(row[0]*x_shape), int(row[1]*y_shape), int(row[2]*x_shape), int(row[3]*y_shape)
                bgr = (0, 255, 0)
                cv2.rectangle(frame, (x1, y1), (x2, y2), bgr, 2)
                cv2.putText(frame, self.class_to_label(labels[i]), (x1, y1), cv2.FONT_HERSHEY_SIMPLEX, 0.9, bgr, 2)

        return frame
    
    def predict_image(self, image_path):

        img = cv2.imread(image_path, cv2.IMREAD_COLOR)  
        results = self.score_frame(img)
        img_annotated = self.plot_boxes(results, img)
        path_s = image_path.split("/")
        output_path = path_s[0]+"/annotated-"+path_s[1]
        cv2.imwrite(output_path, img_annotated)

        

    def __call__(self, image=None):
        """
        This function is called when class is executed, it runs the loop to read the video frame by frame,
        and write the output into a new file.
        :return: void
        """

        if image is not None:
            self.predict_image(image)
            return 

        cap = self.get_video_capture()
        assert cap.isOpened()

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        frame_predictions = []

        with tqdm(total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT)), desc="detecting objects: ") as pbar:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                frame = cv2.resize(frame, (width, height))
                
                results = self.score_frame(frame)
                df_results = results[-1]
                df_results['timestamp'] = cap.get(cv2.CAP_PROP_POS_MSEC)/1000.0
                frame_predictions.append(df_results)

                pbar.update(1)

        cap.release()
        
        output_predictions = pd.concat(frame_predictions)
        output_predictions.to_csv(self.output_results, index=False)
