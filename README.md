# Incremental Querying for Video Navigation

This repository demonstrates an implementation of a video content retrieval system that combines several video interaction methods:

- classic interactions (timeline navigation, textual search)
- image based interactions (image search, image crop search)
- semantic representations (2D scatterplot of video embeddings)

The implementation is divided into a python-coded fastAPI backend server that performs video analysis (leveraging a VLM for search and semantic representation), and a react-coded frontend that presents the different video interactions.

## Backend (FastAPI)

### Prerequisites
- Python 3.8
- (tested with) Miniconda X
- (tested with) Cuda 12.1 

### Installation
0. Clone the repository:
```
    git clone --recurse-submodules git@github.com:Marina2468/IQVN.git
```
1. Create a new environment with python 3.8:
```
    conda create -n ENV_NAME python=3.8
    conda activate ENV_NAME
```
2. Install torch, torchvision and torchaudio (with cuda support):
```
    conda install pytorch==2.1.2 torchvision==0.16.2 torchaudio==2.1.2 pytorch-cuda=12.1 -c pytorch -c nvidia
```
3. Install mayavi and cartopy with conda:
```
    conda install mayavi cartopy -c conda-forge
```
4. Install the remaining required Python packages using pip:
```
    cd backend
    pip install -r requirements.txt -U --no-deps
```
5. Install ImageBind:
```
    cd ImageBind
    pip install -U --no-deps -e .
```
### Running the Backend
0. Make sure the `backend` directory has a directory `videos` that contains at least one MP4 video file.
1. Navigate to the `backend` directory and run the FastAPI server:
```
    uvicorn main:app --reload
```
or
```
    python main.py
```

This command will start the server at `http://localhost:8000`.

## Frontend (React)

### Prerequisites
- NodeJs (npm) X

### Running the Frontend
0. Make sure the backend server is running before attempting to use the frontend interactions.
1. Navigate to the `frontend` directory:
```
    cd frontend
```
2. Install the necesary dependencies with:
```
    npm install
```
3. Run with:
```
    npm start
```
In your browser, enter the path `http://localhost:3000/` to access the frontend GUI

## Demo
https://github.com/user-attachments/assets/0e5c17cb-556b-4534-81dd-4b6d8ca166db

## Licensing

This repository is licensed under the MIT License, except for the contents of the `/assets` directory.

[ImageBind](https://github.com/facebookresearch/ImageBind) (under `assets/ImageBind`)
  - License: Creative Commons Attribution–NonCommercial 4.0 International (CC BY-NC 4.0)
  - This repository only references ImageBind as a git submodule and does not redistribute it.

