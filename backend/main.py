from fastapi import FastAPI, File, UploadFile
from fastapi.exceptions import HTTPException
from fastapi.responses import FileResponse, JSONResponse
import os
from fastapi.middleware.cors import CORSMiddleware

import glob
from od_model import OD
from vision_transformer import VisionTransformer
from depthmap import DepthMapEstimation

import cv2
import time
import numpy as np
import base64

from sklearn.preprocessing import LabelEncoder
from sklearn.cluster import DBSCAN
from sklearn.neighbors import NearestNeighbors

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

MODEL_NAME = "openai/clip-vit-base-patch16"
#MODEL_NAME = "google/owlvit-base-patch32"
#MODEL_NAME = "google/owlv2-base-patch16-ensemble"
current_video_path = "./videos/cut5.mp4"

IMAGE_CROP_QUERY = "<image-loaded>"
OUTPUT_CROP_IMAGE = "images/search-image.png"
MAX_NB_CLUSTERS = 20

# save image as individual frames in the folder to facilitate fetching
def video2images(video_path):
    output_path = video_path.replace(".mp4", "")
    vid = cv2.VideoCapture(video_path)

    if not vid.isOpened():
        print(">>>>> loading video problem")
        return

    width = int(vid.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(vid.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_count = int(vid.get(cv2.CAP_PROP_FRAME_COUNT))

    frameCount = 0
    with tqdm(total=total_count, desc="saving original frames: ") as pbar:
        while vid.isOpened():
            okay, frame = vid.read()
            if not okay:
                break

            frame_to_save = cv2.resize(frame, (width, height))
            cv2.imwrite(output_path+f"/{frameCount}.png", frame_to_save)
            frameCount += 1
            pbar.update(1)

    vid.release()

def compute_embeddings_dim_reduction(video_path):  
    output_path = video_path.replace(".mp4", "")
    if not os.path.exists(output_path):
        os.mkdir(output_path)

    if not os.path.exists(f"{output_path}/0.png"):
        video2images(video_path)

    #Getting video embeddings 
    classifier = VisionTransformer(video_path, MODEL_NAME)

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

    return tsne, pca, umap, tsne_clusters, pca_clusters, umap_clusters, tsne_cluster_frames,\
         pca_cluster_frames, umap_cluster_frames


def compute_cosine_similarity(video_path, query_text):    
    output_path = video_path.replace(".mp4", "")
    if not os.path.exists(output_path):
        os.mkdir(output_path)

    if not os.path.exists(f"{output_path}/0.png"):
        video2images(video_path)

    classifier = VisionTransformer(video_path, MODEL_NAME)

    print("output_path:", output_path)
    tic = time.time()

    #save embeddings and tsne reduction in file if not there already
    if not os.path.exists(f"{output_path}/embedding_0.npy"):
        print("computing embeddings...")
        classifier(texts=query_text)
        embeddings = classifier.video_embeddings

        with tqdm(total=embeddings.shape[0], desc="saving embeddings: ") as pbar:
            for i in range(embeddings.shape[0]):
                np.save(output_path+f"/embedding_{i}.npy", embeddings[i])
                pbar.update(1)

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

    return similarity_scores
 
def find_mp4_files(relative_path):
    # Get the absolute path of the directory
    abs_path = os.path.abspath(relative_path)
    
    # Use glob to find all .mp4 files in the directory
    mp4_files = glob.glob(os.path.join(abs_path, '*.mp4'))
    
    # Extract the file names from the full paths
    mp4_file_names = [os.path.basename(file) for file in mp4_files]
    
    return mp4_file_names

async def annotate_video(video_path, output_path):
    detector = OD(capture_video=video_path, output_results=output_path+"-output.csv", \
                model_name="yolov5s.pt")
    return detector()

#apply bounding box to the image pixels
async def crop_image(image, bbox):
    x_min, y_min, x_max, y_max = bbox
    x_min, y_min, x_max, y_max = int(x_min), int(y_min), int(x_max), int(y_max)
    cropped_image = image[y_min:y_max, x_min:x_max]
    
    return cropped_image

async def compute_depth_map(video_path, output_path):
    if not os.path.exists(output_path):
        os.mkdir(output_path)

    depth_estimator = DepthMapEstimation(video_path=video_path)
    depth_estimator(save_path=output_path)

# Function to calculate the centroid
def calculate_centroid(indices, vectors):
    cluster_vectors = vectors[indices]
    centroid = np.mean(cluster_vectors, axis=0)
    return centroid

# Function to find the index of the vector closest to the centroid
def closest_vector_index(centroid, indices, vectors):
    cluster_vectors = vectors[indices]
    distances = np.linalg.norm(cluster_vectors - centroid, axis=1)
    closest_index = indices[np.argmin(distances)]
    return closest_index

def choose_eps(vectors, k=4, percentile=90):
    neigh = NearestNeighbors(n_neighbors=k)
    nbrs = neigh.fit(vectors)
    distances, _ = nbrs.kneighbors(vectors)
    distances = np.sort(distances[:, k-1], axis=0)
    eps = np.percentile(distances, percentile)
    return eps

def get_clusters(vectors, min_samples=5):
    eps = choose_eps(vectors, min_samples, 100)
    clusters = DBSCAN(eps=eps, min_samples=min_samples).fit(vectors).labels_
    return clusters

def get_centroids(clusters, vectors, max_clusters):
    # Determine the number of unique classes
    unique_clusters = np.unique(clusters)

    # Create a dictionary to store vectors by class
    clustered_indices = {cls: [] for cls in unique_clusters}

    # Populate the dictionary with vectors
    for i in range(clusters.size):
        clustered_indices[clusters[i]].append(i)

    # Sort clusters by size (number of vectors), largest first
    sorted_clusters = sorted(clustered_indices.items(), key=lambda item: len(item[1]), reverse=True)

    # Keep only the largest clusters
    max_clusters = max_clusters
    sorted_clusters = sorted_clusters[:max_clusters]

    # Calculate centroids and find closest vectors
    centroids = {}
    closest_vectors = {}
    for cls, indices in sorted_clusters:
        centroid = calculate_centroid(indices, vectors)
        closest_idx = closest_vector_index(centroid, indices, vectors)
        centroids[cls] = centroid
        closest_vectors[cls] = closest_idx
    
    return sorted_clusters, centroids, closest_vectors


@app.get("/search")
async def search(query: str):
    similarity_scores = compute_cosine_similarity(current_video_path, query)

    return {
        "query": query, 
        "scores": similarity_scores
    }

@app.get("/search/image/{folder}/{image_path}")
async def image_search(folder: str, image_path: str, xmin: int, xmax: int, ymin: int, ymax: int):
    image = cv2.imread("videos/"+folder+"/"+image_path)
    cropped_image = await crop_image(image, [xmin, ymin, xmax, ymax])
    if not os.path.exists("images/"):
        os.mkdir("images")
    cv2.imwrite(OUTPUT_CROP_IMAGE, cropped_image)

    return {
        "path": "images",
        "name": "search-image.png"
    }

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

    if not os.path.exists("images/"):
        os.mkdir("images")
    cv2.imwrite(OUTPUT_CROP_IMAGE, img)

    similarity_scores = compute_cosine_similarity(current_video_path, IMAGE_CROP_QUERY)
    
    return {
        "query": IMAGE_CROP_QUERY, 
        "scores": similarity_scores
    }

@app.get("/video/")
async def get_video_names():
    video_names = find_mp4_files("./videos")
    video_names.sort()
    return video_names

@app.post("/select_video/")
async def select_video(name_data: dict):
    global current_video_path

    video_name = name_data.get("video_name", "")
    current_video_path = "./videos/" + video_name

    vid = cv2.VideoCapture(current_video_path)
    if vid.isOpened:
        output_path = current_video_path.replace(".mp4", "")
        if not os.path.exists(output_path):
            os.mkdir(output_path)

        if not os.path.exists(f"{output_path}/0.png"):
            video2images(current_video_path)

        return { 
            "frame_count": int(vid.get(cv2.CAP_PROP_FRAME_COUNT)), 
            "fps": int(vid.get(cv2.CAP_PROP_FPS))
        }

@app.get("/video/objects/{filename}")
async def get_video(filename: str):
    video_path = os.path.join(VIDEOS_DIR, filename).replace("\\","/")
    name = filename.split(".")[0]
    output_path = os.path.join(VIDEOS_DIR, f"{name}").replace("\\","/")

    if not os.path.exists(output_path+"-output.csv"):
        await annotate_video(video_path, output_path)

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
    video_path = os.path.join(VIDEOS_DIR, filename).replace("\\","/")
    name = filename.split(".")[0]
    output_path = os.path.join(VIDEOS_DIR, f"depth-{name}").replace("\\","/")

    if not os.path.exists(output_path) or not os.path.exists(output_path+"/depth_frame_0.png"):
        await compute_depth_map(video_path, output_path)

    paths = glob.glob(output_path+"/depth_frame_*.png")
    return { "frames": len(paths) }

@app.get("/video/embeddings/{filename}")
async def get_video_embeddings(filename: str):
    print(filename)
    video_path = os.path.join(VIDEOS_DIR, filename).replace("\\","/")
    print(video_path)
    tsne, pca, umap, tsne_clusters, pca_clusters, umap_clusters, tsne_cluster_frames, \
        pca_cluster_frames, umap_cluster_frames = compute_embeddings_dim_reduction(video_path)
    
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
    video_path = os.path.join(VIDEOS_DIR, filename).replace("\\","/")
    vid = cv2.VideoCapture(video_path)
    if (not vid.isOpened):
        return { "fps": -1 }
    else:
        return { "fps": int(vid.get(cv2.CAP_PROP_FPS)) }
    