from fastapi import FastAPI, File, UploadFile
from fastapi.exceptions import HTTPException
from fastapi.responses import FileResponse, JSONResponse
import os
from fastapi.middleware.cors import CORSMiddleware

import glob
from od_model import OD
from vision_transformer import VisionTransformer

import cv2
import time
import numpy as np
import base64

from sklearn.preprocessing import LabelEncoder

from tqdm import tqdm

import pandas as pd

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

#MODEL_NAME = "openai/clip-vit-base-patch16"
#MODEL_NAME = "google/owlvit-base-patch32"
MODEL_NAME = "google/owlv2-base-patch16-ensemble"
SAMPLE_VIDEO_PATH = "videos/Y6R7T.mp4"

IMAGE_CROP_QUERY = "<image-loaded>"
OUTPUT_CROP_IMAGE = "images/search-image.png"

def video2images(video_path):
    output_path = video_path.replace(".mp4", "")
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        print(">>>>> loading video problem")
        return

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    frameCount = 0
    with tqdm(total=total_count, desc="saving original frames: ") as pbar:
        while cap.isOpened():
            okay, frame = cap.read()
            if not okay:
                break

            frame_to_save = cv2.resize(frame, (width, height))
            cv2.imwrite(output_path+f"/{frameCount}.png", frame_to_save)
            frameCount += 1
            pbar.update(1)

    cap.release()
        
        
def compute_cosine_similarity(video_path, query_text, reduction = False):    
    output_path = video_path.replace(".mp4", "")
    if not os.path.exists(output_path):
        os.mkdir(output_path)

    if not os.path.exists(f"{output_path}/0.png"):
        video2images(video_path)

    #Getting video embeddings and computing cosine similarity
    classifier = VisionTransformer(video_path, MODEL_NAME)

    print("output_path:", output_path)

    video_features = []
    similarity_scores = []

    tic = time.time()
    if not os.path.exists(f"{output_path}/embedding_0.npy"):
        print("computing embeddings...")
        classifier(texts=query_text)
        embeddings = classifier.video_embeddings

        with tqdm(total=embeddings.shape[0], desc="saving embeddings: ") as pbar:
            for i in range(embeddings.shape[0]):
                np.save(output_path+f"/embedding_{i}.npy", embeddings[i])
                pbar.update(1)

    if query_text == IMAGE_CROP_QUERY:

        print("reading image and computing features")
        query_img = cv2.imread(OUTPUT_CROP_IMAGE)
        query_embedding = classifier.get_image_features(query_img)
    else:
        query_embedding = classifier.get_text_features(query_text)
    print("query_shape:", query_embedding.shape)
    index = 0
    while True:
        if not os.path.exists(f"{output_path}/embedding_{index}.npy"):
            break
        
        frame_features = np.load(f"{output_path}/embedding_{index}.npy")
        if reduction:
            video_features.append(frame_features)
        similarity = classifier.cosine_similarity(frame_features, query_embedding)
        similarity_scores.append([index, similarity.item()])

        index += 1

    toc = time.time() 
    print(f"done in {(toc-tic):.2f} seconds...")

    if reduction:
        return similarity_scores, classifier.tsne_reduction(np.array(video_features))
    else:
        return similarity_scores



@app.get("/search")
async def search(query: str):
    similarity_scores, tsne = compute_cosine_similarity(SAMPLE_VIDEO_PATH, query, True)
    return {"query": query, "scores": similarity_scores, "tsne": [{'x': float(tsne[i, 0]), 'y': float(tsne[i, 1])} for i in range(len(tsne))]}  # add tsne scores


@app.get("/search/image/{folder}/{image_path}")
async def image_search(folder: str, image_path: str, xmin: int, xmax: int, ymin: int, ymax: int):
    image = cv2.imread("videos/"+folder+"/"+image_path)
    cropped_image = await crop_image(image, [xmin, ymin, xmax, ymax])
    cv2.imwrite(OUTPUT_CROP_IMAGE, cropped_image)

    return {
        "path": "images",
        "name": "search-image.png"
    }


@app.get("/image/{filename}")
async def get_image(filename: str):
    image_path = os.path.join(IMAGES_DIR, filename).replace("\\","/")
    output_path = os.path.join(IMAGES_DIR, "annotated-"+filename).replace("\\","/")

    if not os.path.exists(output_path):
        await annotate_image(image_path)

    return FileResponse(output_path)


@app.get("/image/{prediction_path}/{filename}")
async def get_image(prediction_path: str, filename: str):
    if prediction_path == "images":
        img_path = f"images/{filename}"
    else:
        img_path = os.path.join(VIDEOS_DIR, f"{prediction_path}").replace("\\","/")+f"/{filename}"
    return FileResponse(img_path)


@app.post("/upload_png/")
async def upload_png(image_data: dict):
    data_url = image_data.get('image_data', '')
    
    image_data_str = data_url.split(",")[1]
    image_bytes = base64.b64decode(image_data_str)
    image_array = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    cv2.imwrite(OUTPUT_CROP_IMAGE, img)

    similarity_scores, tsne = compute_cosine_similarity(SAMPLE_VIDEO_PATH, IMAGE_CROP_QUERY, reduction=True)
    return {"query": IMAGE_CROP_QUERY, "scores": similarity_scores, "tsne": [{'x': float(tsne[i, 0]), 'y': float(tsne[i, 1])} for i in range(len(tsne))]}


@app.get("/video/{filename}")
async def get_video(filename: str):
    video_path = os.path.join(VIDEOS_DIR, filename).replace("\\","/")
    name = filename.split(".")[0]
    output_path = os.path.join(VIDEOS_DIR, f"prediction-{name}").replace("\\","/")

    if not os.path.exists(output_path) or not os.path.exists(output_path+"/0.png"):
        await annotate_video(video_path, output_path)

    paths = glob.glob(output_path+"/*.png")
    result = pd.read_csv(output_path+"-output.csv")
    result['timestamp'] = LabelEncoder().fit_transform(result['timestamp'].values)
    result['class'] = LabelEncoder().fit_transform(result['name'].values) 
    return {
        "frames": len(paths),
        "result": result.to_dict(orient="records")
    }


async def annotate_video(video_path, output_path):
    if not os.path.exists(output_path):
        os.mkdir(output_path)

    detector = OD(capture_video=video_path, output_detection=output_path, 
                  output_results=output_path+"-output.csv", model_name="yolov5s.pt")
    return detector()


async def annotate_image(image_path):
    detector = OD(capture_video="", output_detection='', output_results="", model_name='yolov5s.pt')
    detector(image=image_path)


async def crop_image(image, bbox):
    x_min, y_min, x_max, y_max = bbox
    x_min, y_min, x_max, y_max = int(x_min), int(y_min), int(x_max), int(y_max)
    cropped_image = image[y_min:y_max, x_min:x_max]
    
    return cropped_image
