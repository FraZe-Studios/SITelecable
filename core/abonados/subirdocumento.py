from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.core.exceptions import ValidationError
from core.models.models_generados import ServiciosAbonados
from core.abonados.archivos import sistema_guardado_archivo_cliente
from core.auth.comun import senderror

@csrf_exempt
@require_POST
def subirdocumento(request):
    """Sube contrato firmado, DNI, recibo de luz o evidencia de pago."""
    cliente_id = (request.POST.get('cliente_id') or '').strip()
    suscripcion_id = (request.POST.get('suscripcion_id') or '').strip()
    tipo = (request.POST.get('tipo') or '').strip().lower()
    upload = request.FILES.get('archivo')

    if not cliente_id or not upload:
        return senderror('cliente_id y archivo requeridos', status=400)

    mapa_categoria = {
        'contrato': 'contratos',
        'dni': 'documentos',
        'recibo_luz': 'documentos',
        'evidencia_pago': 'pagos',
        'liquidacion': 'liquidaciones',
    }
    categoria = mapa_categoria.get(tipo, 'otros')

    try:
        guardado = sistema_guardado_archivo_cliente(upload, cliente_id, categoria, nombre_base=None)
    except ValueError as exc:
        return senderror(str(exc), status=400)

    if suscripcion_id:
        try:
            from core.abonados.geoutils import parse_cliente_id
            parsed_cliente_id = parse_cliente_id(cliente_id)
            if str(suscripcion_id).isdigit():
                sub = ServiciosAbonados.objects.filter(id=int(suscripcion_id), cliente_id=parsed_cliente_id).first()
            else:
                sub = ServiciosAbonados.objects.filter(codigo=suscripcion_id, cliente_id=parsed_cliente_id).first()
            
            if sub:
                campos = []
                if tipo == 'contrato':
                    sub.contrato_pdf_url = guardado['url']
                    campos.append('contrato_pdf_url')
                elif tipo == 'dni':
                    sub.documento_dni_url = guardado['url']
                    campos.append('documento_dni_url')
                elif tipo == 'recibo_luz':
                    sub.documento_recibo_luz_url = guardado['url']
                    campos.append('documento_recibo_luz_url')
                if campos:
                    sub.save(update_fields=campos)
        except (ValueError, TypeError, ValidationError, ServiciosAbonados.DoesNotExist):
            pass

    return JsonResponse({'status': 'success', 'data': guardado})
