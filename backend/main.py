from typing import Any, Dict, List, Tuple
import warnings
warnings.filterwarnings("ignore", category=UserWarning, message="TypedStorage is deprecated")

import uvicorn
from fastapi import FastAPI, File, UploadFile
from fastapi.exceptions import HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

import argparse
import json
import io
import os
import soundfile as sf

import time
import base64
from sklearn.preprocessing import LabelEncoder
import pandas as pd

from object_detection import ObjectDetector
from vision_transformer import VisionTransformer
from depthmap import DepthMapEstimation

from utilities import *
from compound_query_processor import CompoundQueryProcessor, QueryUnit

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  #allow requests from all origins to be simple
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

IMAGES_DIR = "images"
IMAGE_CROP_QUERY = "<image-loaded>"
OUTPUT_CROP_IMAGE = "images/search-image.png"
AUDIO_RECORDING_QUERY = "<audio-loaded>"
OUTPUT_RECORDED_AUDIO = "audio/recording.wav"
MAX_NB_CLUSTERS = 20
EMBEDDINGS_LENGTH = 512
FPS = 10
DURATION = 10
STRIDE = 5
CONFIG_FILE = "config.json"

def read_config () -> Dict[str, Any]:
    with open(CONFIG_FILE, "r") as json_file:
        config = json.load(json_file)
    return config

def write_config (config) -> None:
    with open(CONFIG_FILE, "w") as json_file:
        json.dump(config, json_file)
        json_file.flush()

async def save_embeddings(classifier: VisionTransformer, video_path: str) -> None:
    output_path = video_path.replace(".mp4", "")
    if not os.path.exists(f"{output_path}/embedding_0.npy"):
        classifier()
        video_embeddings = classifier.video_embeddings

        with tqdm(total=video_embeddings.shape[0], desc="saving video embeddings: ") as pbar:
            for i in range(video_embeddings.shape[0]):
                np.save(output_path+f"/embedding_{i}.npy", video_embeddings[i])
                pbar.update(1)
        
        audio_embeddings = classifier.audio_embeddings

        if audio_embeddings is not None and not os.path.exists(f"{output_path}/embedding_audio_0.npy"):
            with tqdm(total=audio_embeddings.shape[0], desc="saving audio embeddings: ") as pbar:
                for i in range(audio_embeddings.shape[0]):
                    np.save(output_path+f"/embedding_audio_{i}.npy", audio_embeddings[i])
                    pbar.update(1)

    else:
        vid = cv2.VideoCapture(video_path)
        og_FPS = vid.get(cv2.CAP_PROP_FPS)
        frame_count = int(int(vid.get(cv2.CAP_PROP_FRAME_COUNT)) * FPS / og_FPS)
        classifier.load_video_features(output_path, frame_count)
        classifier.load_audio_features(output_path, frame_count)
        vid.release()

async def compute_embeddings_dim_reduction(video_path: str) -> \
    Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray,\
    List[Dict[str, int]],List[Dict[str, int]], List[Dict[str, int]]]:  
    output_path = video_path.replace(".mp4", "")
    if not os.path.exists(output_path):
        os.mkdir(output_path)

    print("output_path:", output_path)
    tic = time.time()

    #getting video embeddings 
    classifier = VisionTransformer(FPS, video_path, 64, DURATION, STRIDE)
    await save_embeddings(classifier, video_path)
        
    if not os.path.exists(f"{output_path}/tsne_reduction.npy"):
        if classifier.video_embeddings is None:
            classifier.video_embeddings = classifier.get_video_features()
        tsne = classifier.tsne_reduction(classifier.video_embeddings)
        np.save(output_path+f"/tsne_reduction.npy", tsne)

    if not os.path.exists(f"{output_path}/pca_reduction.npy"):
        if classifier.video_embeddings is None:
            classifier.video_embeddings = classifier.get_video_features()
        pca = classifier.pca_reduction(classifier.video_embeddings)
        np.save(output_path+f"/pca_reduction.npy", pca)

    if not os.path.exists(f"{output_path}/umap_reduction.npy"):
        if classifier.video_embeddings is None:
            classifier.video_embeddings = classifier.get_video_features()
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
        #save cluster frames for later use in the frontend
        save_frame_from_video(video_path, output_path+f"/{int(closest_vectors[cls])}.png",\
            int(closest_vectors[cls]), FPS)
    
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

