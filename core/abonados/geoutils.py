import json
import re
from decimal import Decimal

def get_sede_prefijo(nombre: str) -> str:
    """
    Extrae el prefijo en mayúsculas de una Sede desde su nombre.
    Ejemplo: "La Oroya - ORO" -> "ORO"
    Si no encuentra el patrón " - PREFIJO", limpia el nombre y toma letras mayúsculas.
    """
    if not nombre:
        return 'SLO'
    parts = nombre.split(' - ')
    if len(parts) > 1:
        return parts[-1].strip().upper()
    cleaned = re.sub(r'[^A-Z]', '', nombre.upper())
    return cleaned[:3] if len(cleaned) >= 3 else nombre[:3].upper()

def is_point_in_polygon(lat, lng, polygon):
    """
    Algoritmo de Ray-Casting para determinar si un punto (lat, lng)
    se encuentra dentro de un polígono formado por una lista de vértices [[lat, lng], ...].
    """
    if not polygon or len(polygon) < 3:
        return False
    inside = False
    n = len(polygon)
    j = n - 1
    try:
        lat_f = float(lat)
        lng_f = float(lng)
    except (TypeError, ValueError):
        return False

    for i in range(n):
        try:
            xi, yi = float(polygon[i][0]), float(polygon[i][1])
            xj, yj = float(polygon[j][0]), float(polygon[j][1])
        except (TypeError, ValueError, IndexError):
            continue
        
        if ((yi > lng_f) != (yj > lng_f)) and (lat_f < (xj - xi) * (lng_f - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside

def buscar_sector_por_gps(lat, lng):
    """
    Busca y retorna el primer Sector activo cuyo polígono contiene el punto (lat, lng).
    """
    if lat is None or lng is None:
        return None
    from core.models.infraestructura import Sectores
    # Filtramos por activo=True para respetar el Soft Delete
    for sector in Sectores.objects.filter(activo=True):
        coords_str = sector.coordenadas
        if coords_str:
            try:
                polygon = json.loads(coords_str)
                if isinstance(polygon, list) and len(polygon) >= 3:
                    if is_point_in_polygon(lat, lng, polygon):
                        return sector
            except Exception:
                continue
    return None

def parse_cliente_id(val):
    """
    Parsea cualquier código de cliente (ej. CEN+A00000001, SLO-A00000001, ORO-S04-00000001, ORO-A-00000001 o 1)
    y retorna su ID numérico correspondiente.
    """
    if not val:
        return val
    if isinstance(val, str):
        # Manejar formato con + (ej: CEN+A00000001)
        if '+' in val:
            parts = val.split('+')
            last_part = parts[-1]
            cleaned = re.sub(r'^[A-Za-z]+', '', last_part)
            try:
                return int(cleaned)
            except ValueError:
                pass
        # Manejar formato con - (ej: SLO-A00000001)
        elif '-' in val:
            parts = val.split('-')
            last_part = parts[-1]
            cleaned = re.sub(r'^[A-Za-z]+', '', last_part)
            try:
                return int(cleaned)
            except ValueError:
                pass
        # Si es solo un número
        else:
            try:
                return int(val)
            except ValueError:
                pass
    return val
