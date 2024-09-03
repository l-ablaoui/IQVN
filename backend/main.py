import uvicorn
from fastapi import FastAPI, File, UploadFile
from fastapi.exceptions import HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

import argparse
import json

import time
import base64
from sklearn.preprocessing import LabelEncoder
import pandas as pd

from object_detection import ObjectDetector
from vision_transformer import VisionTransformer
from depthmap import DepthMapEstimation

from utilities import *

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow requests from all origins to be simple
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

IMAGES_DIR = "images"
MODEL_NAME = "openai/clip-vit-base-patch16"
IMAGE_CROP_QUERY = "<image-loaded>"
OUTPUT_CROP_IMAGE = "images/search-image.png"
MAX_NB_CLUSTERS = 20
EMBEDDINGS_LENGTH = 512
FPS = 10

CONFIG_FILE = "config.json"

def read_config ():
    with open(CONFIG_FILE, "r") as json_file:
        config = json.load(json_file)
    return config

def write_config (config):
    with open(CONFIG_FILE, "w") as json_file:
        json.dump(config, json_file)
        json_file.flush()

current_video_path = "/videos/video_0.mp4"

async def compute_embeddings_dim_reduction(video_path):  
    output_path = video_path.replace(".mp4", "")
    if not os.path.exists(output_path):
        os.mkdir(output_path)

    if not os.path.exists(f"{output_path}/0.png"):
        await video2images(video_path, FPS)

    #Getting video embeddings 
    classifier = VisionTransformer(FPS, video_path, MODEL_NAME)

    print("output_path:", output_path)
    tic = time.time()

    if not os.path.exists(f"{output_path}/embedding_0.npy"):
        print("computing embeddings...")
        classifier()
        embeddings = classifier.video_embeddings

        with tqdm(total=embeddings.shape[0], desc="saving embeddings: ") as pbar:
            for i in range(embeddings.shape[0]):
                np.save(output_path+f"/embedding_{i}.npy", embeddings[i])
                pbar.update(1)
    else:
        vid = cv2.VideoCapture(video_path)
        frameCount = int(int(vid.get(cv2.CAP_PROP_FRAME_COUNT)) * FPS / int(vid.get(cv2.CAP_PROP_FPS)))
        classifier.load_video_features(output_path, frameCount)
        vid.release()
        
    if not os.path.exists(f"{output_path}/tsne_reduction.npy"):
        if classifier.video_embeddings is None:
            classifier()
        tsne = classifier.tsne_reduction(classifier.video_embeddings)
        np.save(output_path+f"/tsne_reduction.npy", tsne)

    if not os.path.exists(f"{output_path}/pca_reduction.npy"):
        if classifier.video_embeddings is None:
            classifier()
        pca = classifier.pca_reduction(classifier.video_embeddings)
        np.save(output_path+f"/pca_reduction.npy", pca)

    if not os.path.exists(f"{output_path}/umap_reduction.npy"):
        if classifier.video_embeddings is None:
            classifier()
        umap = classifier.umap_reduction(classifier.video_embeddings)
        np.save(output_path+f"/umap_reduction.npy", umap)
    
    tsne = np.load(output_path+f"/tsne_reduction.npy")
    pca = np.load(output_path+f"/pca_reduction.npy")
    umap = np.load(output_path+f"/umap_reduction.npy")

    tsne_clusters = get_clusters(tsne)
    pca_clusters = get_clusters(pca)
    umap_clusters = get_clusters(umap)

    tsne_cluster_frames = []
    pca_cluster_frames = []
    umap_cluster_frames = []

    sorted_clusters, _, closest_vectors = get_centroids(tsne_clusters, tsne, MAX_NB_CLUSTERS)
    for cls, _ in sorted_clusters:
        tsne_cluster_frames.append({"cluster": int(cls), "centroid": int(closest_vectors[cls])})
    
    sorted_clusters, _, closest_vectors = get_centroids(pca_clusters, pca, MAX_NB_CLUSTERS)
    for cls, _ in sorted_clusters:
        pca_cluster_frames.append({"cluster": int(cls), "centroid": int(closest_vectors[cls])})
    
    sorted_clusters, _, closest_vectors = get_centroids(umap_clusters, umap, MAX_NB_CLUSTERS)
    for cls, _ in sorted_clusters:
        umap_cluster_frames.append({"cluster": int(cls), "centroid": int(closest_vectors[cls])})

    toc = time.time() 
    print(f"done in {(toc-tic):.2f} seconds...")

    del classifier
    return tsne, pca, umap, tsne_clusters, pca_clusters, umap_clusters, tsne_cluster_frames,\
         pca_cluster_frames, umap_cluster_frames


