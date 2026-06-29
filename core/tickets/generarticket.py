import json
from decimal import Decimal
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.utils import timezone
from core.models.models_generados import CatalogoTickets, ServiciosAbonados, TicketsOrdenes
from core.abonados.contextovendedor import sistema_obtener_contexto_vendedor
from core.auth.comun import senderror

@csrf_exempt
@require_POST
def generarticket(request):
    """POST /api/abonados/generar-ticket/"""
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return senderror('JSON inválido', status=400)

    suscripcion_id = body.get('suscripcion_id')
    catalogo_id = body.get('catalogo_ticket_id')
    derivar_campo = bool(body.get('derivar_campo'))
    motivo = (body.get('motivo') or '').strip()
    cargo_materiales = body.get('cargo_materiales') or 'empresa'
    nuevo_suministro = (body.get('nuevo_suministro') or '').strip() or None
    nuevo_plan_id = body.get('nuevo_plan_id') or None
    cambio_equipo = bool(body.get('cambio_equipo', False))

    if not suscripcion_id:
        return senderror('suscripcion_id requerido', status=400)

    sub = None
    try:
        if str(suscripcion_id).isdigit():
            sub = ServiciosAbonados.objects.select_related('plan').filter(id=int(suscripcion_id)).first()
        else:
            sub = ServiciosAbonados.objects.select_related('plan').filter(codigo=suscripcion_id).first()
    except Exception:
        pass

    if not sub:
        return senderror('Suscripción no encontrada', status=404)

    catalogo = None
    if catalogo_id:
        try:
            catalogo = CatalogoTickets.objects.get(pk=catalogo_id, activo=True)
        except CatalogoTickets.DoesNotExist:
            return senderror('Tipo de ticket no válido', status=400)

    if catalogo:
        categoria_val = (catalogo.categoria or '').strip()
        nombre_ticket_val = catalogo.nombre_ticket
        area_val = (catalogo.area or 'soporte').lower().replace(' ', '_')
        tecnologia_val = (catalogo.tecnologia or 'todos').lower()
        modalidad_val = (catalogo.modalidad or 'remoto').lower()
        precio_base_val = catalogo.precio_base or Decimal('0.00')
    else:
        categoria_val = 'Otros'
        nombre_ticket_val = motivo[:200] if motivo else 'Soporte General'
        area_val = 'soporte'
        tecnologia_val = 'todos'
        modalidad_val = 'remoto'
        precio_base_val = Decimal('0.00')

    if derivar_campo:
        modalidad_val = 'presencial'
        area_val = 'planta_externa'

    categorias_validas_lower = [
        'incidencia', 'requerimiento', 'avería', 'averia',
        'instalacion', 'mantenimiento', 'soporte', 'cambio_plan', 'traslado', 'baja', 'reparacion', 'todos'
    ]
    if not categoria_val or categoria_val.lower() not in sorted(categorias_validas_lower):
        categoria_val = 'incidencia'
    if area_val not in ['red', 'comercial', 'facturacion', 'soporte', 'infraestructura', 'todos', 'planta_interna', 'planta_externa']:
        area_val = 'soporte'
    if 'fibra' in tecnologia_val:
        tecnologia_val = 'fibra_optica'
    elif tecnologia_val not in ['fibra_optica', 'cobre', 'wireless', 'satelital', 'todos']:
        tecnologia_val = 'todos'
    if modalidad_val == 'campo':
        modalidad_val = 'presencial'
    elif modalidad_val not in ['presencial', 'remoto', 'programado', 'urgente', 'todos']:
        modalidad_val = 'remoto'

    estado_val = 'pendiente'

    config_reglas = {'permisos': {}}
    config_reglas['permisos']['cobra_materiales_liquidar'] = (cargo_materiales == 'abonado')
    if nuevo_suministro:
        config_reglas['nuevo_suministro'] = nuevo_suministro
    if nuevo_plan_id:
        try:
            config_reglas['nuevo_plan_id'] = int(nuevo_plan_id)
        except (ValueError, TypeError):
            pass
    if cambio_equipo:
        config_reglas['cambio_equipo'] = True

    ticket = TicketsOrdenes.objects.create(
        servicio_id=sub.id_suscripcion,
        categoria=categoria_val,
        nombre_ticket=nombre_ticket_val,
        area=area_val,
        tecnologia=tecnologia_val,
        modalidad=modalidad_val,
        estado=estado_val,
        prioridad='media',
        precio_base=precio_base_val,
        fecha_creacion=timezone.now(),
        notas=motivo if motivo else None,
        configuracion_reglas=config_reglas,
    )

    return JsonResponse({
        'status': 'success',
        'data': {
            'ticket_id': ticket.id,
            'estado': ticket.estado_ticket,
            'tipo': ticket.tipo_ticket,
        },
    })
