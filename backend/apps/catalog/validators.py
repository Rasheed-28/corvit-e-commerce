import os
from django.core.exceptions import ValidationError
from PIL import Image

MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 Megabytes
ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

def validate_image_file(file):
    """
    Validates uploaded image file against security and operational rules:
    1. Maximum file size (5MB).
    2. Whitelisted file extensions.
    3. Whitelisted MIME content-types.
    4. Pillow structural analysis to reject executable/corrupted uploads masquerading as images.
    """
    if file.size > MAX_IMAGE_SIZE_BYTES:
        raise ValidationError(
            f"Image file size ({file.size / (1024 * 1024):.2f}MB) exceeds the maximum allowed limit of 5.00MB."
        )

    ext = os.path.splitext(file.name)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValidationError(
            f"Unsupported image extension '{ext}'. Allowed extensions: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}."
        )

    content_type = getattr(file, 'content_type', None)
    if content_type and content_type not in ALLOWED_IMAGE_MIME_TYPES:
        raise ValidationError(
            f"Unsupported image MIME type '{content_type}'. Allowed MIME types: {', '.join(ALLOWED_IMAGE_MIME_TYPES)}."
        )

    # Verify image integrity via Pillow
    try:
        file.seek(0)
        img = Image.open(file)
        img.verify()
        file.seek(0)
    except Exception as exc:
        raise ValidationError(f"Invalid or corrupted image file: {str(exc)}")
