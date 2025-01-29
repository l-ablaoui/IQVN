# Incremental Querying for Video Navigation

This repository demonstrates an implementation of a video content retrieval system that combines several video interaction methods:

- classic interactions (timeline navigation, textual search)
- image based interactions (image search, image crop search)
- semantic representations (2D scatterplot of video embeddings)

The implementation is divided into a python-coded fastAPI backend server that performs video analysis (leveraging a VLM for search and semantic representation), and an html/javascript-coded frontend that presents the different video interactions

## Backend (FastAPI)

### Prerequisites
- Python 3.x

### Installation
1. Clone this repository to your local machine.
2. Navigate to the `backend` directory.
3. Install the required Python packages using pip:

.. code:

    pip install -r requirements.txt


### Running the Backend
1. Navigate to the `backend` directory.
2. Run the FastAPI server:

.. code:

    uvicorn main:app --reload

This command will start the server at `http://localhost:8000`.



## Frontend (HTML/JS)

### Running the Frontend
0. Make sure the backend server is running before attempting to use the frontend interactions
1. Navigate to the `root` directory.
2. Run the simple python server:

.. code:

    python -m http.server 8888

In your browser, enter the path `http://localhost:8888/frontend/` to access the frontend GUI

## Demo
https://github.com/user-attachments/assets/0e5c17cb-556b-4534-81dd-4b6d8ca166db
