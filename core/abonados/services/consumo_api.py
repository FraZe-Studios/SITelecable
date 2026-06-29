"""
Clientes HTTP para APIs externas: Decolecta (DNI/RUC), Telecable, Distriluz.
Tokens configurables vía settings / variables de entorno.
"""
import logging
import xml.etree.ElementTree as ET

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def _token(name, default=''):
    return getattr(settings, name, default)


class DecolectaAPIClient:
    BASE_URL = 'https://api.decolecta.com/v1'

    def __init__(self):
        token = _token('DECOLECTA_API_TOKEN', '')
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        }

    def consultar_dni(self, numero):
        if not numero.isdigit() or len(numero) != 8:
            return None
        if not _token('DECOLECTA_API_TOKEN'):
            return self._mock_dni(numero)
        try:
            response = requests.get(
                f'{self.BASE_URL}/reniec/dni',
                params={'numero': numero},
                headers=self.headers,
                timeout=10,
            )
            if response.status_code != 200:
                return None
            data = response.json()
            return {
                'nombre_completo': data.get('full_name', f"{data.get('first_name', '')} {data.get('first_last_name', '')} {data.get('second_last_name', '')}").strip(),
                'numero_documento': data.get('document_number', numero),
                'nombres': data.get('first_name', ''),
                'apellido_paterno': data.get('first_last_name', ''),
                'apellido_materno': data.get('second_last_name', ''),
                'source': 'DECOLECTA',
            }
        except Exception as exc:
            logger.error('Error consultando DNI %s: %s', numero, exc)
            return None

    def consultar_ruc(self, numero):
        if not numero.isdigit() or len(numero) != 11:
            return None
        if not _token('DECOLECTA_API_TOKEN'):
            return self._mock_ruc(numero)
        try:
            response = requests.get(
                f'{self.BASE_URL}/sunat/ruc',
                params={'numero': numero},
                headers=self.headers,
                timeout=10,
            )
            if response.status_code != 200:
                return None
            data = response.json()
            return {
                'razon_social': data.get('razon_social', 'Empresa S/D'),
                'nombre_comercial': data.get('nombre_comercial', ''),
                'numero_documento': data.get('numero_documento', numero),
                'direccion_fiscal': data.get('direccion_fiscal', ''),
                'estado_contribuyente': data.get('estado_contribuyente', ''),
                'condicion_domicilio': data.get('condicion_domicilio', ''),
                'ubigeo': data.get('ubigeo', ''),
                'sistema_emision': data.get('sistema_emision', ''),
                'actividad_economica_ciiu': data.get('actividad_economica_ciiu', ''),
                'source': 'DECOLECTA',
            }
        except Exception as exc:
            logger.error('Error consultando RUC %s: %s', numero, exc)
            return None

    @staticmethod
    def _mock_dni(numero):
        return {
            'nombre_completo': f'CONSULTA DNI {numero}',
            'numero_documento': numero,
            'nombres': 'CONSULTA',
            'apellido_paterno': 'DNI',
            'apellido_materno': numero[-4:],
            'fecha_nacimiento': '1990-01-15',
            'cumpleanos': '1990-01-15',
            'source': 'MOCK',
        }

    @staticmethod
    def _mock_ruc(numero):
        return {
            'razon_social': f'EMPRESA RUC {numero}',
            'numero_documento': numero,
            'direccion_fiscal': 'Dirección fiscal pendiente de consulta',
            'estado_contribuyente': 'ACTIVO',
            'condicion_domicilio': 'HABIDO',
            'source': 'MOCK',
        }


