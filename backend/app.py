from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from model import get_model, predict

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
ALLOWED_TYPES = {"image/jpeg", "image/png"}
DISCLAIMER = "This is not a medical diagnosis. Consult a dermatologist."

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024  # 5 MB

get_model()  # load once at startup so the first request isn't slow


@app.get("/health")
def health():
    return jsonify(status="ok")


@app.post("/predict")
def predict_endpoint():
    file = request.files.get("file")
    if file is None:
        return jsonify(error="No file uploaded. Use the 'file' field."), 400
    if file.mimetype not in ALLOWED_TYPES:
        return jsonify(error="Upload a JPG or PNG image."), 400

    try:
        results = predict(file.read(), top_k=3)
    except Exception:
        return jsonify(error="Could not read the image."), 400

    return jsonify(predictions=results, disclaimer=DISCLAIMER)


@app.errorhandler(413)
def too_large(_):
    return jsonify(error="Image too large (max 5 MB)."), 413


# Serve the frontend
@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/<path:filename>")
def static_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=False)