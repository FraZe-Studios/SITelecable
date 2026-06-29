"""
Lógica de negocio para integración con SUNAT - Facturación Electrónica
Motor de procesamiento para generación y envío de comprobantes a SUNAT
"""

import base64
import zipfile
import io
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


def sistema_generacion_xml_ubl_factura(
    ruc_emisor: str,
    razon_social: str,
    direccion_fiscal: str,
    serie: str,
    correlativo: int,
    fecha_emision: datetime,
    tipo_moneda: str,
    cliente_ruc: str,
    cliente_razon_social: str,
    cliente_direccion: str,
    items: List[Dict],
    igv_porcentaje: float = 18.0
) -> str:
    """
    Generar XML UBL para factura electrónica
    
    Args:
        ruc_emisor: RUC del emisor
        razon_social: Razón social del emisor
        direccion_fiscal: Dirección fiscal del emisor
        serie: Serie del comprobante (ej: F001)
        correlativo: Número correlativo
        fecha_emision: Fecha de emisión
        tipo_moneda: Tipo de moneda (PEN, USD)
        cliente_ruc: RUC del cliente
        cliente_razon_social: Razón social del cliente
        cliente_direccion: Dirección del cliente
        items: Lista de items con descripcion, cantidad, precio_unitario
        igv_porcentaje: Porcentaje de IGV (default 18%)
        
    Returns:
        XML UBL como string
    """
    # Calcular totales
    subtotal_gravable = 0.0
    total_igv = 0.0
    
    for item in items:
        cantidad = item['cantidad']
        precio_unitario = item['precio_unitario']
        valor_venta = cantidad * precio_unitario
        igv_item = valor_venta * (igv_porcentaje / 100)
        
        subtotal_gravable += valor_venta
        total_igv += igv_item
    
    total_importe = subtotal_gravable + total_igv
    
    # Generar XML UBL
    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
    xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
    xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
    xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
    <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
    <cbc:CustomizationID>2.1</cbc:CustomizationID>
    <cbc:ID>{serie}-{correlativo:08d}</cbc:ID>
    <cbc:IssueDate>{fecha_emision.strftime('%Y-%m-%d')}</cbc:IssueDate>
    <cbc:IssueTime>{fecha_emision.strftime('%H:%M:%S')}</cbc:IssueTime>
    <cbc:InvoiceTypeCode>01</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>{tipo_moneda}</cbc:DocumentCurrencyCode>
    
    <cac:AccountingSupplierParty>
        <cbc:CustomerAssignedAccountID>{ruc_emisor}</cbc:CustomerAssignedAccountID>
        <cac:Party>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>{razon_social}</cbc:RegistrationName>
                <cac:RegistrationAddress>
                    <cbc:AddressTypeCode>0000</cbc:AddressTypeCode>
                    <cbc:StreetName>{direccion_fiscal}</cbc:StreetName>
                </cac:RegistrationAddress>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>
    
    <cac:AccountingCustomerParty>
        <cbc:CustomerAssignedAccountID>{cliente_ruc}</cbc:CustomerAssignedAccountID>
        <cac:Party>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>{cliente_razon_social}</cbc:RegistrationName>
                <cac:RegistrationAddress>
                    <cbc:AddressTypeCode>0000</cbc:AddressTypeCode>
                    <cbc:StreetName>{cliente_direccion}</cbc:StreetName>
                </cac:RegistrationAddress>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>
    
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="{tipo_moneda}">{total_igv:.2f}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="{tipo_moneda}">{subtotal_gravable:.2f}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="{tipo_moneda}">{total_igv:.2f}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>{igv_porcentaje}</cbc:ID>
                <cac:TaxScheme>
                    <cbc:ID>IGV</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>
    
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="{tipo_moneda}">{subtotal_gravable:.2f}</cbc:LineExtensionAmount>
        <cbc:TaxInclusiveAmount currencyID="{tipo_moneda}">{total_importe:.2f}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="{tipo_moneda}">{total_importe:.2f}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