async def compute_cosine_similarity(video_path, query_text) -> List[List[Any]]:    
    output_path = video_path.replace(".mp4", "")
    if not os.path.exists(output_path):
        os.mkdir(output_path)

    print("output_path:", output_path)
    tic = time.time()
    
    classifier = VisionTransformer(FPS, video_path, 64, DURATION, STRIDE)
    await save_embeddings(classifier, video_path)

    #query type (text/image)
    if query_text == IMAGE_CROP_QUERY:
        print("reading image and computing features")
        query_img = cv2.cvtColor(cv2.imread(OUTPUT_CROP_IMAGE), cv2.COLOR_BGR2RGB)
        query_embedding, _, _ = classifier.get_features(images=query_img)
    else:
        if query_text == AUDIO_RECORDING_QUERY:
             _, _, query_embedding = classifier.get_features(audios=OUTPUT_RECORDED_AUDIO)
        else:
            _, query_embedding, _ = classifier.get_features(texts=query_text)
    print("query_shape:", query_embedding.shape)

    #computing similarity scores and piling for video data
    image_scores = []
    index = 0
    while True:
        if not os.path.exists(f"{output_path}/embedding_{index}.npy"):
            break
        
        frame_features = np.load(f"{output_path}/embedding_{index}.npy")
        similarity = classifier.cosine_similarity(frame_features, query_embedding)
        image_scores.append([index, similarity.item() if type(similarity) is np.ndarray else similarity])
        index += 1
    total_index = index

    #computing similarity scores and piling for audio data
    duration = DURATION
    stride = STRIDE #duration and stride must match your chunking config

    audio_scores = None
    similarity = []
    index = 0

    silent_segment = None
    if os.path.exists(f"{output_path}/embedding_audio_silence.npy"):
        silent_segment = np.load(f"{output_path}/embedding_audio_silence.npy")
    
    while True:
        if not os.path.exists(f"{output_path}/embedding_audio_{index}.npy"):
            break
        audio_features = np.load(f"{output_path}/embedding_audio_{index}.npy")
        single_similarity = classifier.cosine_similarity(audio_features, query_embedding) if not silent_segment[index] else 0.0
        similarity.append(single_similarity.item() if type(single_similarity) is np.ndarray else single_similarity)
        index += 1
    
    if index > 0: #condition to know if there is audio in the video
        audio_scores = []
        for frame_idx in range(total_index):
            frame_time = frame_idx / FPS
            overlapping_similarities = []

            for i in range(len(similarity)):
                chunk_start = i * (duration - stride)
                chunk_end = chunk_start + duration
                if chunk_start <= frame_time < chunk_end:
                    overlapping_similarities.append(similarity[i])

            avg_sim = 0.0
            if overlapping_similarities:
                for j in range(len(overlapping_similarities)):
                    avg_sim += overlapping_similarities[j] / len(overlapping_similarities)

            audio_scores.append([frame_idx, avg_sim])

    toc = time.time() 
    print(f"done in {(toc-tic):.2f} seconds...")

    del classifier, similarity 
    return image_scores, audio_scores

async def perform_object_detection(video_path, output_path) -> ObjectDetector:
    detector = ObjectDetector(video_path=video_path, output_results=output_path+"-output.csv", model_name="yolov5s.pt", fps=FPS)
    return detector()

async def compute_depth_map(video_path, output_path) -> None:
    if not os.path.exists(output_path):
        os.mkdir(output_path)

    depth_estimator = DepthMapEstimation(FPS, video_path=video_path)
    depth_estimator(save_path=output_path)

@app.get("/videos/{filename}/search/")
async def search(filename: str, query: str) -> Dict[str, Any]:
    current_video_path = read_config()["videos_dir"] + "/" + filename
    print("current_video_path:", current_video_path, " query:", query)
    image_scores, audio_scores = await compute_cosine_similarity(current_video_path, query)

    return {
        "query": query, 
        "image_scores": image_scores,
        "audio_scores": audio_scores
    }

@app.post("/videos/{filename}/search/compound/")
async def search(filename: str, queries: List[QueryUnit]) -> Dict[str, Any]:
    current_video_path: str = read_config()["videos_dir"] + "/" + filename
    output_path: str = current_video_path.replace(".mp4", "")

    vision_transformer: VisionTransformer = VisionTransformer(FPS, current_video_path, 64, DURATION, STRIDE)

    if not os.path.exists(f"{output_path}/embedding_0.npy"):
        save_embeddings(vision_transformer, current_video_path)

    else:
        vid = cv2.VideoCapture(current_video_path)
        frame_count: int = int(int(vid.get(cv2.CAP_PROP_FRAME_COUNT)) * FPS / int(vid.get(cv2.CAP_PROP_FPS)))
        vision_transformer.load_video_features(output_path, frame_count)
        vid.release()

    processor: CompoundQueryProcessor = CompoundQueryProcessor(vision_transformer, current_video_path, FPS)
    similarity_scores: List[List[Any]] = processor(queries)
    
    return {
        "query": queries, 
        "scores": similarity_scores
    }

@app.post("/videos/{filename}/search/crop/")
async def crop_search(filename: str, crop_data: dict) -> Dict[str, Any]:
    current_video_path: str = read_config()["videos_dir"] + "/" + filename
    current_index = crop_data.get("current_index", 0)
    crop_box = crop_data.get("crop_box", (0, 0, 0, 0))
    crop_img = get_cropped_image(current_video_path, crop_box, current_index, FPS)

    if not os.path.exists("images/"):
        os.mkdir("images")

    try:
        async with aiofiles.open(OUTPUT_CROP_IMAGE, mode='wb') as file:
            await file.write(cv2.imencode('.png', crop_img)[1].tobytes())

        image_scores, audio_scores = await compute_cosine_similarity(current_video_path, IMAGE_CROP_QUERY)
        return {
            "query": IMAGE_CROP_QUERY, 
            "image_scores": image_scores,
            "audio_scores": audio_scores
        }

    except Exception as error:
        print("error getting cropped image scores: ", error)
        return {
            "query": "ERROR",
            "image_scores": [],
            "audio_scores": []
        }

