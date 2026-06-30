from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET
from core.auth.comun import checksession, getloggeduser, senderror

@csrf_exempt
@require_GET
def obtener_oferta(request):
    """GET /api/abonados/obtener-oferta/"""
    if not checksession(request):
        return senderror('Sin sesión activa', status=401)
    
    user = getloggeduser(request)
    if not user:
        return senderror('Usuario no encontrado', status=404)
    
    suscripcion_id = request.GET.get('suscripcion_id')
    if not suscripcion_id:
        return senderror('suscripcion_id es requerido', status=400)
    
    from core.models.models_generados import ServiciosAbonados
    
    try:
        servicio = ServiciosAbonados.objects.get(codigo=suscripcion_id)
    except ServiciosAbonados.DoesNotExist:
        return senderror('Servicio no encontrado', status=404)
    
    # Get offer details from control_operativo_json
    if not isinstance(servicio.control_operativo_json, dict):
        servicio.control_operativo_json = {}
    
    oferta = servicio.control_operativo_json.get('oferta', {})
    
    # Get plan details if plan_id exists
    plan_nombre = oferta.get('plan_nombre')
    if oferta.get('plan_id') and not plan_nombre:
        try:
            from core.models.models_generados import Planes
            plan = Planes.objects.get(id=oferta['plan_id'])
            plan_nombre = plan.nombre_plan
        except Planes.DoesNotExist:
            pass
    
    # Enhance offer data with plan name
    if plan_nombre:
        oferta['plan_nombre'] = plan_nombre
    
    return JsonResponse({'status': 'success', 'data': {'oferta': oferta}})