async def compute_cosine_similarity(video_path, query_text):    
    output_path = video_path.replace(".mp4", "")
    if not os.path.exists(output_path):
        os.mkdir(output_path)

    if not os.path.exists(f"{output_path}/0.png"):
        await video2images(video_path, FPS)

    classifier = VisionTransformer(FPS, video_path, MODEL_NAME)

    print("output_path:", output_path)
    tic = time.time()

    #save embeddings in file if not there already
    if not os.path.exists(f"{output_path}/embedding_0.npy"):
        print("computing embeddings...")
        classifier(texts=query_text)
        embeddings = classifier.video_embeddings

        with tqdm(total=embeddings.shape[0], desc="saving embeddings: ") as pbar:
            for i in range(embeddings.shape[0]):
                np.save(output_path+f"/embedding_{i}.npy", embeddings[i])
                pbar.update(1)
        del embeddings

    #query type (text/image)
    if query_text == IMAGE_CROP_QUERY:
        print("reading image and computing features")
        query_img = cv2.imread(OUTPUT_CROP_IMAGE)
        query_embedding = classifier.get_image_features(query_img)
    else:
        query_embedding = classifier.get_text_features(query_text)
    print("query_shape:", query_embedding.shape)

    #computing similarity scores and piling
    similarity_scores = []
    index = 0
    while True:
        if not os.path.exists(f"{output_path}/embedding_{index}.npy"):
            break
        
        frame_features = np.load(f"{output_path}/embedding_{index}.npy")
        similarity = classifier.cosine_similarity(frame_features, query_embedding)
        similarity_scores.append([index, similarity.item()])

        index += 1

    toc = time.time() 
    print(f"done in {(toc-tic):.2f} seconds...")

    del classifier, 
    return similarity_scores

async def perform_object_detection(video_path, output_path):
    detector = ObjectDetector(video_path=video_path, output_results=output_path+"-output.csv", model_name="yolov5s.pt", fps=FPS)
    return detector()

async def compute_depth_map(video_path, output_path):
    if not os.path.exists(output_path):
        os.mkdir(output_path)

    depth_estimator = DepthMapEstimation(FPS, video_path=video_path)
    depth_estimator(save_path=output_path)

@app.get("/search")
async def search(query: str):
    global current_video_path

    similarity_scores = await compute_cosine_similarity(current_video_path, query)

    return {
        "query": query, 
        "scores": similarity_scores
    }

@app.get("/image/{prediction_path}/{filename}")
async def get_image(prediction_path: str, filename: str):
    if prediction_path == "images":
        img_path = f"images/{filename}"
    else:
        img_path = os.path.join(read_config()["videos_dir"], f"{prediction_path}").replace("\\","/")+f"/{filename}"
    return FileResponse(img_path)

@app.get("/video/")
async def get_video_names():
    video_names = find_mp4_files("./videos")
    video_names.sort()
    return video_names

@app.post("/select_video/")
async def select_video(name_data: dict):
    global current_video_path

    video_name = name_data.get("video_name", "")
    current_video_path = read_config()["videos_dir"] + "/" + video_name

    vid = cv2.VideoCapture(current_video_path)
    if vid.isOpened:
        output_path = current_video_path.replace(".mp4", "")
        if not os.path.exists(output_path):
            os.mkdir(output_path)

        if not os.path.exists(f"{output_path}/0.png"):
            await video2images(current_video_path, FPS)

        frameCount = int(vid.get(cv2.CAP_PROP_FRAME_COUNT))
        originalFps = int(vid.get(cv2.CAP_PROP_FPS))
        frameCount = int(frameCount * FPS / originalFps)

        return { 
            "frame_count": frameCount, 
            "fps": FPS #int(vid.get(cv2.CAP_PROP_FPS))
        }

