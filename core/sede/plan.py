import json
import math
from decimal import Decimal
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import Sedes, Planes, PlanAnexosTv
from core.auth.comun import checksession, senderror

def _require_sede_id(body):
    sede_id = body.get('sede_id')
    if sede_id is None or sede_id == '':
        raise ValueError('sede_id requerido')
    return int(sede_id)

@csrf_exempt
def plan(request):
    """POST /api/sede/config/plan/ — Crea o actualiza un plan comercial."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)
        
    try:
        body = json.loads(request.body)
        sede = Sedes.objects.get(pk=_require_sede_id(body))
        plan_id = body.get('plan_id') or None
        
        if plan_id:
            plan_obj = Planes.objects.get(pk=int(plan_id), sede=sede)
        else:
            plan_obj = Planes(sede=sede)
            
        tipo = body['tipo_servicio'].upper()
        if tipo not in ('TV', 'INTERNET', 'APP', 'DUO', 'SERVICIO'):
            return senderror('Tipo de servicio inválido', status=400)

        plan_obj.tipo_servicio = tipo.lower()
        tipo_cli = body.get('tipo_cliente', 'RESIDENCIAL').upper()
        if tipo_cli not in ('RESIDENCIAL', 'CORPORATIVO'):
            return senderror('Tipo de cliente inválido', status=400)
            
        plan_obj.tipo_cliente = tipo_cli.lower()
        plan_obj.nombre_plan = body['nombre_plan'].strip()
        plan_obj.costo_plan = Decimal(str(round(float(body['costo_plan']), 2)))
        plan_obj.admite_prorroga = bool(body.get('admite_prorroga', True))
        plan_obj.admite_prorrateo = bool(body.get('admite_prorrateo', True))
        
        # Asegurar que dias_amnistia acepte explícitamente el valor 0
        dias_amnistia = body.get('dias_amnistia')
        if dias_amnistia is not None:
            plan_obj.dias_amnistia = int(dias_amnistia)
        else:
            plan_obj.dias_amnistia = 0
        
        config_pago = body.get('configuracion_fecha_pago', 'FIN_DE_MES').upper()
        plan_obj.configuracion_fecha_pago = 'fecha_instalacion' if config_pago == 'FECHA_INSTALACION' else 'fin_mes'
        plan_obj.monto_descuento_pago_anticipado = float(round(float(body.get('monto_descuento_pago_anticipado') or 0), 2))
        plan_obj.dias_anticipacion_descuento = int(body.get('dias_anticipacion_descuento') or 0)
        
        if hasattr(plan_obj, 'admite_compromiso_pago'):
            # Read from top-level key or from nested JSON body structure (compromisos_pago_flexibles)
            nested = (body.get('caracteristicas_tecnicas_json') or {}).get('activacion_funciones', {}).get('compromisos_pago_flexibles', None)
            top_level = body.get('admite_compromiso_pago', None)
            plan_obj.admite_compromiso_pago = bool(top_level if top_level is not None else (nested if nested is not None else False))

        caracteristicas = plan_obj.caracteristicas_tecnicas_json or {}
        
        custom_tipo = body.get('custom_tipo_servicio')
        if custom_tipo:
            caracteristicas['custom_tipo_servicio'] = str(custom_tipo).strip().lower()
        else:
            caracteristicas.pop('custom_tipo_servicio', None)
        
        if 'caracteristicas_base' not in caracteristicas:
            caracteristicas['caracteristicas_base'] = {}
        if 'activacion_funciones' not in caracteristicas:
            caracteristicas['activacion_funciones'] = {}
        if 'permisos_formularios' not in caracteristicas:
            caracteristicas['permisos_formularios'] = {}
        
        caracteristicas_base = caracteristicas['caracteristicas_base']
        activacion_funciones = caracteristicas['activacion_funciones']
        permisos_formularios = caracteristicas['permisos_formularios']
        
        if tipo in ('INTERNET', 'DUO', 'SERVICIO'):
            caracteristicas_base['velocidad_mbps'] = int(body.get('velocidad_mbps') or 0)
        else:
            caracteristicas_base.pop('velocidad_mbps', None)

        if tipo in ('TV', 'DUO', 'SERVICIO'):
            caracteristicas_base['cantidad_canales'] = int(body.get('cantidad_canales_tv') or 0)
            plan_obj.cantidad_canales_tv = int(body.get('cantidad_canales_tv') or 0)
            plan_obj.conexiones_tv_gratis = int(body.get('conexiones_tv_gratis') or 2)
            plan_obj.costo_conexion_tv_adicional = float(round(float(body.get('costo_conexion_tv_adicional') or 0), 2))
        else:
            caracteristicas_base.pop('cantidad_canales', None)
            plan_obj.cantidad_canales_tv = 0
            plan_obj.conexiones_tv_gratis = 0
            plan_obj.costo_conexion_tv_adicional = 0
        
        activacion_funciones['admite_prorrogas'] = bool(body.get('admite_prorroga', True))
        # Read compromisos_pago_flexibles from nested JSON body or top-level key, defaulting to False
        _nested_comp = (body.get('caracteristicas_tecnicas_json') or {}).get('activacion_funciones', {}).get('compromisos_pago_flexibles', None)
        _top_comp = body.get('admite_compromiso_pago', None)
        activacion_funciones['compromisos_pago_flexibles'] = bool(_top_comp if _top_comp is not None else (_nested_comp if _nested_comp is not None else False))
        activacion_funciones['bloqueo_automatico_mora'] = bool(body.get('bloqueo_automatico_mora', False))
        activacion_funciones['prioridad_soporte_critica'] = bool(body.get('prioridad_soporte_critica', False))
        
        permisos_formularios['requiere_api_externa_olt'] = bool(body.get('requiere_api_externa_olt', False))
        permisos_formularios['permite_cambio_mufa_campo'] = bool(body.get('permite_cambio_mufa_campo', False))

        plan_obj.caracteristicas_tecnicas_json = caracteristicas
        plan_obj.save()

        # Anexos TV (solo TV y DUO)
        if tipo in ('TV', 'DUO'):
            PlanAnexosTv.objects.filter(plan=plan_obj).delete()
            for anexo in body.get('anexos_tv') or []:
                nombre = (anexo.get('nombre') or '').strip()
                if not nombre:
                    continue
                PlanAnexosTv.objects.create(
                    plan=plan_obj,
                    nombre=nombre,
                    precio_adicional=float(anexo.get('precio_adicional') or 0),
                    activo=True,
                )
        else:
            PlanAnexosTv.objects.filter(plan=plan_obj).delete()

        return JsonResponse({'status': 'success', 'plan_id': plan_obj.id})
        
    except Exception as e:
        return senderror(str(e), status=500)
