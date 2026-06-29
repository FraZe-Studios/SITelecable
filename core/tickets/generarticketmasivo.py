import json
from decimal import Decimal
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.utils import timezone
from core.models.infraestructura import CajasNap, Mufas
from core.models.models_generados import CatalogoTickets, ServiciosAbonados, TicketsOrdenes
from core.auth.comun import senderror

@csrf_exempt
@require_POST
def generarticketmasivo(request):
    """POST /api/abonados/generar-ticket-masivo/"""
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return senderror('JSON inválido', status=400)

    sede_id = body.get('sede_id')
    tipo_elemento = body.get('tipo_elemento')
    elemento_id = body.get('elemento_id')
    referencia_ubicacion = (body.get('referencia_ubicacion') or '').strip()
    catalogo_id = body.get('catalogo_ticket_id')
    motivo = (body.get('motivo') or '').strip()
    afectar_abonados = bool(body.get('afectar_abonados'))

    if not tipo_elemento or not catalogo_id or not motivo:
        return senderror('tipo_elemento, catalogo_ticket_id y motivo son requeridos', status=400)

    try:
        catalogo = CatalogoTickets.objects.get(pk=int(catalogo_id), activo=True)
    except CatalogoTickets.DoesNotExist:
        return senderror('Ticket del catálogo no encontrado', status=400)

    servicios = []
    
    if tipo_elemento == 'NAP':
        if not elemento_id:
            return senderror('elemento_id requerido para Caja NAP', status=400)
        try:
            nap = CajasNap.objects.get(pk=int(elemento_id))
        except CajasNap.DoesNotExist:
            return senderror('Caja NAP no encontrada', status=400)
            
        servicios = list(ServiciosAbonados.objects.filter(caja_nap_id=nap.id, activo=True))
        prefijo_incidencia = f"[TICKET MASIVO - NAP: {nap.codigo}]"
        
    elif tipo_elemento == 'MUFA':
        if not elemento_id:
            return senderror('elemento_id requerido para Mufa', status=400)
        try:
            mufa = Mufas.objects.get(pk=int(elemento_id))
        except Mufas.DoesNotExist:
            return senderror('Mufa no encontrada', status=400)
            
        prefijo_incidencia = f"[TICKET MASIVO - MUFA: {mufa.nombre}]"
        
        if mufa.latitud and mufa.longitud:
            naps = CajasNap.objects.filter(
                latitud__gte=mufa.latitud - Decimal('0.005'),
                latitud__lte=mufa.latitud + Decimal('0.005'),
                longitud__gte=mufa.longitud - Decimal('0.005'),
                longitud__lte=mufa.longitud + Decimal('0.005'),
                activo=True
            )
            nap_ids = [n.id for n in naps]
            if nap_ids:
                servicios = list(ServiciosAbonados.objects.filter(caja_nap_id__in=nap_ids, activo=True))
        else:
            if sede_id:
                servicios = list(ServiciosAbonados.objects.filter(caja_nap__sector__sede_id=int(sede_id), activo=True))
            else:
                return senderror('La Mufa no tiene coordenadas y no se especificó sede', status=400)
                
    elif tipo_elemento == 'GENERAL':
        if not sede_id:
            return senderror('Sede requerida para ubicación General', status=400)
            
        ref_text = referencia_ubicacion or 'General'
        prefijo_incidencia = f"[TICKET MASIVO - PLANTA EXTERNA: {ref_text}]"
        
        servicios = list(ServiciosAbonados.objects.filter(caja_nap__sector__sede_id=int(sede_id), activo=True))
        
    else:
        return senderror('Tipo de elemento no válido', status=400)

    area_val = 'planta_externa'
    modalidad_val = 'presencial' if catalogo.modalidad.lower() in ('campo', 'presencial') else 'remoto'
    
    categoria_val = (catalogo.categoria or 'Incidencia').strip()
    categorias_validas_lower = [
        'incidencia', 'requerimiento', 'avería', 'averia', 'otros',
        'instalacion', 'mantenimiento', 'soporte', 'cambio_plan', 'traslado', 'baja', 'reparacion', 'todos'
    ]
    if not categoria_val or categoria_val.lower() not in sorted(categorias_validas_lower):
        categoria_val = 'incidencia'
        
    tecnologia_val = (catalogo.tecnologia or 'todos').lower()
    if 'fibra' in tecnologia_val:
        tecnologia_val = 'fibra_optica'
    elif tecnologia_val not in ['fibra_optica', 'cobre', 'wireless', 'satelital', 'todos']:
        tecnologia_val = 'todos'

    tickets_creados = 0
    if afectar_abonados and servicios:
        for svc in servicios:
            TicketsOrdenes.objects.create(
                servicio_id=svc.id_suscripcion,
                categoria=categoria_val,
                nombre_ticket=catalogo.nombre_ticket,
                area=area_val,
                tecnologia=tecnologia_val,
                modalidad=modalidad_val,
                estado='pendiente',
                prioridad='media',
                precio_base=catalogo.precio_base or Decimal('0.00'),
                fecha_creacion=timezone.now(),
                notas=f"{prefijo_incidencia}\n\n{motivo}"
            )
            tickets_creados += 1
    else:
        return senderror('Se requiere generar la afectación de abonados ya que todo ticket debe estar asociado a un servicio de cliente activo.', status=400)

    return JsonResponse({
        'status': 'success',
        'data': {
            'tickets_creados': tickets_creados,
            'mensaje': f'Se generaron exitosamente {tickets_creados} tickets de planta externa.'
        }
    })