@app.get("/video/objects/{filename}")
async def get_objects_in_video(filename: str):
    video_path = os.path.join(read_config()["videos_dir"], filename).replace("\\","/")
    name = filename.split(".")[0]
    output_path = os.path.join(read_config()["videos_dir"], f"{name}").replace("\\","/")

    if not os.path.exists(output_path+"-output.csv"):
        await perform_object_detection(video_path, output_path)

    paths = glob.glob(output_path+"/*.png")
    result = pd.read_csv(output_path+"-output.csv")
    result['timestamp'] = LabelEncoder().fit_transform(result['timestamp'].values)
    result['class'] = LabelEncoder().fit_transform(result['name'].values) 
    return {
        "frames": len(paths),
        "result": result.to_dict(orient="records")
    }

@app.get("/video/depth/{filename}")
async def get_depth_video(filename: str):
    video_path = os.path.join(read_config()["videos_dir"], filename).replace("\\","/")
    name = filename.split(".")[0]
    output_path = os.path.join(read_config()["videos_dir"], f"depth-{name}").replace("\\","/")

    if not os.path.exists(output_path) or not os.path.exists(output_path+"/depth_frame_0.png"):
        await compute_depth_map(video_path, output_path)

    paths = glob.glob(output_path+"/depth_frame_*.png")
    return { "frames": len(paths) }

@app.get("/video/embeddings/{filename}")
async def get_video_embeddings(filename: str):
    print(filename)
    video_path = os.path.join(read_config()["videos_dir"], filename).replace("\\","/")
    print(video_path)
    tsne, pca, umap, tsne_clusters, pca_clusters, umap_clusters, tsne_cluster_frames, \
        pca_cluster_frames, umap_cluster_frames = await compute_embeddings_dim_reduction(video_path)
    
    return {
        "tsne": [{'x': float(tsne[i, 0]), 'y': float(tsne[i, 1])} for i in range(len(tsne))],
        "pca": [{'x': float(pca[i, 0]), 'y': float(pca[i, 1])} for i in range(len(pca))],
        "umap": [{'x': float(umap[i, 0]), 'y': float(umap[i, 1])} for i in range(len(umap))],
        "tsne_clusters": [int(tsne_clusters[i]) for i in range(len(tsne_clusters))],
        "pca_clusters": [int(pca_clusters[i]) for i in range(len(pca_clusters))],
        "umap_clusters": [int(umap_clusters[i]) for i in range(len(umap_clusters))],
        "tsne_cluster_frames": tsne_cluster_frames,
        "pca_cluster_frames": pca_cluster_frames,
        "umap_cluster_frames": umap_cluster_frames
    }

@app.get("/video/{filename}/fps")
async def get_video_fps(filename: str):
    video_path = os.path.join(read_config()["videos_dir"], filename).replace("\\","/")
    vid = cv2.VideoCapture(video_path)
    if (not vid.isOpened):
        return { "fps": -1 }
    else:
        return { "fps": FPS } #int(vid.get(cv2.CAP_PROP_FPS)) }
    
@app.post("/upload_png/")
async def upload_png(image_data: dict):
    global current_video_path

    data_url = image_data.get('image_data', '')
    
    image_data_str = data_url.split(",")[1]
    image_bytes = base64.b64decode(image_data_str)
    image_array = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    if not os.path.exists("images/"):
        os.mkdir("images")
    async with aiofiles.open(OUTPUT_CROP_IMAGE, mode='wb') as file:
        await file.write(cv2.imencode('.png', img)[1].tobytes())

    similarity_scores = await compute_cosine_similarity(current_video_path, IMAGE_CROP_QUERY)
    
    return {
        "query": IMAGE_CROP_QUERY, 
        "scores": similarity_scores
    }

@app.post("/log/")
async def write_log(log_data: dict):
    if (read_config()["log_interaction"]):
        log_file = open(read_config()["log_file_name"], "a+")
        log_file.write(log_data.get("interaction_log", "") + "\n")
        log_file.flush()
        print(log_data.get("interaction_log", ""))

        log_file.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Video analysis fastAPI server")
    parser.add_argument("-d", "--directory", default="videos", type=dir_path, action="store")
    parser.add_argument("-p", "--port", default=8000, type=int, action="store")
    parser.add_argument("-l", "--log", action="store_true")
    parser.add_argument("-n", "--log_file_name", default="log_file.txt", type=str, action="store")

    args = parser.parse_args()
    config = {
        "videos_dir" : args.directory, 
        "log_interaction" : args.log,
        "log_file_name" : args.log_file_name, 
        "port" : args.port
    }
    write_config(config)
    print(read_config()["log_interaction"])

    uvicorn.run("main:app", port=config["port"], reload=True, log_level="info")
    os.remove(CONFIG_FILE)
    