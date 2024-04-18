from fastapi import FastAPI, File, UploadFile
from fastapi.responses import FileResponse
import os
from fastapi.middleware.cors import CORSMiddleware

import glob
from od_model import OD
from clip import ImageClassification

import cv2
import time
import numpy as np
from torchvision.io import read_video
from sklearn.metrics.pairwise import cosine_similarity

from tqdm import tqdm

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow requests from all origins to be simple
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

IMAGES_DIR = "images"
VIDEOS_DIR = "videos"

MODEL_NAME = "openai/clip-vit-base-patch16"
SAMPLE_VIDEO_PATH = "videos/goal.mp4"

def video2images(video_path):
    output_path = video_path.replace(".mp4", "")
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened:
        print(">>>>> loading video problem")

    print(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    frameCount = 0
    while cap.isOpened():
        okay, frame = cap.read()
        if not okay:
            break

        frame_to_save = cv2.resize(frame, (width, height))
        cv2.imwrite(output_path+f"/{frameCount}.png", frame_to_save)
        frameCount += 1
    cap.release()
        

def compute_cosine_similarity(video_path, query_text):    
    output_path = video_path.replace(".mp4", "")
    if not os.path.exists(output_path):
        os.mkdir(output_path)

    if not os.path.exists(f"{output_path}/0.png"):
        video2images(video_path)

    #Getting video embeddings and computing cosine similarity
    classifier = ImageClassification(video_path, MODEL_NAME)

    print("output_path:", output_path)

    similarity_scores = []

    tic = time.time()
    if os.path.exists(f"{output_path}/embedding_0.npy"):
        query_embedding = classifier.get_text_features(query_text)
        index = 0
        while True:
            if not os.path.exists(f"{output_path}/embedding_{index}.npy"):
                break
            
            frame_features = np.load(f"{output_path}/embedding_{index}.npy")
            similarity = classifier.cosine_similarity(frame_features, query_embedding)
            similarity_scores.append([index, similarity.item()])

            index += 1
        
    else:
        print("predicting...")
        classifier(texts=query_text)
        embeddings = classifier.video_embeddings
        scores = classifier.scores
        for i in range(embeddings.shape[0]):
            np.save(output_path+f"/embedding_{i}.npy", embeddings[i])
        similarity_scores = scores.tolist()

    toc = time.time() 
    print(f"done in {(toc-tic):.2f} seconds...")
    return similarity_scores

@app.get("/search")
async def search(query: str):
    similarity_scores = compute_cosine_similarity(SAMPLE_VIDEO_PATH, query)
    return {"query": query, "scores": similarity_scores}

@app.get("/image/{filename}")
async def get_image(filename: str):

    image_path = os.path.join(IMAGES_DIR, filename).replace("\\","/")
    output_path = os.path.join(IMAGES_DIR, "annotated-"+filename).replace("\\","/")

    if not os.path.exists(output_path):
        await annotate_image(image_path)

    return FileResponse(output_path)

@app.get("/image/{prediction_path}/{filename}")
async def get_image(prediction_path: str, filename: str):

    img_path = os.path.join(VIDEOS_DIR, f"{prediction_path}").replace("\\","/")+f"/{filename}"
    print(f">> {img_path}")
    return FileResponse(img_path)


@app.get("/video/{filename}")
async def get_video(filename: str):
    video_path = os.path.join(VIDEOS_DIR, filename).replace("\\","/")
    name = filename.split(".")[0]
    output_path = os.path.join(VIDEOS_DIR, f"prediction-{name}").replace("\\","/")

    if not os.path.exists(output_path) or not os.path.exists(output_path+"/0.png"):
        await annotate_video(video_path, output_path)

    paths = glob.glob(output_path+"/*.png")
    return {
        "frames": len(paths)
    }

async def annotate_video(video_path, output_path):
    
    if not os.path.exists(output_path):
        os.mkdir(output_path)

    detector = OD(capture_video=video_path, output_detection=output_path, 
                  output_results=output_path+"-output.csv", model_name="yolov5s.pt")
    detector()

async def annotate_image(image_path):
    detector = OD(capture_video="", output_detection='', output_results="", model_name='yolov5s.pt')
    detector(image=image_path)