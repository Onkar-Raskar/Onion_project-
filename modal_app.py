import modal

# 1. Define container with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("ffmpeg", "libgl1", "libglib2.0-0")
    .pip_install(
        "fastapi",
        "uvicorn",
        "python-multipart",
        "ultralytics",
        "opencv-python-headless",
        "numpy",
        "torch",
        "torchvision",
        "onnxruntime",
        "scipy",
    )
    .add_local_file("app.py", "/root/app.py")
    .add_local_file("best.pt", "/root/best.pt")
    .add_local_file("best.onnx", "/root/best.onnx")
    .add_local_file("heap_localizer.py", "/root/heap_localizer.py")
    .add_local_file("heuristics.py", "/root/heuristics.py")
    .add_local_file("size_estimator.py", "/root/size_estimator.py")
    .add_local_file("video_processor.py", "/root/video_processor.py")
)

app = modal.App("onion-grader-api", image=image)

# 2. Expose your FastAPI backend with 2 GB RAM
@app.function(
    memory=2048,   # 2 GB RAM allocated
    cpu=2.0,       # 2 vCPUs
    timeout=120,   # 2-minute timeout for video processing
)
@modal.asgi_app()
def fastapi_app():
    from app import app as fastapi_instance
    return fastapi_instance
