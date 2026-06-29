"""
Guardado de archivos del cliente (contratos, DNI, recibo luz, evidencias de pago).
Comprime imágenes en el servidor si Pillow está disponible.
"""
import io
import os
import uuid
from pathlib import Path

from django.conf import settings


def _media_cliente_dir(cliente_id, categoria):
    base = Path(settings.MEDIA_ROOT) / 'clientes' / str(cliente_id) / categoria
    base.mkdir(parents=True, exist_ok=True)
    return base


def _comprimir_imagen_si_posible(upload):
    """Intenta reducir JPEG/PNG; si no hay Pillow, devuelve el contenido original."""
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


def sistema_guardado_archivo_cliente(upload, cliente_id, categoria, nombre_base=None):
    """
    Guarda un archivo y retorna ruta relativa a MEDIA_ROOT y URL pública.
    """
    if not upload:
        raise ValueError('Archivo requerido')

    contenido, content_type = _comprimir_imagen_si_posible(upload)
    ext = os.path.splitext(upload.name)[1].lower()
    if content_type == 'image/jpeg':
        ext = '.jpg'
    elif not ext:
        ext = '.bin'

    nombre = nombre_base or f'{uuid.uuid4().hex[:12]}{ext}'
    dest_dir = _media_cliente_dir(cliente_id, categoria)
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