'''
    
    # Agregar items
    for i, item in enumerate(items):
        cantidad = item['cantidad']
        precio_unitario = item['precio_unitario']
        valor_venta = cantidad * precio_unitario
        igv_item = valor_venta * (igv_porcentaje / 100)
        precio_con_igv = valor_venta + igv_item
        
        xml += f'''
    <cac:InvoiceLine>
        <cbc:ID>{i + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="NIU">{cantidad}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="{tipo_moneda}">{valor_venta:.2f}</cbc:LineExtensionAmount>
        <cac:PricingReference>
            <cac:AlternateConditionPrice>
                <cbc:PriceAmount currencyID="{tipo_moneda}">{precio_con_igv:.2f}</cbc:PriceAmount>
                <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
            </cac:AlternateConditionPrice>
        </cac:PricingReference>
        <cac:Item>
            <cbc:Description>{item['descripcion']}</cbc:Description>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="{tipo_moneda}">{precio_unitario:.2f}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>
'''
    
    xml += '</Invoice>'
    return xml


def sistema_generacion_xml_ubl_boleta(
    ruc_emisor: str,
    razon_social: str,
    direccion_fiscal: str,
    serie: str,
    correlativo: int,
    fecha_emision: datetime,
    tipo_moneda: str,
    cliente_dni: str,
    cliente_nombre: str,
    cliente_direccion: str,
    items: List[Dict],
    igv_porcentaje: float = 18.0
) -> str:
    """
    Generar XML UBL para boleta de venta electrónica
    
    Args:
        ruc_emisor: RUC del emisor
        razon_social: Razón social del emisor
        direccion_fiscal: Dirección fiscal del emisor
        serie: Serie del comprobante (ej: B001)
        correlativo: Número correlativo
        fecha_emision: Fecha de emisión
        tipo_moneda: Tipo de moneda (PEN, USD)
        cliente_dni: DNI del cliente
        cliente_nombre: Nombre del cliente
        cliente_direccion: Dirección del cliente
        items: Lista de items con descripcion, cantidad, precio_unitario
        igv_porcentaje: Porcentaje de IGV (default 18%)
        
    Returns:
        XML UBL como string
    """
    # Calcular totales
    subtotal_gravable = 0.0
    total_igv = 0.0
    
    for item in items:
        cantidad = item['cantidad']
        precio_unitario = item['precio_unitario']
        valor_venta = cantidad * precio_unitario
        igv_item = valor_venta * (igv_porcentaje / 100)
        
        subtotal_gravable += valor_venta
        total_igv += igv_item
    
    total_importe = subtotal_gravable + total_igv
    
    # Generar XML UBL
    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
    xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
    xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
    <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
    <cbc:CustomizationID>2.1</cbc:CustomizationID>
    <cbc:ID>{serie}-{correlativo:08d}</cbc:ID>
    <cbc:IssueDate>{fecha_emision.strftime('%Y-%m-%d')}</cbc:IssueDate>
    <cbc:InvoiceTypeCode>03</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>{tipo_moneda}</cbc:DocumentCurrencyCode>
    
    <cac:AccountingSupplierParty>
        <cbc:CustomerAssignedAccountID>{ruc_emisor}</cbc:CustomerAssignedAccountID>
        <cac:Party>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>{razon_social}</cbc:RegistrationName>
                <cac:RegistrationAddress>
                    <cbc:AddressTypeCode>0000</cbc:AddressTypeCode>
                    <cbc:StreetName>{direccion_fiscal}</cbc:StreetName>
                </cac:RegistrationAddress>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>
    
    <cac:AccountingCustomerParty>
        <cbc:CustomerAssignedAccountID>{cliente_dni}</cbc:CustomerAssignedAccountID>
        <cac:Party>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>{cliente_nombre}</cbc:RegistrationName>
                <cac:RegistrationAddress>
                    <cbc:AddressTypeCode>0000</cbc:AddressTypeCode>
                    <cbc:StreetName>{cliente_direccion}</cbc:StreetName>
                </cac:RegistrationAddress>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>
    
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="{tipo_moneda}">{total_igv:.2f}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="{tipo_moneda}">{subtotal_gravable:.2f}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="{tipo_moneda}">{total_igv:.2f}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>{igv_porcentaje}</cbc:ID>
                <cac:TaxScheme>
                    <cbc:ID>IGV</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>
    
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="{tipo_moneda}">{subtotal_gravable:.2f}</cbc:LineExtensionAmount>
        <cbc:TaxInclusiveAmount currencyID="{tipo_moneda}">{total_importe:.2f}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="{tipo_moneda}">{total_importe:.2f}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
'''
    
    # Agregar items
    for i, item in enumerate(items):
        cantidad = item['cantidad']
        precio_unitario = item['precio_unitario']
        valor_venta = cantidad * precio_unitario
        igv_item = valor_venta * (igv_porcentaje / 100)
        precio_con_igv = valor_venta + igv_item
        
        xml += f'''
    <cac:InvoiceLine>
        <cbc:ID>{i + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="NIU">{cantidad}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="{tipo_moneda}">{valor_venta:.2f}</cbc:LineExtensionAmount>
        <cac:PricingReference>
            <cac:AlternateConditionPrice>
                <cbc:PriceAmount currencyID="{tipo_moneda}">{precio_con_igv:.2f}</cbc:PriceAmount>
                <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
            </cac:AlternateConditionPrice>
        </cac:PricingReference>
        <cac:Item>
            <cbc:Description>{item['descripcion']}</cbc:Description>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="{tipo_moneda}">{precio_unitario:.2f}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>
'''
    
    xml += '</Invoice>'
    return xml


def sistema_compresion_xml_a_zip_base64(xml_content: str, nombre_archivo: str) -> str:
    """
    Comprimir XML en ZIP y convertir a Base64
    
    Args:
        xml_content: Contenido del XML
        nombre_archivo: Nombre del archivo (sin extensión)
        
    Returns:
        Contenido ZIP en Base64
    """
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr(f"{nombre_archivo}.xml", xml_content)
    
    zip_buffer.seek(0)
    zip_content = zip_buffer.read()
    
    return base64.b64encode(zip_content).decode('utf-8')


def sistema_generacion_nombre_archivo(
    ruc: str,
    tipo_comprobante: str,
    serie: str,
    correlativo: int
) -> str:
    """
    Generar nombre de archivo según formato SUNAT
    
    Args:
        ruc: RUC del emisor
        tipo_comprobante: Tipo (01=Factura, 03=Boleta, 07=Nota Crédito)
        serie: Serie del comprobante
        correlativo: Número correlativo
        
    Returns:
        Nombre de archivo (ej: 10454562467-01-F001-00000001)
    """
    return f"{ruc}-{tipo_comprobante}-{serie}-{correlativo:08d}"


def sistema_calculo_totales_comprobante(
    items: List[Dict],
    igv_porcentaje: float = 18.0
) -> Dict:
    """
    Calcular totales de comprobante (subtotal, IGV, total)
    
    Args:
        items: Lista de items con cantidad y precio_unitario
        igv_porcentaje: Porcentaje de IGV
        
    Returns:
        Dict con subtotal, igv, total
    """
    subtotal_gravable = 0.0
    total_igv = 0.0
    
    for item in items:
        cantidad = item['cantidad']
        precio_unitario = item['precio_unitario']
        valor_venta = cantidad * precio_unitario
        igv_item = valor_venta * (igv_porcentaje / 100)
        
        subtotal_gravable += valor_venta
        total_igv += igv_item
    
    total_importe = subtotal_gravable + total_igv
    
    return {
        'subtotal_gravable': round(subtotal_gravable, 2),
        'total_igv': round(total_igv, 2),
        'total_importe': round(total_importe, 2)
    }


def sistema_validacion_datos_comprobante(
    ruc_emisor: str,
    serie: str,
    correlativo: int,
    items: List[Dict]
) -> Tuple[bool, str]:
    """
    Validar datos del comprobante antes de generar XML
    
    Args:
        ruc_emisor: RUC del emisor
        serie: Serie del comprobante
        correlativo: Número correlativo
        items: Lista de items
        
    Returns:
        Tuple (valido, mensaje_error)
    """
    if not ruc_emisor or len(ruc_emisor) != 11:
        return False, "RUC del emisor debe tener 11 dígitos"
    
    if not serie or len(serie) != 4:
        return False, "Serie debe tener 4 caracteres (ej: F001)"
    
    if correlativo < 1 or correlativo > 99999999:
        return False, "Correlativo debe estar entre 1 y 99999999"
    
    if not items or len(items) == 0:
        return False, "Debe haber al menos un item"
    
    for i, item in enumerate(items):
        if 'descripcion' not in item or not item['descripcion']:
            return False, f"Item {i+1}: Falta descripción"
        if 'cantidad' not in item or item['cantidad'] <= 0:
            return False, f"Item {i+1}: Cantidad debe ser mayor a 0"
        if 'precio_unitario' not in item or item['precio_unitario'] <= 0:
            return False, f"Item {i+1}: Precio unitario debe ser mayor a 0"
    
    return True, ""


def sistema_generacion_codigo_qr_sunat(
    ruc_emisor: str,
    tipo_comprobante: str,
    serie: str,
    correlativo: int,
    igv_total: float,
    total_importe: float,
    fecha_emision: datetime,
    tipo_documento_cliente: str,
    numero_documento_cliente: str
) -> str:
    """
    Generar código QR según especificaciones de SUNAT
    
    El QR debe contener la siguiente información separada por "|":
    RUC|TIPO_DOC|SERIE|CORRELATIVO|MTO_IGV|MTO_IMPORTE_TOTAL|FECHA_EMISION|TIPO_DOC_CLIENTE|NRO_DOC_CLIENTE
    
    Args:
        ruc_emisor: RUC del emisor
        tipo_comprobante: Tipo de comprobante (01=Factura, 03=Boleta, 07=Nota Crédito)
        serie: Serie del comprobante
        correlativo: Número correlativo
        igv_total: Total de IGV
        total_importe: Total a pagar
        fecha_emision: Fecha de emisión
        tipo_documento_cliente: Tipo de documento del cliente (6=RUC, 1=DNI)
        numero_documento_cliente: Número de documento del cliente
        
    Returns:
        String con datos para generar QR
    """
    qr_data = (
        f"{ruc_emisor}|"
        f"{tipo_comprobante}|"
        f"{serie}|"
        f"{correlativo:08d}|"
        f"{igv_total:.2f}|"
        f"{total_importe:.2f}|"
        f"{fecha_emision.strftime('%Y-%m-%d')}|"
        f"{tipo_documento_cliente}|"
        f"{numero_documento_cliente}"
    )
    
    return qr_data


def sistema_generacion_codigo_hash(
    ruc_emisor: str,
    tipo_comprobante: str,
    serie: str,
    correlativo: int,
    codigo_qr: str
) -> str:
    """
    Generar código hash único para el comprobante
    
    Args:
        ruc_emisor: RUC del emisor
        tipo_comprobante: Tipo de comprobante
        serie: Serie del comprobante
        correlativo: Número correlativo
        codigo_qr: Código QR generado
        
    Returns:
        Código hash único (simulado, en producción usar hash real)
    """
    import hashlib
    
    hash_input = f"{ruc_emisor}{tipo_comprobante}{serie}{correlativo:08d}{codigo_qr}"
    hash_sha256 = hashlib.sha256(hash_input.encode()).hexdigest()
    
    # Retornar primeros 12 caracteres para el código hash de SUNAT
    return hash_sha256[:12].upper()


def sistema_generacion_xml_ubl_nota_credito(
    ruc_emisor: str,
    razon_social: str,
    direccion_fiscal: str,
    serie: str,
    correlativo: int,
    fecha_emision: datetime,
    tipo_moneda: str,
    cliente_ruc: str,
    cliente_razon_social: str,
    cliente_direccion: str,
    items: List[Dict],
    tipo_nota_credito: str,
    serie_afectada: str,
    correlativo_afectado: int,
    motivo: str,
    igv_porcentaje: float = 18.0
) -> str:
    """
    Generar XML UBL para nota de crédito electrónica
    
    Args:
        ruc_emisor: RUC del emisor
        razon_social: Razón social del emisor
        direccion_fiscal: Dirección fiscal del emisor
        serie: Serie del comprobante (ej: B001)
        correlativo: Número correlativo
        fecha_emision: Fecha de emisión
        tipo_moneda: Tipo de moneda (PEN, USD)
        cliente_ruc: RUC del cliente
        cliente_razon_social: Razón social del cliente
        cliente_direccion: Dirección del cliente
        items: Lista de items con descripcion, cantidad, precio_unitario
        tipo_nota_credito: Tipo de nota (01=Anulación, 03=Descuento, etc.)
        serie_afectada: Serie del comprobante afectado
        correlativo_afectado: Correlativo del comprobante afectado
        motivo: Motivo de la nota de crédito
        igv_porcentaje: Porcentaje de IGV (default 18%)
        
    Returns:
        XML UBL como string
    """
    # Calcular totales
    subtotal_gravable = 0.0
    total_igv = 0.0
    
    for item in items:
        cantidad = item['cantidad']
        precio_unitario = item['precio_unitario']
        valor_venta = cantidad * precio_unitario
        igv_item = valor_venta * (igv_porcentaje / 100)
        
        subtotal_gravable += valor_venta
        total_igv += igv_item
    
    total_importe = subtotal_gravable + total_igv
    
    # Generar XML UBL
    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
    xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
    xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
    xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
    <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
    <cbc:CustomizationID>2.1</cbc:CustomizationID>
    <cbc:ID>{serie}-{correlativo:08d}</cbc:ID>
    <cbc:IssueDate>{fecha_emision.strftime('%Y-%m-%d')}</cbc:IssueDate>
    <cbc:IssueTime>{fecha_emision.strftime('%H:%M:%S')}</cbc:IssueTime>
    <cbc:InvoiceTypeCode>07</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>{tipo_moneda}</cbc:DocumentCurrencyCode>
    
    <cac:AccountingSupplierParty>
        <cbc:CustomerAssignedAccountID>{ruc_emisor}</cbc:CustomerAssignedAccountID>
        <cac:Party>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>{razon_social}</cbc:RegistrationName>
                <cac:RegistrationAddress>
                    <cbc:AddressTypeCode>0000</cbc:AddressTypeCode>
                    <cbc:StreetName>{direccion_fiscal}</cbc:StreetName>
                </cac:RegistrationAddress>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>
    
    <cac:AccountingCustomerParty>
        <cbc:CustomerAssignedAccountID>{cliente_ruc}</cbc:CustomerAssignedAccountID>
        <cac:Party>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>{cliente_razon_social}</cbc:RegistrationName>
                <cac:RegistrationAddress>
                    <cbc:AddressTypeCode>0000</cbc:AddressTypeCode>
                    <cbc:StreetName>{cliente_direccion}</cbc:StreetName>
                </cac:RegistrationAddress>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>
    
    <cac:BillingReference>
        <cac:InvoiceDocumentReference>
            <cbc:ID>{serie_afectada}-{correlativo_afectado:08d}</cbc:ID>
            <cbc:DocumentTypeCode>{tipo_nota_credito}</cbc:DocumentTypeCode>
        </cac:InvoiceDocumentReference>
    </cac:BillingReference>
    
    <cac:DiscrepancyResponse>
        <cbc:ResponseCode>{tipo_nota_credito}</cbc:ResponseCode>
        <cbc:Description>{motivo}</cbc:Description>
    </cac:DiscrepancyResponse>
    
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="{tipo_moneda}">{total_igv:.2f}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="{tipo_moneda}">{subtotal_gravable:.2f}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="{tipo_moneda}">{total_igv:.2f}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>{igv_porcentaje}</cbc:ID>
                <cac:TaxScheme>
                    <cbc:ID>IGV</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>
    
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="{tipo_moneda}">{subtotal_gravable:.2f}</cbc:LineExtensionAmount>
        <cbc:TaxInclusiveAmount currencyID="{tipo_moneda}">{total_importe:.2f}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="{tipo_moneda}">{total_importe:.2f}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
'''
    
    # Agregar items
    for i, item in enumerate(items):
        cantidad = item['cantidad']
        precio_unitario = item['precio_unitario']
        valor_venta = cantidad * precio_unitario
        igv_item = valor_venta * (igv_porcentaje / 100)
        precio_con_igv = valor_venta + igv_item
        
        xml += f'''
    <cac:InvoiceLine>
        <cbc:ID>{i + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="NIU">{cantidad}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="{tipo_moneda}">{valor_venta:.2f}</cbc:LineExtensionAmount>
        <cac:PricingReference>
            <cac:AlternateConditionPrice>
                <cbc:PriceAmount currencyID="{tipo_moneda}">{precio_con_igv:.2f}</cbc:PriceAmount>
                <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
            </cac:AlternateConditionPrice>
        </cac:PricingReference>
        <cac:Item>
            <cbc:Description>{item['descripcion']}</cbc:Description>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="{tipo_moneda}">{precio_unitario:.2f}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>
'''
    
    xml += '</Invoice>'
    return xml


def sistema_generacion_xml_ubl_baja_comprobante(
    ruc_emisor: str,
    razon_social: str,
    direccion_fiscal: str,
    fecha_emision: datetime,
    comprobantes_baja: List[Dict]
) -> str:
    """
    Generar XML UBL para comunicación de baja de comprobantes
    
    Args:
        ruc_emisor: RUC del emisor
        razon_social: Razón social del emisor
        direccion_fiscal: Dirección fiscal del emisor
        fecha_emision: Fecha de emisión de la comunicación de baja
        comprobantes_baja: Lista de comprobantes a dar de baja
            Cada dict debe tener: serie, correlativo, tipo_comprobante, motivo
        
    Returns:
        XML UBL como string
    """
    # Generar XML UBL para comunicación de baja
    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<SummaryDocuments xmlns="urn:oasis:names:specification:ubl:schema:xsd:SummaryDocuments-2"
    xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
    xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
    xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
    <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
    <cbc:CustomizationID>2.0</cbc:CustomizationID>
    <cbc:ID>{ruc_emisor}-RA-{fecha_emision.strftime('%Y%m%d')}</cbc:ID>
    <cbc:IssueDate>{fecha_emision.strftime('%Y-%m-%d')}</cbc:IssueDate>
    <cbc:ReferenceDate>{fecha_emision.strftime('%Y-%m-%d')}</cbc:ReferenceDate>
    
    <cac:AccountingSupplierParty>
        <cbc:CustomerAssignedAccountID>{ruc_emisor}</cbc:CustomerAssignedAccountID>
        <cac:Party>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>{razon_social}</cbc:RegistrationName>
                <cac:RegistrationAddress>
                    <cbc:AddressTypeCode>0000</cbc:AddressTypeCode>
                    <cbc:StreetName>{direccion_fiscal}</cbc:StreetName>
                </cac:RegistrationAddress>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>
'''
    
    # Agregar comprobantes a dar de baja
    for i, comp in enumerate(comprobantes_baja):
        xml += f'''
    <cac:SummaryDocumentsLine>
        <cbc:LineID>{i + 1}</cbc:LineID>
        <cbc:DocumentTypeCode>{comp['tipo_comprobante']}</cbc:DocumentTypeCode>
        <cac:DocumentReference>
            <cbc:ID>{comp['serie']}-{comp['correlativo']:08d}</cbc:ID>
            <cbc:DocumentTypeCode>{comp['tipo_comprobante']}</cbc:DocumentTypeCode>
        </cac:DocumentReference>
        <cac:Status>
            <cbc:ConditionCode>ANULADO</cbc:ConditionCode>
        </cac:Status>
        <cbc:Note>{comp.get('motivo', 'Anulación de comprobante')}</cbc:Note>
    </cac:SummaryDocumentsLine>
'''
    
    xml += '</SummaryDocuments>'
    return xml
