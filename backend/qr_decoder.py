from fastapi import HTTPException
from starlette.datastructures import UploadFile


MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp", "image/bmp"}


async def decode_qr_image(image: UploadFile) -> str:
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="Upload a PNG, JPEG, WebP, or BMP QR image.")

    data = await image.read(MAX_IMAGE_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="QR images must be 5 MB or smaller.")

    try:
        import cv2
        import numpy as np

        encoded = np.frombuffer(data, dtype=np.uint8)
        decoded_image = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
        if decoded_image is None:
            raise ValueError("unsupported image data")
        detector = cv2.QRCodeDetector()
        value, _, _ = detector.detectAndDecode(decoded_image)
        if not value:
            height, width = decoded_image.shape[:2]
            largest_dimension = max(height, width)
            if largest_dimension < 512:
                scale = max(2, min(8, 512 // largest_dimension))
                decoded_image = cv2.resize(
                    decoded_image,
                    None,
                    fx=scale,
                    fy=scale,
                    interpolation=cv2.INTER_NEAREST,
                )
                border = max(16, scale * 4)
                decoded_image = cv2.copyMakeBorder(
                    decoded_image,
                    border,
                    border,
                    border,
                    border,
                    cv2.BORDER_CONSTANT,
                    value=(255, 255, 255),
                )
                value, _, _ = detector.detectAndDecode(decoded_image)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail="The uploaded file could not be decoded as an image.") from exc

    if not value:
        raise HTTPException(status_code=422, detail="No readable QR code was found in the image.")
    return value.strip()