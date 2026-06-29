import json
import zipfile
import io
import base64
from django.http import JsonResponse
from django.utils import timezone
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from core.models.models_generados import ComprobantesSunat
from core.sunat import xml as sunat_logic
from core.auth.comun import checksession, senderror

def base64_to_bytes(b64_string: str) -> bytes:
    return base64.b64decode(b64_string)

@csrf_exempt
@require_POST
def enviar(request):
    """
    API asíncrona para simular la firma y transmisión del comprobante a SUNAT.
    """
    if not checksession(request):
        return senderror('Sin sesión activa', status=401)

    if request.method != 'POST':
        return senderror('Método no permitido', status=405)

    try:
        data = json.loads(request.body)
        comprobante_id = data.get('comprobante_id')
    except Exception:
        return senderror('JSON inválido', status=400)

    if not comprobante_id:
        return senderror('comprobante_id requerido', status=400)

    try:
        c = ComprobantesSunat.objects.get(pk=comprobante_id)
    except ComprobantesSunat.DoesNotExist:
        return senderror('Comprobante no encontrado', status=404)

    ruc_emisor = c.ruc_emisor
    cliente = c.cliente

    if not ruc_emisor:
        return senderror('El comprobante no tiene un emisor de RUC válido', status=400)
    if not cliente:
        return senderror('El comprobante no tiene un cliente válido', status=400)

    # Estructurar items por defecto
    items = [{
        'descripcion': 'Servicios de telecomunicaciones e internet',
        'cantidad': 1.0,
        'precio_unitario': float(c.monto_subtotal)
    }]

    # Validar datos antes del XML
    valido, error_msg = sunat_logic.sistema_validacion_datos_comprobante(
        ruc_emisor.ruc_numero, c.serie, c.correlativo, items
    )
    if not valido:
        c.estado_sunat = 'rechazado'
        c.mensaje_error_sunat = error_msg
        c.save()
        return JsonResponse({'status': 'error', 'message': f'Error de validación: {error_msg}'})

    # Simular contingencia o rechazo si faltan credenciales SOL cruciales en el RUC
    if not ruc_emisor.usuario_sol or not ruc_emisor.password_sol:
        c.estado_sunat = 'rechazado'
        c.mensaje_error_sunat = 'Error SOAP: Credenciales SOL incompletas o no autorizadas'
        c.save()
        return senderror('Faltan credenciales SOL en la configuración fiscal')

    # 1. Generar XML UBL 2.1
    tipo_comp_code = '01' if c.tipo_comprobante == 'FACTURA' else '03' if c.tipo_comprobante == 'BOLETA' else '07'
    fecha_emision_dt = c.fecha_emision or timezone.now()

    if c.tipo_comprobante == 'FACTURA':
        xml_content = sunat_logic.sistema_generacion_xml_ubl_factura(
            ruc_emisor.ruc_numero, ruc_emisor.razon_social, ruc_emisor.direccion_fiscal or '—',
            c.serie, c.correlativo, fecha_emision_dt, 'PEN',
            cliente.ruc or '—', cliente.razon_social or cliente.nombre_apellidos or '—',
            cliente.direccion_fiscal or '—', items
        )
    elif c.tipo_comprobante == 'BOLETA':
        xml_content = sunat_logic.sistema_generacion_xml_ubl_boleta(
            ruc_emisor.ruc_numero, ruc_emisor.razon_social, ruc_emisor.direccion_fiscal or '—',
            c.serie, c.correlativo, fecha_emision_dt, 'PEN',
            cliente.dni or '—', cliente.nombre_apellidos or '—',
            cliente.direccion_fiscal or '—', items
        )
    else:
        # Nota de crédito por defecto
        xml_content = sunat_logic.sistema_generacion_xml_ubl_nota_credito(
            ruc_emisor.ruc_numero, ruc_emisor.razon_social, ruc_emisor.direccion_fiscal or '—',
            c.serie, c.correlativo, fecha_emision_dt, 'PEN',
            cliente.ruc or cliente.dni or '—', cliente.razon_social or cliente.nombre_apellidos or '—',
            cliente.direccion_fiscal or '—', items, '01', 'F001', 1, 'Anulación de la operación'
        )

    # 2. Nombre del archivo y paths de guardado
    filename = sunat_logic.sistema_generacion_nombre_archivo(
        ruc_emisor.ruc_numero, tipo_comp_code, c.serie, c.correlativo
    )

    # Crear directorios en media/sunat si no existen
    sunat_media_dir = settings.MEDIA_ROOT / 'sunat'
    xml_dir = sunat_media_dir / 'xml'
    zip_dir = sunat_media_dir / 'zip'
    cdr_dir = sunat_media_dir / 'cdr'
    
    xml_dir.mkdir(parents=True, exist_ok=True)
    zip_dir.mkdir(parents=True, exist_ok=True)
    cdr_dir.mkdir(parents=True, exist_ok=True)

    # Escribir XML a disco
    xml_path = xml_dir / f"{filename}.xml"
    with open(xml_path, 'w', encoding='utf-8') as f:
        f.write(xml_content)

    # 3. Comprimir XML a ZIP y guardar
    zip_base64 = sunat_logic.sistema_compresion_xml_a_zip_base64(xml_content, filename)
    zip_binary = base64_to_bytes(zip_base64)
    zip_path = zip_dir / f"{filename}.zip"
    with open(zip_path, 'wb') as f:
        f.write(zip_binary)

    # 4. Generar QR y Código Hash
    tipo_doc_cli = '6' if cliente.ruc else '1'
    num_doc_cli = cliente.ruc or cliente.dni or '00000000'
    qr_data = sunat_logic.sistema_generacion_codigo_qr_sunat(
        ruc_emisor.ruc_numero, tipo_comp_code, c.serie, c.correlativo,
        float(c.monto_igv), float(c.monto_total), fecha_emision_dt,
        tipo_doc_cli, num_doc_cli
    )
    codigo_hash = sunat_logic.sistema_generacion_codigo_hash(
        ruc_emisor.ruc_numero, tipo_comp_code, c.serie, c.correlativo, qr_data
    )

    # 5. Generar CDR (Constancia de Recepción) simulada
    cdr_xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<ApplicationResponse xmlns="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2"
    xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
    xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
    <cbc:ID>CDR-{filename}</cbc:ID>
    <cbc:IssueDate>{timezone.now().strftime('%Y-%m-%d')}</cbc:IssueDate>
    <cbc:ResponseDate>{timezone.now().strftime('%Y-%m-%d')}</cbc:ResponseDate>
    <cbc:Note>El comprobante numero {c.serie}-{c.correlativo:08d} ha sido aceptado</cbc:Note>
    <cac:DocumentResponse>
        <cac:Response>
            <cbc:ResponseCode>0</cbc:ResponseCode>
            <cbc:Description>El comprobante {c.serie}-{c.correlativo:08d} ha sido aceptado y validado por SUNAT.</cbc:Description>
        </cac:Response>
    </cac:DocumentResponse>
