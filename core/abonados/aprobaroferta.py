from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.utils import timezone
from core.auth.comun import checksession, getloggeduser, senderror, sendsuccess

@csrf_exempt
@require_POST
def aprobar_oferta(request):
    """POST /api/abonados/aprobar-oferta/"""
    if not checksession(request):
        return senderror('Sin sesión activa', status=401)
    
    user = getloggeduser(request)
    if not user:
        return senderror('Usuario no encontrado', status=404)
    
    # Solo admin y supervisores ATC pueden aprobar ofertas
    if user.rol not in ['tac', 'atc']:
        return senderror('No tiene permisos para aprobar ofertas', status=403)
    
    try:
        import json
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return senderror('JSON inválido', status=400)
    
    suscripcion_id = body.get('suscripcion_id')
    if not suscripcion_id:
        return senderror('suscripcion_id es requerido', status=400)
    
    from core.models.models_generados import ServiciosAbonados
    
    try:
        servicio = ServiciosAbonados.objects.get(codigo=suscripcion_id)
    except ServiciosAbonados.DoesNotExist:
        return senderror('Servicio no encontrado', status=404)
    
    # Verificar que tenga oferta pendiente
    if not isinstance(servicio.control_operativo_json, dict):
        servicio.control_operativo_json = {}
    
    oferta = servicio.control_operativo_json.get('oferta', {})
    if not oferta or oferta.get('estado') != 'pendiente_aprobacion':
        return senderror('No hay oferta pendiente de aprobación', status=400)
    
    # Actualizar estado de la oferta
    oferta['estado'] = 'aprobada'
    oferta['aprobado_por_id'] = user.id
    oferta['aprobado_por_nombre'] = user.nombre_completo
    oferta['fecha_aprobacion'] = timezone.now().isoformat()
    
    servicio.control_operativo_json['oferta'] = oferta
    
    # Si el servicio está pendiente de instalación, activarlo
    if servicio.estado_servicio == 'pendiente_instalacion':
        servicio.estado_servicio = 'activo'
        servicio.save(update_fields=['estado_servicio', 'control_operativo_json'])
    else:
        servicio.save(update_fields=['control_operativo_json'])
    
    return sendsuccess('Oferta aprobada exitosamente', {
        'suscripcion_id': suscripcion_id,
        'oferta': oferta
    })
