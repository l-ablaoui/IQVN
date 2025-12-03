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

# save video as individual frames in the folder to facilitate fetching
async def video2images(video_path: str, FPS: int) -> None:
    output_path = video_path.replace(".mp4", "")
    vid = cv2.VideoCapture(video_path)

    if not vid.isOpened():
        raise Exception("Error loading video")

    width: int = int(vid.get(cv2.CAP_PROP_FRAME_WIDTH))
    height: int = int(vid.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_count: int = int(vid.get(cv2.CAP_PROP_FRAME_COUNT))
    fps: int = int(vid.get(cv2.CAP_PROP_FPS))

    skip_ahead: int = 0
    if fps > FPS:
        skip_ahead = int(fps / FPS)
        total_count = int(total_count * FPS / fps)

    frame_count: int = 0
    with tqdm(total=total_count, desc="saving original frames: ") as pbar:
        while vid.isOpened():
            for _ in range(skip_ahead - 1):
                okay, frame = vid.read()
                if not okay:
                    break
            okay, frame = vid.read()
            if not okay:
                break

            frame_to_save = cv2.resize(frame, (width, height))
            frame_path: str = f"{output_path}/{frame_count}.png"
            async with aiofiles.open(frame_path, mode='wb') as img_file:
                await img_file.write(cv2.imencode('.png', frame_to_save)[1].tobytes())

            frame_count += 1
            pbar.update(1)

    vid.release()

# save a single image frame from a video given its number 
def save_frame_from_video(
    video_path: str,
    output_path: str,
    frame_number: int,
    fps: int
) -> None:
    print("Saving frame ", frame_number, " from video ", video_path, " to ", output_path)
    vid = cv2.VideoCapture(video_path)
    original_fps: int = int(vid.get(cv2.CAP_PROP_FPS))
    frame_number = int(frame_number * original_fps / fps)
    if frame_number >= int(vid.get(cv2.CAP_PROP_FRAME_COUNT)):
        raise Exception(
            f"Frame number {frame_number} exceeds total frames in video "
            f"{int(vid.get(cv2.CAP_PROP_FRAME_COUNT))}"
        )
    vid.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
    okay, frame = vid.read()
    if not okay:
        raise Exception("Error loading video")
    cv2.imwrite(output_path, frame)
    vid.release()

# list all mp4 files in a folder
def find_mp4_files(relative_path: str) -> List[str]:
    abs_path: str = os.path.abspath(relative_path)
    mp4_files: List[str] = glob.glob(os.path.join(abs_path, '*.mp4'))
    mp4_file_names: List[str] = [os.path.basename(file) for file in mp4_files]
    return mp4_file_names

# calculate the centroid
def calculate_centroid(indices: Iterable[int], vectors: np.ndarray) -> np.ndarray:
    cluster_vectors = vectors[list(indices)]
    centroid = np.mean(cluster_vectors, axis=0)
    return centroid

# find the index of the vector closest to the centroid
def closest_vector_index(
    centroid: np.ndarray,
    indices: Iterable[int],
    vectors: np.ndarray
) -> int:
    idx_list = list(indices)
    cluster_vectors = vectors[idx_list]
    distances = np.linalg.norm(cluster_vectors - centroid, axis=1)
    closest_index = idx_list[int(np.argmin(distances))]
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
