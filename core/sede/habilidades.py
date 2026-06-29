import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.usuarios import Usuario
from core.auth.comun import checksession, senderror

@csrf_exempt
def habilidades(request):
    """POST /api/sede/config/habilidades/ — Guarda los límites financieros del asesor."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)

    if request.method != 'POST':
        return senderror('Método no permitido', status=405)

    try:
        body = json.loads(request.body)
        print(f"Datos recibidos: {body}")
        empleado = Usuario.objects.get(pk=int(body['personal_id']))
        print(f"Empleado encontrado: {empleado.username}, ID: {empleado.id}")

        # Actualizar habilidades_json del Usuario
        habilidades_json = empleado.habilidades_json or {}
        print(f"habilidades_json actual: {habilidades_json}")
        if 'habilidades_globales' not in habilidades_json:
            habilidades_json['habilidades_globales'] = {
                'tickets_cobro': {'descuento_maximo_porcentaje': 0, 'cuotas_maximas': 0},
                'deudas_antiguas': {'descuento_maximo_porcentaje': 0, 'cuotas_maximas': 0},
                'planes_mensuales': {'descuento_maximo_porcentaje': 100, 'meses_maximos': 0, 'requiere_autorizacion_supervisor': False}
            }
        
        hg = habilidades_json['habilidades_globales']
        
        # Tickets de cobro (instalación, traslados, equipos)
        val_tickets_descuento = body.get('tickets_cobro_descuento_maximo_porcentaje')
        hg['tickets_cobro']['descuento_maximo_porcentaje'] = int(val_tickets_descuento) if val_tickets_descuento not in (None, '', 'null') else 0
        
        val_tickets_cuotas = body.get('tickets_cobro_cuotas_maximas')
        hg['tickets_cobro']['cuotas_maximas'] = int(val_tickets_cuotas) if val_tickets_cuotas not in (None, '', 'null') else 0
        
        # Deudas antiguas
        val_deudas_descuento = body.get('deudas_antiguas_descuento_maximo_porcentaje')
        hg['deudas_antiguas']['descuento_maximo_porcentaje'] = int(val_deudas_descuento) if val_deudas_descuento not in (None, '', 'null') else 0
        
        val_deudas_cuotas = body.get('deudas_antiguas_cuotas_maximas')
        hg['deudas_antiguas']['cuotas_maximas'] = int(val_deudas_cuotas) if val_deudas_cuotas not in (None, '', 'null') else 0
        
        # Planes mensuales
        
        val_planes_max = body.get('planes_mensuales_descuento_maximo_porcentaje')
        hg['planes_mensuales']['descuento_maximo_porcentaje'] = int(val_planes_max) if val_planes_max not in (None, '', 'null') else 100
        
        val_planes_meses = body.get('planes_mensuales_meses_maximos')
        hg['planes_mensuales']['meses_maximos'] = int(val_planes_meses) if val_planes_meses not in (None, '', 'null') else 0
        
        val_planes_auth = body.get('planes_mensuales_requiere_autorizacion_supervisor')
        hg['planes_mensuales']['requiere_autorizacion_supervisor'] = bool(val_planes_auth == 'on' or val_planes_auth == True)

        print(f"habilidades_json a guardar: {habilidades_json}")
        empleado.habilidades_json = habilidades_json
        empleado.save(update_fields=['habilidades_json'])
        print(f"Guardado exitoso para empleado {empleado.username}")

        return JsonResponse({'status': 'success'})

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error guardando habilidades: {str(e)}\n{error_details}")
        return senderror(f"{str(e)}", status=500)
