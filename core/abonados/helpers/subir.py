import io
import os
import uuid
from pathlib import Path
from django.conf import settings

def _comprimir_imagen_si_posible(upload):
    content_type = (getattr(upload, 'content_type', '') or '').lower()
    if not content_type.startswith('image/'):
        return upload.read(), content_type

    raw = upload.read()
    try:
        from PIL import Image
    except ImportError:
        return raw, content_type

    try:
        img = Image.open(io.BytesIO(raw))
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        max_side = 1920
        w, h = img.size
        if max(w, h) > max_side:
            ratio = max_side / max(w, h)
            img = img.resize((int(w * ratio), int(h * ratio)), Image.Resampling.LANCZOS)
        out = io.BytesIO()
        img.save(out, format='JPEG', quality=85, optimize=True)
        return out.getvalue(), 'image/jpeg'
    except Exception:
        return raw, content_type

def subir_archivo(upload, destino_dir_relativo, nombre_base=None, compress=True, **kwargs):
    """
    Generic upload and save helper.
    """
    if not upload:
        raise ValueError('Archivo requerido')

    if compress:
        contenido, content_type = _comprimir_imagen_si_posible(upload)
    else:
        contenido = upload.read()
        content_type = getattr(upload, 'content_type', '')

    ext = os.path.splitext(upload.name)[1].lower()
    if compress and content_type == 'image/jpeg':
        ext = '.jpg'
    elif not ext:
        ext = '.bin'

    nombre = nombre_base or f'{uuid.uuid4().hex[:12]}{ext}'
    
    # Calculate target directory under MEDIA_ROOT
    dest_dir = Path(settings.MEDIA_ROOT) / destino_dir_relativo
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / nombre

    with open(dest_path, 'wb') as f:
        f.write(contenido)

    rel = str(dest_path.relative_to(settings.MEDIA_ROOT)).replace('\\', '/')
    return {
        'path': rel,
        'url': f'/media/{rel}',
        'content_type': content_type,
        'size': len(contenido),
    }
