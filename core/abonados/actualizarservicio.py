import json
from decimal import Decimal
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from core.models.models_generados import ServiciosAbonados
from core.abonados.contextovendedor import sistema_obtener_contexto_vendedor
from core.abonados.permisos import puede_editar_servicio
from core.auth.comun import senderror

@csrf_exempt
@require_POST
def actualizarservicio(request):
    """POST /api/abonados/actualizar-servicio/"""
    username = request.session.get('username', '')
    ctx = sistema_obtener_contexto_vendedor(username)
    if not puede_editar_servicio(ctx.get('cargo')):
        return senderror('Sin permiso para editar servicio', status=403)
        
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return senderror('JSON inválido', status=400)

    suscripcion_id = body.get('suscripcion_id')
    if not suscripcion_id:
        return senderror('suscripcion_id requerido', status=400)

    try:
        try:
            sub = ServiciosAbonados.objects.get(codigo=suscripcion_id)
        except ServiciosAbonados.DoesNotExist:
            return senderror('Suscripción no encontrada', status=404)

        nuevo_suministro = body.get('numero_suministro') or body.get('suministro_id')
        if nuevo_suministro and nuevo_suministro != sub.numero_suministro:
            from core.abonados.suministros import consultar_suministro_con_cache
            res = consultar_suministro_con_cache(nuevo_suministro)
            if res and res.get('status') == 'success':
                sum_data = res['data']
                sub.numero_suministro = nuevo_suministro
                sub.direccion_servicio = sum_data.get('direccion') or sub.direccion_servicio
                sub.distrito = sum_data.get('distrito') or sub.distrito
                sub.provincia = sum_data.get('provincia') or sub.provincia
                sub.departamento = sum_data.get('departamento') or sub.departamento
                if sum_data.get('latitud'):
                    sub.latitud = Decimal(str(sum_data['latitud']))
                if sum_data.get('longitud'):
                    sub.longitud = Decimal(str(sum_data['longitud']))

        if 'direccion_servicio' in body:
            sub.direccion_servicio = body['direccion_servicio']
        if 'distrito' in body:
            sub.distrito = body['distrito']
        if 'provincia' in body:
            sub.provincia = body['provincia']
        if 'departamento' in body:
            sub.departamento = body['departamento']
        if 'deuda_acumulada' in body:
            val = body['deuda_acumulada']
            sub.deuda_acumulada = Decimal(str(val)) if val is not None and str(val).strip() != '' else Decimal('0.00')
        if 'caja_nap_id' in body or 'nap_id' in body:
            nap_val = body.get('caja_nap_id') or body.get('nap_id')
            if nap_val and str(nap_val).strip() not in ('', '—', 'None'):
                val_str = str(nap_val).strip()
                if val_str.isdigit():
                    sub.caja_nap_id = int(val_str)
                else:
                    from core.models.infraestructura import CajasNap
                    try:
                        nap_obj = CajasNap.objects.get(codigo__iexact=val_str)
                        sub.caja_nap_id = nap_obj.id
                    except CajasNap.DoesNotExist:
                        try:
                            nap_obj = CajasNap.objects.get(codigo__icontains=val_str)
                            sub.caja_nap_id = nap_obj.id
                        except (CajasNap.DoesNotExist, CajasNap.MultipleObjectsReturned):
                            pass
        if 'plan_id' in body:
            sub.plan_id = int(body['plan_id'])
        if 'estado_servicio' in body:
            sub.estado_servicio = body['estado_servicio'].lower()
        
        if 'latitud' in body or 'gps_latitud' in body:
            val = body.get('latitud') or body.get('gps_latitud')
            sub.latitud = Decimal(str(val)) if val is not None and str(val).strip() != '' else None
        if 'longitud' in body or 'gps_longitud' in body:
            val = body.get('longitud') or body.get('gps_longitud')
            sub.longitud = Decimal(str(val)) if val is not None and str(val).strip() != '' else None

        for key in ['observaciones', 'presinto_numero', 'puerto_nap', 'referencia_domicilio', 'hub_borne_referencia', 'numero_anexos', 'fecha_limite_corte', 'router_serie', 'router_modelo', 'modelo_equipo']:
            if key in body:
                setattr(sub, key, body[key])
        if 'router_mac' in body:
            from core.tickets.liquidacion import _sanear_material_mac
            sub.router_mac = _sanear_material_mac(body['router_mac'])

        if 'fecha_instalacion' in body:
            val = body['fecha_instalacion']
            if val:
                from datetime import datetime
                if isinstance(val, str):
                    try:
                        sub.fecha_instalacion = datetime.strptime(val[:10], '%Y-%m-%d').date()
                    except ValueError:
                        pass
                else:
                    sub.fecha_instalacion = val
            else:
                sub.fecha_instalacion = None

        sub.save()
        from core.abonados.generador import obtener_codigo_servicio_actualizado
        codigo_servicio_actualizado = obtener_codigo_servicio_actualizado(sub)
        if sub.codigo != codigo_servicio_actualizado:
            sub.codigo = codigo_servicio_actualizado
            sub.save(update_fields=['codigo'])
    except ValueError as exc:
        return senderror(str(exc), status=400)
        
    return JsonResponse({'status': 'success', 'data': {'suscripcion_id': sub.codigo}})
