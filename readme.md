# Image Loader

This project demonstrates a basic implementation of a backend using FastAPI and a frontend using HTML and JavaScript to load an image from the backend upon clicking a button.

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
1. Navigate to the `root` directory.
2. Run the simple python server:

.. code:

    python -m http.server 8888

## Note
- Make sure the backend server is running before attempting to load the image from the frontend.
- Ensure that there is a directory named `images` in the `backend` directory, and place the image you want to load inside this directory.

