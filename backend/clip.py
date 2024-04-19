import cv2
import torch
import numpy as np

from transformers import CLIPModel, CLIPProcessor

from tqdm import tqdm

class ImageClassification:
    def __init__ (self, video_path = "", clip_checkpoint = "openai/clip-vit-base-patch32"):
        #input video path
        self.video_path = video_path

        #outputs
        self.video_embeddings = None
        self.image_embeddings = None 
        self.text_embeddings = None 
        self.scores = None

        #model loading
        self.clip_preprocessor = CLIPProcessor.from_pretrained(clip_checkpoint)
        self.clip_model = CLIPModel.from_pretrained(clip_checkpoint)
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        print("Using device: ", self.device)
        self.clip_model.to(self.device)

    def load_video(self):
        return cv2.VideoCapture(self.video_path)
    
    def get_image_features(self, images):
        with torch.no_grad():
            img_input = self.clip_preprocessor(images=images, text=None, padding=True, return_tensors="pt").to(self.device)
            outputs = self.clip_model.get_image_features(**img_input)
            return outputs.detach().cpu().numpy()

    def get_text_features(self, texts):
        with torch.no_grad():
            inputs = self.clip_preprocessor(images=None, text=texts, padding=True, return_tensors="pt").to(self.device)
            outputs = self.clip_model.get_text_features(**inputs)
            return outputs.detach().cpu().numpy()
    
    def get_video_features(self):
        vid = self.load_video()
        frameCount = int(vid.get(cv2.CAP_PROP_FRAME_COUNT))

        embeddings = []
        with tqdm(total=frameCount, desc="computing video embeddings: ") as pbar:
            while vid.isOpened:
                okay, frame = vid.read()
                if not okay:
                    break
                embeddings.append(self.get_image_features(frame))
                pbar.update(1)
        
        vid.release()
        return np.array(embeddings).squeeze(1)
    
    def cosine_similarity(self, embeds1, embeds2):
        # Reshape 1D arrays to 2D if necessary
        print(embeds1.shape, embeds2.shape)
        if embeds1.ndim == 1:
            embeds1 = embeds1.reshape(1, -1)
        if embeds2.ndim == 1:
            embeds2 = embeds2.reshape(1, -1)

        # Compute the dot product between the embeddings
        dot_product = np.dot(embeds1, embeds2.T)

        # Compute the L2 norms of the embeddings
        norm_x = np.linalg.norm(embeds1, axis=1, keepdims=True)
        norm_y = np.linalg.norm(embeds2, axis=1, keepdims=True)

        # Compute the cosine similarity
        cosine_similarity = dot_product / (norm_x * norm_y.T)

        return cosine_similarity
    
    def __call__(self, images=None, texts=None):
        self.video_embeddings = self.get_video_features()
        image_cosine = None
        text_cosine = None

        if images is not None:
            self.image_embeddings = self.get_image_features(images)
            image_cosine = self.cosine_similarity(self.video_embeddings, self.image_embeddings)
            self.scores = image_cosine
        
        if texts is not None:
            self.text_embeddings = self.get_text_features(texts)
            text_cosine = self.cosine_similarity(self.video_embeddings, self.text_embeddings)
            if images is None:
                self.scores = text_cosine 
            else:
                self.scores = np.concatenate(self.scores, text_cosine, axis = 0)
        