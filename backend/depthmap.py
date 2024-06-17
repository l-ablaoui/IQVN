import cv2
import torch
import numpy as np

from tqdm import tqdm

from transformers import GLPNImageProcessor, GLPNForDepthEstimation

class DepthMapEstimation:
    def __init__(self, video_path="", checkpoint="vinvino02/glpn-nyu"):
        #input video
        self.video_path = video_path

        #output depth video
        self.depth_video = None
        self.fps = 0

        #load model
        self.preprocessor = GLPNImageProcessor.from_pretrained(checkpoint)
        self.depth_model = GLPNForDepthEstimation.from_pretrained(checkpoint)
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.depth_model.to(self.device)
        print("Using device: ", self.device)
    
    def load_video(self):
        return cv2.VideoCapture(self.video_path)
        
    def get_image_depth(self, image):
        inputs = self.preprocessor(images=image, return_tensors="pt").to(self.device) #preprocessing the image
        with torch.no_grad():
            outputs = self.depth_model(**inputs) #depth map inference
        initial_depth = torch.nn.functional.interpolate( #rescaling to original size
            outputs.predicted_depth.unsqueeze(1),
            size=(image.shape[0], image.shape[1]),
            mode="bicubic",
            align_corners=False,
        ).detach().squeeze().cpu().numpy() 
        depth_map = ((initial_depth - initial_depth.min()) / (initial_depth.max() - initial_depth.min()) * 255).astype("uint8") #normalization between 0 and 255
        depth_map = 255 - depth_map #inversing the depth
        
        return depth_map
    
    def get_depth_video(self):
        vid = self.load_video() #load video
            
        self.fps = vid.get(cv2.CAP_PROP_FPS) #keeping fps for output saving purposes
        frameCount = int(vid.get(cv2.CAP_PROP_FRAME_COUNT))
        frameWidth = int(vid.get(cv2.CAP_PROP_FRAME_WIDTH))
        frameHeight = int(vid.get(cv2.CAP_PROP_FRAME_HEIGHT))

        self.depth_video = np.zeros((frameCount, frameHeight, frameWidth), dtype="uint8") #init output

        with tqdm(total=frameCount, desc="Processing video depth map: ") as pbar:
            for i in range(frameCount):
                okay, frame = vid.read()
                if not okay:
                    break
                self.depth_video[i, :, :] = self.get_image_depth(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)) #inference on RGB frames
                pbar.update(1)
        print("Done")

    def save_depth_video(self, save_path, save_video=False):
        if self.depth_video is None:
            return
        frameCount, frameHeight, frameWidth = self.depth_video.shape

        if save_video:
            depth_video = cv2.VideoWriter(
                f"{save_path}.mp4", 
                cv2.VideoWriter_fourcc(*"mp4v"), 
                self.fps, 
                (frameWidth, frameHeight), 
                isColor=False  #isColor sets to false to have one channel
                )
        
        with tqdm(total=frameCount, desc="Saving video depth map: ") as pbar:
            for i in range(frameCount):
                if save_video:
                    depth_video.write(self.depth_video[i, :, :])
                    depth_video.release()
                else:
                    cv2.imwrite(save_path+f"/depth_frame_{i}.png", self.depth_video[i, :, :])
                pbar.update(1)
        print("Done")

    def __call__(self, save_path, save_video=False):
        vid = self.load_video() #load video
        
        self.fps = vid.get(cv2.CAP_PROP_FPS) #keeping fps for output saving purposes
        frameCount = int(vid.get(cv2.CAP_PROP_FRAME_COUNT))
        frameWidth = int(vid.get(cv2.CAP_PROP_FRAME_WIDTH))
        frameHeight = int(vid.get(cv2.CAP_PROP_FRAME_HEIGHT))

        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        if save_video:
            out = cv2.VideoWriter(f"{save_path}.mp4", fourcc, self.fps, (frameWidth, frameHeight), isColor=False)

        #TODO Declare output video in the save_path, same fps, height and width but grayscaled    

        with tqdm(total=frameCount, desc="Processing video depth map: ") as pbar:
            for i in range(frameCount):
                okay, frame = vid.read()
                if not okay:
                    break
                depth_frame = self.get_image_depth(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)) #inference on RGB frames
                if save_video:
                    out.write(cv2.cvtColor(depth_frame, cv2.COLOR_RGB2GRAY))
                else:
                    cv2.imwrite(save_path+f"/depth_frame_{i}.png", depth_frame)

                #TODO save frame by frame in the depth video
                pbar.update(1)