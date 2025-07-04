import cv2
import torch
import numpy as np

from transformers import AutoModel, AutoProcessor

from tqdm import tqdm
import os
import time

class VisionTransformer:
    def __init__ (self, fps, video_path = "", checkpoint = "openai/clip-vit-base-patch16", batch_size=256):
        #input video path
        self.video_path = video_path
        self.fps = fps

        #outputs
        self.video_embeddings = None
        self.image_embeddings = None 
        self.text_embeddings = None 
        self.scores = None
        self.reduction = None

        #model loading
        start = time.time()
        if not os.path.exists("models"):
            os.mkdir("models")
        self.model, self.processor = self.load_model(checkpoint, "models/processor.pth", "models/clip-vit-b16.pth")
        print("loading in ", time.time() - start )

        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        print("Using device: ", self.device)
        self.model.to(self.device)

        # batch size for processing frames
        self.batch_size = batch_size

    def load_video(self):
        vid = cv2.VideoCapture(self.video_path)
        assert vid.isOpened
        if self.fps is None:
            self.fps = int(vid.get(cv2.CAP_PROP_FPS))
        return vid
    
    def load_model(self, checkpoint, preprocessor_path, model_path):
        if not os.path.exists(preprocessor_path):
            processor = AutoProcessor.from_pretrained(checkpoint)
            torch.save(processor, preprocessor_path)
        else:
            processor = torch.load(preprocessor_path, weights_only=False)

        if not os.path.exists(model_path):
            model = AutoModel.from_pretrained(checkpoint)
            torch.save(model, model_path)
        else:
            model = torch.load(model_path, weights_only=False)
        return model, processor

    def get_image_features(self, images):
        with torch.no_grad():
            img_input = self.processor(images=images, text=None, padding=True, return_tensors="pt").to(self.device)
            outputs = self.model.get_image_features(**img_input)
            return outputs.detach().cpu().numpy()

    def get_text_features(self, texts):
        with torch.no_grad():
            inputs = self.processor(images=None, text=texts, padding=True, return_tensors="pt").to(self.device)
            outputs = self.model.get_text_features(**inputs)
            return outputs.detach().cpu().numpy()
    
    def get_video_features(self):
        vid = self.load_video()
        frame_count = int(vid.get(cv2.CAP_PROP_FRAME_COUNT))
        original_fps = int(vid.get(cv2.CAP_PROP_FPS))

        skip_ahead = 0
        print(type(self.fps), type(original_fps))
        if original_fps > self.fps:
            skip_ahead =  int(original_fps / self.fps) 
            frame_count = int(frame_count * self.fps / original_fps)

        embeddings = []
        frames = []
        with tqdm(total=frame_count, desc="computing video embeddings: ") as pbar:
            while vid.isOpened:
                for _ in range(skip_ahead - 1):
                    okay, frame = vid.read()
                    if not okay:
                        break
                    
                okay, frame = vid.read()
                if not okay:
                    break

                frames.append(frame)
                if len(frames) == self.batch_size:
                    batch_embeddings = self.get_image_features(frames)
                    embeddings.append(batch_embeddings)
                    frames = []
                
                pbar.update(1)

            # Process any remaining frames
            if frames:
                batch_embeddings = self.get_image_features(frames)
                embeddings.append(batch_embeddings)

        vid.release()
        return np.vstack(embeddings)
    
    def load_video_features(self, output_path, frame_count):
        embeddings = []
        for i in range(frame_count):
            embeddings.append(np.load(output_path+f"/embedding_{i}.npy"))
        self.video_embeddings =  np.vstack(embeddings)

    def cosine_similarity(self, embeds1, embeds2):
        # Reshape 1D arrays to 2D if necessary
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

    def tsne_reduction(self, embeddings, normalize=True, random_state=0, n_iter=1000, metric="cosine"):
        from sklearn.manifold import TSNE

        print("applying T-SNE on embeddings...")
        start_time = time.time()
        tsne = TSNE(random_state = random_state, n_iter = n_iter, metric = metric)

        if normalize:
            from sklearn.preprocessing import StandardScaler
            normalizer = StandardScaler()
            embeddings2d = tsne.fit_transform(normalizer.fit_transform(embeddings)) 
        else:
            embeddings2d = tsne.fit_transform(embeddings)
        print("done in ", time.time() - start_time, " seconds")

        return embeddings2d

    def pca_reduction(self, embeddings):
        from sklearn.decomposition import PCA
        from sklearn.preprocessing import StandardScaler

        print("applying PCA on embeddings...")
        start_time = time.time()
        normalizer = StandardScaler()
        pca = PCA(n_components=2)
        embeddings2d = pca.fit_transform(normalizer.fit_transform(embeddings))
        print("done in ", time.time() - start_time, " seconds")

        return embeddings2d
    
    def umap_reduction(self, embeddings, normalize=True, random_state=0):
        from sklearn.preprocessing import StandardScaler
        import umap

        print("applying uMap on embeddings...")
        start_time = time.time()
        normalizer = StandardScaler()
        u_map = umap.UMAP(n_components=2, random_state=random_state)

        if normalize:
            embeddings2d = u_map.fit_transform(normalizer.fit_transform(embeddings)) 
        else:
            embeddings2d = u_map.fit_transform(embeddings)
        print("done in ", time.time() - start_time, " seconds")
            
        return embeddings2d

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
                self.scores = np.concatenate((self.scores, text_cosine), axis = 0)
