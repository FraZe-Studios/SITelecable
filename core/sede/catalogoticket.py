import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import connection
from core.models.models_generados import CatalogoTickets
from core.auth.comun import checksession, senderror

def _require_sede_id(body):
    sede_id = body.get('sede_id')
    if sede_id is None or sede_id == '':
        raise ValueError('sede_id requerido')
    return int(sede_id)

def get_enum_values(enum_type_name):
    """Obtiene los valores válidos de un ENUM desde la base de datos PostgreSQL."""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = %s)",
            [enum_type_name]
        )
        return [row[0] for row in cursor.fetchall()]

@csrf_exempt
def catalogoticket_enums(request):
    """GET /api/sede/config/catalogo-ticket/enums/ — Retorna los valores válidos de los ENUMs."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
    
    if request.method != 'GET':
        return senderror('Método no permitido', status=405)
    
    try:
        return JsonResponse({
            'categoria_ticket': get_enum_values('categoria_ticket'),
            'area_ticket': get_enum_values('area_ticket'),
            'tecnologia_ticket': get_enum_values('tecnologia_ticket'),
            'modalidad_ticket': get_enum_values('modalidad_ticket'),
        })
    except Exception as e:
        return senderror(str(e), status=500)

@csrf_exempt
def catalogoticket(request):
    """POST /api/sede/config/catalogo-ticket/ — Guarda/actualiza plantillas de ticket."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)
        
    try:
        body = json.loads(request.body)
        sede_id = _require_sede_id(body)
        ticket_id = body.get('ticket_id')
        es_universal = bool(body.get('es_universal', False))
        nombre_clean = body['nombre'].strip()
        
        duplicado_qs = CatalogoTickets.objects.filter(nombre_ticket__iexact=nombre_clean)
        if ticket_id:
            duplicado_qs = duplicado_qs.exclude(pk=int(ticket_id))
            t = CatalogoTickets.objects.get(pk=int(ticket_id))
        else:
            t = CatalogoTickets()
            
        if duplicado_qs.exists():
            return senderror(f'Ya existe un ticket con el nombre "{nombre_clean}"', status=400)

        # Obtener valores válidos de ENUMs desde la base de datos
        categorias_validas = get_enum_values('categoria_ticket')
        areas_validas = get_enum_values('area_ticket')
        tecnologias_validas = get_enum_values('tecnologia_ticket')
        modalidades_validas = get_enum_values('modalidad_ticket')

        # Validar y asignar categoría (insensible a mayúsculas/minúsculas)
        cat_val = body.get('categoria', '').strip()
        matched_cat = next((v for v in categorias_validas if v.lower() == cat_val.lower()), None)
        t.categoria = matched_cat if matched_cat else (categorias_validas[0] if categorias_validas else 'incidencia')

        # Validar y asignar área (insensible a mayúsculas/minúsculas)
        area_val = body.get('area', '').strip()
        matched_area = next((v for v in areas_validas if v.lower() == area_val.lower()), None)
        t.area = matched_area if matched_area else (areas_validas[0] if areas_validas else 'REMOTO')

        # Validar y asignar tecnología (insensible a mayúsculas/minúsculas)
        tec_val = body.get('tecnologia', '').strip()
        matched_tec = next((v for v in tecnologias_validas if v.lower() == tec_val.lower()), None)
        t.tecnologia = matched_tec if matched_tec else (tecnologias_validas[0] if tecnologias_validas else 'todos')

        # Validar y asignar modalidad (insensible a mayúsculas/minúsculas)
        mod_val = body.get('modalidad', '').strip()
        matched_mod = next((v for v in modalidades_validas if v.lower() == mod_val.lower()), None)
        t.modalidad = matched_mod if matched_mod else (modalidades_validas[0] if modalidades_validas else 'remoto')
        t.nombre_ticket = nombre_clean
        t.funciones_especiales = body.get('funciones_especiales', '')
        t.flag_funciones_especiales = bool(body.get('flag_funciones_especiales', False))
        t.precio_base = float(body.get('precio_base') or 0)
        t.activo = bool(body.get('activo', True))
        t.permite_eliminar = bool(body.get('permite_eliminar', True))
        t.editar_mapa = bool(body.get('editar_mapa', False))
        t.mantiene_equipo_anterior = bool(body.get('mantiene_equipo_anterior', False))
        t.cobra_materiales_liquidar = bool(body.get('cobra_materiales_liquidar', False))
        t.requiere_nuevo_suministro = bool(body.get('requiere_nuevo_suministro', False))
        t.migracion_plan = bool(body.get('migracion_plan', False))
        t.migracion_genera_cambio_equipo = bool(body.get('migracion_genera_cambio_equipo', False))
        t.cambio_equipo = bool(body.get('cambio_equipo', False))
        t.es_instalacion = bool(body.get('es_instalacion', False))
        t.genera_merma = bool(body.get('genera_merma', False))
        t.corte_temporal = bool(body.get('corte_temporal', False))
        t.morosidad = bool(body.get('morosidad', False))
        t.corte_definitivo = bool(body.get('corte_definitivo', False))
        t.instalacion_anexo = bool(body.get('instalacion_anexo', False))
        t.corte_anexo = bool(body.get('corte_anexo', False))
        t.save()

        # Retornar el ticket completo para actualizar el frontend
        ticket_data = {
            'id': t.id,
            'nombre': t.nombre_ticket,
            'categoria': t.categoria,
            'area': t.area,
            'tecnologia': t.tecnologia,
            'modalidad': t.modalidad,
            'precio_base': t.precio_base,
            'activo': t.activo,
            'permite_eliminar': t.permite_eliminar,
            'migracion_plan': t.migracion_plan,
            'migracion_genera_cambio_equipo': t.migracion_genera_cambio_equipo,
            'es_instalacion': t.es_instalacion,
            'cobra_materiales_liquidar': t.cobra_materiales_liquidar,
            'editar_mapa': t.editar_mapa,
            'mantiene_equipo_anterior': t.mantiene_equipo_anterior,
            'requiere_nuevo_suministro': t.requiere_nuevo_suministro,
            'genera_merma': t.genera_merma,
            'cambio_equipo': t.cambio_equipo,
            'corte_temporal': t.corte_temporal,
            'morosidad': t.morosidad,
            'corte_definitivo': t.corte_definitivo,
            'instalacion_anexo': t.instalacion_anexo,
            'corte_anexo': t.corte_anexo,
            'es_universal': t.es_universal,
        }

        return JsonResponse({'status': 'success', 'ticket': ticket_data})
    except Exception as e:
        return senderror(str(e), status=500)
