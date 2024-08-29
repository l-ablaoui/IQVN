import cv2
import numpy as np

from tqdm import tqdm

import os
import glob

from sklearn.cluster import DBSCAN
from sklearn.neighbors import NearestNeighbors

# save image as individual frames in the folder to facilitate fetching
def video2images(video_path, FPS):
    output_path = video_path.replace(".mp4", "")
    vid = cv2.VideoCapture(video_path)

    if not vid.isOpened():
        print(">>>>> loading video problem")
        return

    width = int(vid.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(vid.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_count = int(vid.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = int(vid.get(cv2.CAP_PROP_FPS))

    skipAhead = 0
    if fps > FPS:
        skipAhead =  int(fps / FPS) 
        total_count = int(total_count * FPS / fps)

    frameCount = 0
    with tqdm(total=total_count, desc="saving original frames: ") as pbar:
        while vid.isOpened():
            for _ in range(skipAhead - 1):
                okay, frame = vid.read()
                if not okay:
                    break
            okay, frame = vid.read()
            if not okay:
                break

            frame_to_save = cv2.resize(frame, (width, height))
            cv2.imwrite(output_path+f"/{frameCount}.png", frame_to_save)
            frameCount += 1
            pbar.update(1)

    vid.release()
 
def find_mp4_files(relative_path):
    # Get the absolute path of the directory
    abs_path = os.path.abspath(relative_path)
    
    # Use glob to find all .mp4 files in the directory
    mp4_files = glob.glob(os.path.join(abs_path, '*.mp4'))
    
    # Extract the file names from the full paths
    mp4_file_names = [os.path.basename(file) for file in mp4_files]
    
    return mp4_file_names

#apply bounding box to the image pixels
def crop_image(image, bbox):
    x_min, y_min, x_max, y_max = bbox
    x_min, y_min, x_max, y_max = int(x_min), int(y_min), int(x_max), int(y_max)
    cropped_image = image[y_min:y_max, x_min:x_max]
    
    return cropped_image

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
