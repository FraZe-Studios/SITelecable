import requests
import base64
import zipfile
import xml.etree.ElementTree as ET
from typing import Dict, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

class SunatAPIError(Exception):
    """Excepción personalizada para errores de API SUNAT"""
    pass

class SunatAPI:
    """
    Cliente API para comunicación con SUNAT
    Implementa tolerancia a fallos y timeouts explícitos
    """
    ENDPOINT_BETA = "https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService"
    ENDPOINT_PRODUCCION = "https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService"
    TIMEOUT_SECONDS = 5
    
    def __init__(self, modo_beta: bool = True):
        self.modo_beta = modo_beta
        self.endpoint = self.ENDPOINT_BETA if modo_beta else self.ENDPOINT_PRODUCCION
        self.session = requests.Session()
        
    def sunat_enviar_comprobante(
        self,
        ruc: str,
        usuario_sol: str,
        clave_sol: str,
        nombre_archivo: str,
        contenido_zip: str
    ) -> Tuple[bool, str, Optional[str]]:
        try:
            xml_soap = self._crear_sobre_soap(
                ruc, usuario_sol, clave_sol, nombre_archivo, contenido_zip
            )
            headers = {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': ''
            }
            response = self.session.post(
                self.endpoint,
                data=xml_soap,
                headers=headers,
                timeout=self.TIMEOUT_SECONDS,
                verify=False
            )
            if response.status_code == 200:
                cdr_zip_contenido = self._extraer_cdr(response.text)
                return True, "Comprobante enviado exitosamente", cdr_zip_contenido
            else:
                error_msg = self._extraer_error_sunat(response.text)
                return False, f"Error HTTP {response.status_code}: {error_msg}", None
        except requests.exceptions.Timeout:
            logger.error("Timeout al conectar con SUNAT")
            return False, "Timeout: No se pudo conectar con SUNAT en el tiempo límite", None
        except requests.exceptions.RequestException as e:
            logger.error(f"Error de conexión con SUNAT: {str(e)}")
            return False, f"Error de conexión: {str(e)}", None
        except Exception as e:
            logger.error(f"Error inesperado al enviar comprobante: {str(e)}")
            return False, f"Error inesperado: {str(e)}", None
    
    def sunat_consultar_constancia(
        self,
        ruc: str,
        usuario_sol: str,
        clave_sol: str,
        ticket: str
    ) -> Tuple[bool, str, Optional[str]]:
        try:
            xml_soap = self._crear_sobre_soap_consulta(
                ruc, usuario_sol, clave_sol, ticket
            )
            headers = {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': ''
            }
            response = self.session.post(
                self.endpoint,
                data=xml_soap,
                headers=headers,
                timeout=self.TIMEOUT_SECONDS,
                verify=False
            )
            if response.status_code == 200:
                cdr_zip_contenido = self._extraer_cdr(response.text)
                return True, "Constancia obtenida exitosamente", cdr_zip_contenido
            else:
                error_msg = self._extraer_error_sunat(response.text)
                return False, f"Error HTTP {response.status_code}: {error_msg}", None
        except requests.exceptions.Timeout:
            return False, "Timeout al consultar constancia", None
        except Exception as e:
            logger.error(f"Error al consultar constancia: {str(e)}")
            return False, f"Error: {str(e)}", None
    
    def _crear_sobre_soap(
        self,
        ruc: str,
        usuario_sol: str,
        clave_sol: str,
        nombre_archivo: str,
        contenido_zip: str
    ) -> str:
        return f'''<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
    xmlns:ser="http://service.sunat.gob.pe" 
    xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
    <soapenv:Header>
        <wsse:Security>
            <wsse:UsernameToken>
                <wsse:Username>{ruc}{usuario_sol}</wsse:Username>
                <wsse:Password>{clave_sol}</wsse:Password>
            </wsse:UsernameToken>
        </wsse:Security>
    </soapenv:Header>
    <soapenv:Body>
        <ser:sendBill>
            <fileName>{nombre_archivo}</fileName>
            <contentFile>{contenido_zip}</contentFile>
        </ser:sendBill>
    </soapenv:Body>
</soapenv:Envelope>'''
    
    def _crear_sobre_soap_consulta(
        self,
        ruc: str,
        usuario_sol: str,
        clave_sol: str,
        ticket: str
    ) -> str:
        return f'''<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
    xmlns:ser="http://service.sunat.gob.pe" 
    xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
    <soapenv:Header>
        <wsse:Security>
            <wsse:UsernameToken>
                <wsse:Username>{ruc}{usuario_sol}</wsse:Username>
                <wsse:Password>{clave_sol}</wsse:Password>
            </wsse:UsernameToken>
        </wsse:Security>
    </soapenv:Header>
    <soapenv:Body>
        <ser:getStatus>
            <ticket>{ticket}</ticket>
        </ser:getStatus>
    </soapenv:Body>
</soapenv:Envelope>'''
    
    def _extraer_cdr(self, response_xml: str) -> Optional[str]:
        try:
            root = ET.fromstring(response_xml)
            namespaces = {
                'soap': 'http://schemas.xmlsoap.org/soap/envelope/',
                'ser': 'http://service.sunat.gob.pe'
            }
            application_response = root.find(
                './/ser:applicationResponse',
                namespaces
            )
            if application_response is not None and application_response.text:
                return application_response.text
            return None
        except Exception as e:
            logger.error(f"Error al extraer CDR: {str(e)}")
            return None
    
    def _extraer_error_sunat(self, response_xml: str) -> str:
        try:
            root = ET.fromstring(response_xml)
            fault_string = root.find('.//faultstring')
            if fault_string is not None:
                return fault_string.text
            return "Error desconocido en respuesta SUNAT"
        except Exception as e:
            logger.error(f"Error al extraer error SUNAT: {str(e)}")
            return "Error al procesar respuesta de SUNAT"

def sistema_consulta_sunat_api_enviar_comprobante(
    ruc: str,
    usuario_sol: str,
    clave_sol: str,
    nombre_archivo: str,
    contenido_zip: str,
    modo_beta: bool = True
) -> Dict:
    api = SunatAPI(modo_beta=modo_beta)
    exito, mensaje, cdr_zip = api.sunat_enviar_comprobante(
        ruc, usuario_sol, clave_sol, nombre_archivo, contenido_zip
    )
    return {
        'exito': exito,
        'mensaje': mensaje,
        'cdr_zip_contenido': cdr_zip,
        'ticket': None
    }

def sistema_consulta_sunat_api_consultar_constancia(
    ruc: str,
    usuario_sol: str,
    clave_sol: str,
    ticket: str,
    modo_beta: bool = True
) -> Dict:
    api = SunatAPI(modo_beta=modo_beta)
    exito, mensaje, cdr_zip = api.sunat_consultar_constancia(
        ruc, usuario_sol, clave_sol, ticket
    )
    return {
        'exito': exito,
        'mensaje': mensaje,
        'cdr_zip_contenido': cdr_zip
    }

def sistema_consulta_sunat_api_dar_baja_comprobante(
    ruc: str,
    usuario_sol: str,
    clave_sol: str,
    nombre_archivo: str,
    contenido_zip: str,
    modo_beta: bool = True
) -> Dict:
    api = SunatAPI(modo_beta=modo_beta)
    exito, mensaje, cdr_zip = api.sunat_enviar_comprobante(
        ruc, usuario_sol, clave_sol, nombre_archivo, contenido_zip
    )
    return {
        'exito': exito,
        'mensaje': mensaje,
        'cdr_zip_contenido': cdr_zip
    }