</ApplicationResponse>'''
    
    # Comprimir CDR a ZIP
    cdr_zip_buffer = io.BytesIO()
    with zipfile.ZipFile(cdr_zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr(f"R-{filename}.xml", cdr_xml)
    cdr_zip_buffer.seek(0)
    cdr_zip_binary = cdr_zip_buffer.read()
    
    cdr_path = cdr_dir / f"R-{filename}.zip"
    with open(cdr_path, 'wb') as f:
        f.write(cdr_zip_binary)

    # 6. Guardar estado y URLs en el comprobante
    c.estado_sunat = 'emitido'
    c.codigo_hash = codigo_hash
    c.codigo_qr = qr_data
    c.xml_url = f"/media/sunat/xml/{filename}.xml"
    c.pdf_url = f"/api/sede/rucs/{ruc_emisor.id}/comprobante/{c.id}/vista-previa/"
    c.mensaje_error_sunat = ''
    c.save()

    return JsonResponse({
        'status': 'success',
        'message': f'Comprobante {c.serie}-{c.correlativo:08d} enviado correctamente a SUNAT.',
        'hash': codigo_hash,
        'xml_url': c.xml_url,
        'pdf_url': c.pdf_url,
        'cdr_url': f"/media/sunat/cdr/R-{filename}.zip"
    })
