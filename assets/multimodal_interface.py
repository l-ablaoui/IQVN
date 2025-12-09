import torch
import numpy as np
import cv2

# Add the 'assets' directory to sys.path
import sys
from pathlib import Path
# add the directory that *contains* 'imagebind' to the import path
sys.path.append(str(Path(__file__).resolve().parent / "ImageBind"))

from imagebind import data
from imagebind.models import imagebind_model
from imagebind.models.imagebind_model import ModalityType

class MultiModal:
    def __init__ (self):
        #model loading
        self.model = imagebind_model.imagebind_huge(pretrained=True)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print("Using device: ", self.device)
        self.model.to(self.device)

        #convert model to half precision (float16)
        if self.device == "cuda":
            self.model = self.model.half()
    
    def get_image_features(self, images):
        inputs = {}
            
        if images is not None:
            if not isinstance(images, (list, tuple)):
                inputs[ModalityType.VISION] = self.preprocess_frames([images], self.device)
            else:
                inputs[ModalityType.VISION] = self.preprocess_frames(images, self.device)

        return self.model(inputs)[ModalityType.VISION]

    def get_text_features(self, texts):
        inputs = {}

        if texts is not None:
            if not isinstance(texts, (list, tuple, np.ndarray)):
                inputs[ModalityType.TEXT] = data.load_and_transform_text([texts], self.device)
            else:
                inputs[ModalityType.TEXT] = data.load_and_transform_text(texts, self.device)
    
        return self.model(inputs)[ModalityType.TEXT]

    def get_audio_features(self, audios):
        inputs = {}

        if audios is not None:
            if not isinstance(audios, (list, tuple, np.ndarray)):
                inputs[ModalityType.AUDIO] = data.load_and_transform_audio_data([audios], device=self.device).half()
            else:
                inputs[ModalityType.AUDIO] = data.load_and_transform_audio_data(audios, device=self.device).half()

        return self.model(inputs)[ModalityType.AUDIO]
    
    def preprocess_frames(self, frames, device):
        #convert list of BGR uint8 images to a single NumPy array: (N, H, W, C)
        frames_np = np.stack([
            cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB), (224, 224)).astype(np.float16) / 255.0
            for frame in frames
        ]) #shape: (N, 224, 224, 3)
        frames_np = frames_np.transpose(0, 3, 1, 2) #convert to CHW format: (N, C, H, W)
        batch_tensor = torch.from_numpy(frames_np).to(dtype=torch.float16, device=device)  #convert to torch tensor 
        batch_tensor = batch_tensor.unsqueeze(1) #add temporal dimension: (N, 1, C, H, W)
        return batch_tensor