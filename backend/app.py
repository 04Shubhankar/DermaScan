from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from model import get_model, predict

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
MAX_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_TYPES = {"image/jpeg", "image/png"}
DISCLAIMER = "This is not a medical diagnosis. Consult a dermatologist."

app = FastAPI(title="DermaScan AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # fine for local dev; restrict when deploying
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def load_model_on_startup():
    get_model()  # load once so the first request isn't slow


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict")
async def predict_endpoint(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Upload a JPG or PNG image.")

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Image too large (max 5 MB).")

    try:
        results = predict(data, top_k=3)
    except Exception:
        raise HTTPException(400, "Could not read the image.")

    return {"predictions": results, "disclaimer": DISCLAIMER}


# Serve the frontend at "/" (must be mounted last)
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")