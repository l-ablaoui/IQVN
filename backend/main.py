from fastapi import FastAPI, File, UploadFile
from fastapi.responses import FileResponse
import os
from fastapi.middleware.cors import CORSMiddleware

import glob
from od_model import OD

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

@app.get("/image/{filename}")
async def get_image(filename: str):

    image_path = os.path.join(IMAGES_DIR, filename).replace("\\","/")
    output_path = os.path.join(IMAGES_DIR, "annotated-"+filename).replace("\\","/")

    if not os.path.exists(output_path):
        await annotate_image(image_path)

    return FileResponse(output_path)

@app.get("/image/{prediction_path}/{filename}")
async def get_image(prediction_path: str, filename: str):

    img_path = os.path.join(VIDEOS_DIR, f"prediction-{prediction_path}").replace("\\","/")+f"/{filename}"
    return FileResponse(img_path)


@app.get("/video/{filename}")
async def get_video(filename: str):
    video_path = os.path.join(VIDEOS_DIR, filename).replace("\\","/")
    name = filename.split(".")[0]
    output_path = os.path.join(VIDEOS_DIR, f"prediction-{name}").replace("\\","/")

    if not os.path.exists(output_path) or not os.path.exists(output_path+"/0.png"):
        await annotate_video(video_path, output_path)

    paths = glob.glob(output_path+"/*.png")
    return {
        "frames": len(paths)
    }

async def annotate_video(video_path, output_path):
    
    if not os.path.exists(output_path):
        os.mkdir(output_path)

    detector = OD(capture_video=video_path, output_detection=output_path, 
                  output_results=output_path+"-output.csv", model_name="yolov5s.pt")
    detector()

async def annotate_image(image_path):
    detector = OD(capture_video="", output_detection='', output_results="", model_name='yolov5s.pt')
    detector(image=image_path)







