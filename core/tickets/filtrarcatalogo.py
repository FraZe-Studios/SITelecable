from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q
from core.models.models_generados import CatalogoTickets
from core.auth.comun import senderror

@csrf_exempt
def filtrarcatalogo(request):
    """
    Filtrar catálogo de tickets operativos.
    GET /api/net/catalogo-tickets/?categoria=X&area=Y&tecnologia=Z&modalidad=W
    """
    categoria = request.GET.get('categoria', '')
    area = request.GET.get('area', '')
    tecnologia = request.GET.get('tecnologia', '')
    modalidad = request.GET.get('modalidad', '')
    sede_id = request.GET.get('sede_id', '')
    es_universal = request.GET.get('es_universal', '')
    
    queryset = CatalogoTickets.objects.filter(activo=True)
    
    if categoria:
        cat_lower = categoria.lower()
        if cat_lower not in ('todos', 'todas'):
            queryset = queryset.filter(categoria__iexact=cat_lower)
    if area:
        area_lower = area.lower()
        if area_lower not in ('todos', 'todas'):
            queryset = queryset.filter(area__iexact=area_lower)
    if tecnologia:
        tec_lower = tecnologia.lower()
        if tec_lower not in ('todos', 'todas'):
            queryset = queryset.filter(Q(tecnologia__iexact=tec_lower) | Q(tecnologia__iexact='todos'))
    if modalidad:
        mod_lower = modalidad.lower()
        if mod_lower not in ('todos', 'todas'):
            queryset = queryset.filter(modalidad__iexact=mod_lower)
    # Nota: sede_id y es_universal no son columnas de tickets_plantillas en el esquema actual
    # ya que todos los tickets son universales. Ignoramos esos filtros para evitar FieldError.
    
    tickets_qs = list(queryset.values(
        'id', 'categoria', 'area', 'tecnologia', 'modalidad', 'nombre_ticket',
        'precio_base', 'funciones_especiales', 'configuracion_reglas'
    ))
    
    tickets = []
    for t in tickets_qs:
        fe = t.get('funciones_especiales') or {}
        tickets.append({
            'id': t['id'],
            'categoria': t['categoria'],
            'area': t['area'],
            'tecnologia': t['tecnologia'],
            'modalidad': t['modalidad'],
            'nombre': t['nombre_ticket'],
            'precio_base': str(t['precio_base']),
            'funciones_especiales': fe,
            'flag_funciones_especiales': any(v.get('activado') for v in fe.values()) if fe else False,
            'es_universal': True,
            'sede_id': None,
            'editar_mapa': fe.get('editar_mapa', {}).get('activado', False),
            'mantiene_equipo_anterior': fe.get('mantiene_equipo', {}).get('activado', False),
            'cobra_materiales_liquidar': fe.get('cobra_materiales', {}).get('activado', False),
            'requiere_nuevo_suministro': fe.get('nuevo_suministro', {}).get('activado', False),
            'migracion_plan': fe.get('migracion_plan', {}).get('activado', False),
        })
    
    categorias = CatalogoTickets.objects.filter(activo=True).values_list('categoria', flat=True).distinct()
    areas = CatalogoTickets.objects.filter(activo=True).values_list('area', flat=True).distinct()
    tecnologias = CatalogoTickets.objects.filter(activo=True).values_list('tecnologia', flat=True).distinct()
    modalidades = CatalogoTickets.objects.filter(activo=True).values_list('modalidad', flat=True).distinct()
    
    return JsonResponse({
        'status': 'success',
        'data': tickets,
        'filters': {
            'categorias': list(set(categorias)),
            'areas': list(set(areas)),
            'tecnologias': list(set(tecnologias)),
            'modalidades': list(set(modalidades)),
        }
    })
