import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import Planes
from core.auth.comun import checksession, senderror

@csrf_exempt
def plandinamico(request):
    """
    GET /api/sede/config/plan/dinamico/ - Obtiene configuración dinámica JSONB de un plan
    POST /api/sede/config/plan/dinamico/ - Actualiza configuración dinámica JSONB de un plan
    """
    if not checksession(request):
        return senderror('Sin sesión', status=401)
    
    try:
        if request.method == 'GET':
            plan_id = request.GET.get('plan_id')
            if not plan_id:
                return senderror('plan_id requerido', status=400)
            
            plan = Planes.objects.get(pk=int(plan_id))
            caracteristicas = plan.caracteristicas_tecnicas_json or {}
            
            esquema_maestro = {
                'caracteristicas_base': {
                    'velocidad_mbps': {'label': 'Velocidad (Mbps)', 'tipo': 'integer', 'descripcion': 'Velocidad de conexión en Mbps'},
                    'cantidad_canales': {'label': 'Canales TV', 'tipo': 'integer', 'descripcion': 'Cantidad de canales de TV'},
                    'aplicaciones_digitales': {'label': 'Apps Digitales', 'tipo': 'array', 'descripcion': 'Aplicaciones digitales incluidas'}
                },
                'activacion_funciones': {
                    'admite_prorrogas': {'label': 'Admite Prórrogas', 'tipo': 'boolean', 'descripcion': 'Permite prórrogas de pago'},
                    'compromisos_pago_flexibles': {'label': 'Compromisos de Pago', 'tipo': 'boolean', 'descripcion': 'Admite compromisos de pago flexibles'},
                    'bloqueo_automatico_mora': {'label': 'Bloqueo Automático por Mora', 'tipo': 'boolean', 'descripcion': 'Bloqueo automático del servicio por mora'},
                    'prioridad_soporte_critica': {'label': 'Prioridad Soporte Crítico', 'tipo': 'boolean', 'descripcion': 'Prioridad alta en soporte técnico'}
                },
                'permisos_formularios': {
                    'requiere_api_externa_olt': {'label': 'Requiere API OLT', 'tipo': 'boolean', 'descripcion': 'Requiere conexión con API externa OLT'},
                    'permite_cambio_mufa_campo': {'label': 'Cambio Mufa en Campo', 'tipo': 'boolean', 'descripcion': 'Permite cambio de mufa directamente en campo'}
                }
            }
            
            return JsonResponse({
                'status': 'success',
                'plan': {
                    'id': plan.id,
                    'nombre': plan.nombre,
                    'tipo_servicio': plan.tipo_servicio,
                    'caracteristicas_tecnicas_json': caracteristicas
                },
                'esquema_maestro': esquema_maestro
            })
        
        elif request.method == 'POST':
            body = json.loads(request.body)
            plan_id = body.get('plan_id')
            if not plan_id:
                return senderror('plan_id requerido', status=400)
            
            plan = Planes.objects.get(pk=int(plan_id))
            nuevas_caracteristicas = body.get('caracteristicas_tecnicas_json', {})
            
            caracteristicas_actuales = plan.caracteristicas_tecnicas_json or {}
            caracteristicas_base_actual = caracteristicas_actuales.get('caracteristicas_base', {})
            caracteristicas_base_nueva = nuevas_caracteristicas.get('caracteristicas_base', {})
            
            caracteristicas_base_fusionado = {**caracteristicas_base_actual}
            if caracteristicas_base_nueva:
                for key, value in caracteristicas_base_nueva.items():
                    if key in ['velocidad_mbps', 'cantidad_canales']:
                        if value is not None and value != 0:
                            caracteristicas_base_fusionado[key] = value
                    else:
                        caracteristicas_base_fusionado[key] = value
            
            caracteristicas_fusionado = {
                'caracteristicas_base': caracteristicas_base_fusionado,
                'activacion_funciones': nuevas_caracteristicas.get('activacion_funciones', {}),
                'permisos_formularios': nuevas_caracteristicas.get('permisos_formularios', {})
            }
            
            plan.caracteristicas_tecnicas_json = caracteristicas_fusionado
            plan.save()
            
            return JsonResponse({
                'status': 'success',
                'caracteristicas_tecnicas_json': plan.caracteristicas_tecnicas_json
            })
        
        else:
            return senderror('Método no permitido', status=405)
            
    except Planes.DoesNotExist:
        return senderror('Plan no encontrado', status=404)
    except Exception as e:
        return senderror(str(e), status=500)
