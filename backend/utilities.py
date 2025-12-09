import cv2
import numpy as np
from tqdm import tqdm

import os
import glob

import asyncio
import aiofiles
import base64
from typing import List, Tuple, Dict, Optional, Iterable

from sklearn.cluster import DBSCAN
from sklearn.neighbors import NearestNeighbors
 
def save_frame_from_video(video_path: str, output_path: str, frame_number: int, fps: int) -> None:
    try:
        vid = cv2.VideoCapture(video_path)
        frame_count = vid.get(cv2.CAP_PROP_FRAME_COUNT)
        og_FPS = int(vid.get(cv2.CAP_PROP_FPS))
        skip_ahead = int(og_FPS / fps)
        frame_number = max(0, min(int(frame_number / skip_ahead), frame_count - 1))
        vid.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        _, frame = vid.read()
        cv2.imwrite(output_path, frame)
        vid.release()
    except Exception as error:
        raise Exception(f"Error saving frame {frame_number} in video {video_path}: {error}")
    
def find_mp4_files(relative_path: str) -> List[str]:
    abs_path = os.path.abspath(relative_path) #get the absolute path of the directory
    mp4_files = glob.glob(os.path.join(abs_path, '*.mp4'))  #use glob to find all .mp4 files in the directory
    mp4_file_names = [os.path.basename(file) for file in mp4_files] #extract the file names from the full paths
    return mp4_file_names

def calculate_centroid(indices: List[int], vectors: np.ndarray) -> np.ndarray:
    cluster_vectors = vectors[indices]
    centroid = np.mean(cluster_vectors, axis=0)
    return centroid

def closest_vector_index(centroid: np.ndarray, indices: List[int], vectors: np.ndarray) -> int:
    cluster_vectors = vectors[indices]
    distances = np.linalg.norm(cluster_vectors - centroid, axis=1)
    closest_index = indices[int(np.argmin(distances))]
    return closest_index

def choose_eps(vectors: np.ndarray, k: int = 4, percentile: float = 90) -> float:
    neigh = NearestNeighbors(n_neighbors=k)
    nbrs = neigh.fit(vectors)
    distances, _ = nbrs.kneighbors(vectors)
    distances = np.sort(distances[:, k - 1], axis=0)
    eps: float = float(np.percentile(distances, percentile))
    return eps

def get_clusters(vectors: np.ndarray, min_samples: int = 5) -> np.ndarray:
    eps: float = choose_eps(vectors, min_samples, 100)
    clusters: np.ndarray = DBSCAN(eps=eps, min_samples=min_samples).fit(vectors).labels_
    return clusters

def get_centroids(
    clusters: np.ndarray,
    vectors: np.ndarray,
    max_clusters: int
) -> Tuple[
    List[Tuple[int, List[int]]],
    Dict[int, np.ndarray],
    Dict[int, int]
]:
    unique_clusters = np.unique(clusters)
    clustered_indices: Dict[int, List[int]] = {cls: [] for cls in unique_clusters}

    for i in range(clusters.size):
        clustered_indices[clusters[i]].append(i)

    sorted_clusters: List[Tuple[int, List[int]]] = sorted(
        clustered_indices.items(),
        key=lambda item: len(item[1]),
        reverse=True
    )

    sorted_clusters = sorted_clusters[:max_clusters]

    centroids: Dict[int, np.ndarray] = {}
    closest_vectors: Dict[int, int] = {}

    for cls, indices in sorted_clusters:
        centroid = calculate_centroid(indices, vectors)
        closest_idx = closest_vector_index(centroid, indices, vectors)
        centroids[cls] = centroid
        closest_vectors[cls] = closest_idx

    return sorted_clusters, centroids, closest_vectors

# from a bounding box and a video valid index, get the pixels of the image frame that are in the box
def get_cropped_image(
    video_path: str,
    crop_box: Tuple[int, int, int, int],
    current_index: int,
    FPS: int
) -> Optional[np.ndarray]:
    vid = cv2.VideoCapture(video_path)
    original_fps: int = int(vid.get(cv2.CAP_PROP_FPS))
    vid.set(cv2.CAP_PROP_POS_FRAMES, int(current_index * original_fps / FPS))
    okay, frame = vid.read()
    if not okay:
        print("something went wrong here: frame: ", frame)
        return None

    x, y, w, h = crop_box
    return frame[y:y+h, x:x+w]

def dir_path(string: str) -> str:
    if os.path.isdir(string):
        return string
    else:
        raise NotADirectoryError(string)

def sigmoid(z: np.ndarray) -> np.ndarray:
    return 1 / (1 + np.exp(-z))

def decode_data_url(data_url: str) -> np.ndarray:
    header, b64data = data_url.split(",", 1)
    img_bytes = base64.b64decode(b64data)
    image_array = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    return np.array(img)

def decode_audio_url(data_url: str) -> np.ndarray:
    header, b64data = data_url.split(",", 1)
    audio_bytes = base64.b64decode(b64data)
    audio_array = np.frombuffer(audio_bytes, dtype=np.uint8)
    return audio_array