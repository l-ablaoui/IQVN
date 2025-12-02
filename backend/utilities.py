import cv2
import numpy as np
from tqdm import tqdm

import os
import glob

import asyncio
import aiofiles
import base64

from sklearn.cluster import DBSCAN
from sklearn.neighbors import NearestNeighbors

#save video as individual frames in the folder to facilitate fetching
async def video2images(video_path, FPS):
    output_path = video_path.replace(".mp4", "")
    vid = cv2.VideoCapture(video_path)

    if not vid.isOpened():
        raise Exception("Error loading video")

    width = int(vid.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(vid.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_count = int(vid.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = int(vid.get(cv2.CAP_PROP_FPS))

    skip_ahead = 0
    if fps > FPS:
        skip_ahead =  int(fps / FPS) 
        total_count = int(total_count * FPS / fps)

    frame_count = 0
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
            frame_path = f"{output_path}/{frame_count}.png"
            async with aiofiles.open(frame_path, mode='wb') as img_file:
                await img_file.write(cv2.imencode('.png', frame_to_save)[1].tobytes())
            
            frame_count += 1
            pbar.update(1)

    vid.release()

#save a single image frame from a video given its number 
def save_frame_from_video(video_path, output_path, frame_number, fps):
    print("Saving frame ", frame_number, " from video ", video_path, " to ", output_path)
    vid = cv2.VideoCapture(video_path)
    original_fps = int(vid.get(cv2.CAP_PROP_FPS))
    frame_number = int(frame_number * original_fps / fps)
    if (frame_number >= int(vid.get(cv2.CAP_PROP_FRAME_COUNT))):
        raise Exception(f"Frame number {frame_number} exceeds total frames in video \
                        {int(vid.get(cv2.CAP_PROP_FRAME_COUNT))}")
    vid.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
    okay, frame = vid.read()
    if not okay:
        raise Exception("Error loading video")
    cv2.imwrite(output_path, frame)
    vid.release()

#list all mp4 files in a folder
def find_mp4_files(relative_path):
    #get the absolute path of the directory
    abs_path = os.path.abspath(relative_path)
    
    #use glob to find all .mp4 files in the directory
    mp4_files = glob.glob(os.path.join(abs_path, '*.mp4'))
    
    #extract the file names from the full paths
    mp4_file_names = [os.path.basename(file) for file in mp4_files]
    
    return mp4_file_names

#calculate the centroid
def calculate_centroid(indices, vectors):
    cluster_vectors = vectors[indices]
    centroid = np.mean(cluster_vectors, axis=0)
    return centroid

#find the index of the vector closest to the centroid
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
    #determine the number of unique classes
    unique_clusters = np.unique(clusters)

    #create a dictionary to store vectors by class
    clustered_indices = {cls: [] for cls in unique_clusters}

    #populate the dictionary with vectors
    for i in range(clusters.size):
        clustered_indices[clusters[i]].append(i)

    #sort clusters by size (number of vectors), largest first
    sorted_clusters = sorted(clustered_indices.items(), key=lambda item: len(item[1]), reverse=True)

    #keep only the largest clusters
    max_clusters = max_clusters
    sorted_clusters = sorted_clusters[:max_clusters]

    #calculate centroids and find closest vectors
    centroids = {}
    closest_vectors = {}
    for cls, indices in sorted_clusters:
        centroid = calculate_centroid(indices, vectors)
        closest_idx = closest_vector_index(centroid, indices, vectors)
        centroids[cls] = centroid
        closest_vectors[cls] = closest_idx
    
    return sorted_clusters, centroids, closest_vectors

#from a bounding box and a video valid index, get the pixels of the image frame that are in the box
def get_cropped_image(video_path, crop_box, current_index, FPS):
    vid = cv2.VideoCapture(video_path)
    original_fps = int(vid.get(cv2.CAP_PROP_FPS))
    vid.set(cv2.CAP_PROP_POS_FRAMES, int(current_index * original_fps / FPS))
    okay, frame = vid.read()
    if (not okay):
        print("something went wrong here: frame: ", frame)
        return None
    
    x, y, w, h = crop_box
    return frame[y:y+h, x:x+w]

def dir_path(string):
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
