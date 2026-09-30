from pathlib import Path
import io

import numpy as np
from PIL import Image
import tensorflow as tf

from classes import CLASSES, FULL_NAMES

MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "dermascan_best.keras"
IMG_SIZE = 224

_model = None


def get_model():
    """Load the model once and reuse it."""
    global _model
    if _model is None:
        _model = tf.keras.models.load_model(MODEL_PATH)
    return _model


def preprocess(image_bytes: bytes) -> np.ndarray:
    """Bytes -> (1, 224, 224, 3) float32 array in 0-255 range.
    No /255 scaling: EfficientNet has preprocessing built in."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE))
    return np.expand_dims(np.asarray(img, dtype=np.float32), axis=0)


def predict(image_bytes: bytes, top_k: int = 3) -> list[dict]:
    probs = get_model().predict(preprocess(image_bytes), verbose=0)[0]
    top = np.argsort(probs)[::-1][:top_k]
    return [
        {
            "code": CLASSES[i],
            "name": FULL_NAMES[CLASSES[i]],
            "probability": round(float(probs[i]), 4),
        }
        for i in top
    ]


if __name__ == "__main__":
    # Quick test: python model.py path/to/image.jpg
    import sys
    with open(sys.argv[1], "rb") as f:
        for r in predict(f.read()):
            print(f"{r['name']:<40} {r['probability']:.1%}")