class TelecableAPIClient:
    BASE_URL = 'https://api.telecable.cableoperador.com/api/externa/v1'

    def __init__(self):
        token = _token('TELECABLE_API_TOKEN', '')
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Accept': 'application/json',
        }

    def buscar_abonado(self, query):
        if not _token('TELECABLE_API_TOKEN'):
            return []
        params = {'numero_documento': query} if query.isdigit() and len(query) >= 8 else {'codigo': query}
        try:
            response = requests.get(
                f'{self.BASE_URL}/abonados/buscar',
                headers=self.headers,
                params=params,
                timeout=10,
            )
            if response.status_code != 200:
                return []
            body = response.json()
            if isinstance(body, dict) and 'datos' in body:
                return body['datos']
            if isinstance(body, dict) and 'data' in body:
                return body['data']
            if isinstance(body, list):
                return body
            return [body]
        except Exception as exc:
            logger.error('Error buscando abonado %s: %s', query, exc)
            return []

    def get_detalle(self, codigo):
        if not _token('TELECABLE_API_TOKEN'):
            return None
        try:
            response = requests.get(
                f'{self.BASE_URL}/abonados/{codigo}',
                headers=self.headers,
                timeout=10,
            )
            return response.json() if response.status_code == 200 else None
        except Exception as exc:
            logger.error('Error detalle abonado %s: %s', codigo, exc)
            return None

    def get_deudas(self, codigo):
        if not _token('TELECABLE_API_TOKEN'):
            return []
        try:
            response = requests.get(
                f'{self.BASE_URL}/abonados/{codigo}/deudas',
                headers=self.headers,
                timeout=10,
            )
            return response.json() if response.status_code == 200 else []
        except Exception as exc:
            logger.error('Error deudas abonado %s: %s', codigo, exc)
            return []


class DistriluzAPIClient:
    BASE_URL = 'http://oficinavirtual.distriluz.com.pe:62150/wsconsultamovil/servicioconsultas.asmx'

    def consultar_suministro(self, id_suministro):
        if not id_suministro:
            return None
        if not _token('DISTRILUZ_API_ENABLED', True):
            return self._mock_suministro(id_suministro)
        soap_envelope = f"""<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ConsultaGeneral xmlns="http://www.distriluz.com.pe/">
      <idNroServicio>{id_suministro}</idNroServicio>
    </ConsultaGeneral>
  </soap:Body>
</soap:Envelope>"""
        headers = {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'http://www.distriluz.com.pe/ConsultaGeneral',
        }
        try:
            response = requests.post(self.BASE_URL, data=soap_envelope, headers=headers, timeout=12)
            response.raise_for_status()
            root = ET.fromstring(response.text)
            namespaces = {'ns': 'http://www.distriluz.com.pe/'}
            result = root.find('.//ns:ConsultaGeneralResult', namespaces)
            if result is None:
                return None

            # Mapeo clave-valor dinámico (más robusto que índices fijos)
            strings = [s.text for s in result.findall('ns:string', namespaces)]
            output = {}
            for i in range(0, len(strings), 2):
                key = strings[i].lower() if i < len(strings) else ''
                val = strings[i+1] if i+1 < len(strings) else ''
                output[key] = val

            lat = output.get('gpsy', output.get('latitud', '-11.593000'))
            lng = output.get('gpsx', output.get('longitud', '-75.896000'))
            return {
                'cliente': output.get('nombre', ''),
                'direccion': output.get('direccion', ''),
                'distrito': output.get('direccioncomplementaria', output.get('distrito', '')),
                'tipo_via': output.get('tipovia', ''),
                'nombre_via': output.get('nombrevia', ''),
                'suministro': id_suministro,
                'latitud': lat,
                'longitud': lng,
                'documento_titular': output.get('documento', ''),
                'provincia': output.get('provincia', ''),
                'departamento': output.get('departamento', ''),
                'empresa_electrica': 'DISTRILUZ',
                'deuda': output.get('importetotal', '0.00'),
                'google_maps': f'https://www.google.com/maps/place/{lat},{lng}',
                'source': 'DISTRILUZ',
            }
        except Exception as exc:
            logger.error('Error consultando suministro %s: %s', id_suministro, exc)
            return self._mock_suministro(id_suministro)

    @staticmethod
    def _mock_suministro(id_suministro):
        return {
            'cliente': 'Titular no disponible en modo demo',
            'direccion': f'Dirección asociada al suministro {id_suministro}',
            'distrito': 'La Oroya',
            'tipo_via': 'JR',
            'nombre_via': 'Sin nombre',
            'suministro': id_suministro,
            'latitud': '-11.593160',
            'longitud': '-75.896170',
            'documento_titular': '',
            'provincia': 'Yauli',
            'departamento': 'Junín',
            'empresa_electrica': 'DISTRILUZ',
            'google_maps': 'https://www.google.com/maps',
            'source': 'MOCK',
        }