@app.get("/videos/{filename}/images/{imagename}/")
async def get_image(filename: str, imagename: str) -> FileResponse:
    img_path = os.path.join(read_config()["videos_dir"], f"{filename}").replace("\\","/")+f"/{imagename}"
    return FileResponse(img_path)

@app.post("/videos/{filename}/search/audio/record/")
async def audio_record_search(filename: str, audio_record_data: UploadFile = File(...)):
    current_video_path: str = read_config()["videos_dir"] + "/" + filename
    try:
        #read the uploaded audio into memory
        audio_bytes = await audio_record_data.read()
        audio_buffer = io.BytesIO(audio_bytes)
        data, samplerate = sf.read(audio_buffer)

        #save to backend path
        if not os.path.exists("audio/"):
            os.mkdir("audio")
        sf.write(OUTPUT_RECORDED_AUDIO, data, samplerate)

        #compute cosine similarity
        image_scores, audio_scores = await compute_cosine_similarity(current_video_path, AUDIO_RECORDING_QUERY)
        return {
            "query": AUDIO_RECORDING_QUERY, 
            "image_scores": image_scores,
            "audio_scores": audio_scores
        }

    except Exception as error:
        print("error getting audio record scores: ", error)
        return {
            "query": "ERROR",
            "image_scores": [],
            "audio_scores": []
        }

@app.get("/videos/")
async def get_video_names() -> List[str]:
    video_names = find_mp4_files("./videos/")
    if not video_names:
        raise HTTPException(status_code=404, detail="No videos found")
    video_names.sort()
    return video_names

@app.get("/videos/{video_name}/")
async def get_video(video_name: str) -> FileResponse:
    video_path = os.path.join("./videos", video_name)
    if not os.path.exists(video_path) or not video_path.endswith('.mp4'):
        raise HTTPException(status_code=404, detail="Video not found")
    return FileResponse(video_path, media_type="video/mp4")

@app.get("/videos/{filename}/metadata/")
async def get_video_metadata(filename: str) -> Dict[str, Any]:
    current_video_path: str = read_config()["videos_dir"] + "/" + filename

    vid = cv2.VideoCapture(current_video_path)
    if vid.isOpened:
        output_path: str = current_video_path.replace(".mp4", "")
        if not os.path.exists(output_path):
            os.mkdir(output_path)

        og_FPS: float = vid.get(cv2.CAP_PROP_FPS)
        frame_count: int = int(int(vid.get(cv2.CAP_PROP_FRAME_COUNT)) * FPS / og_FPS)

        return { 
            "frame_count": frame_count, 
            "fps": FPS #int(vid.get(cv2.CAP_PROP_FPS))
        }

@app.get("/videos/{filename}/objects/")
async def get_objects_in_video(filename: str) -> Dict[str, Any]:
    video_path: str = os.path.join(read_config()["videos_dir"], filename).replace("\\","/")
    name: str = filename.split(".")[0]
    output_path: str = os.path.join(read_config()["videos_dir"], f"{name}").replace("\\","/")

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

@app.get("/videos/{filename}/depth-map/")
async def get_depth_video(filename: str) -> Dict[str, Any]:
    video_path = os.path.join(read_config()["videos_dir"], filename).replace("\\","/")
    name = filename.split(".")[0]
    output_path = os.path.join(read_config()["videos_dir"], f"depth-{name}").replace("\\","/")

    if not os.path.exists(output_path) or not os.path.exists(output_path+"/depth_frame_0.png"):
        await compute_depth_map(video_path, output_path)

    paths = glob.glob(output_path+"/depth_frame_*.png")
    return { "frames": len(paths) }

@app.get("/videos/{filename}/embeddings/")
async def get_video_embeddings(filename: str) -> Dict[str, Any]:
    video_path = os.path.join(read_config()["videos_dir"], filename).replace("\\","/")
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
    
@app.post("/videos/{filename}/search/image/")
async def upload_png(filename: str, image_data: dict) -> Dict[str, Any]:
    current_video_path = read_config()["videos_dir"] + "/" + filename

    data_url = image_data.get('image_data', '')
    img = decode_data_url(data_url)

    if not os.path.exists("images/"):
        os.mkdir("images")
    async with aiofiles.open(OUTPUT_CROP_IMAGE, mode='wb') as file:
        await file.write(cv2.imencode('.png', img)[1].tobytes())

    image_scores, audio_scores = await compute_cosine_similarity(current_video_path, IMAGE_CROP_QUERY)
    
    return {
        "query": IMAGE_CROP_QUERY, 
        "image_scores": image_scores,
        "audio_scores": audio_scores
    }

@app.post("/log/")
async def write_log(log_data: dict) -> None:
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

    uvicorn.run("main:app", port=config["port"], reload=True, log_level="info")
    os.remove(CONFIG_FILE)
    