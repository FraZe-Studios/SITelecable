import os
import sys
import django
import json
from decimal import Decimal

# Add parent directory to path to find sitelecable module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sitelecable.settings')
django.setup()

from core.models.models_generados import Sedes, Planes
from django.test import RequestFactory
from core.sede.plan import plan as api_plan
from core.sede.config import config as api_config

def run_tests():
    print("=== Iniciando pruebas del Módulo de Planes y Categorías Dinámicas ===")

    # 1. Preparar Datos de Prueba
    print("1. Creando sede de prueba...")
    sede, _ = Sedes.objects.get_or_create(
        nombre='Sede Prueba Planes',
        defaults={
            'descripcion': 'Sede para pruebas automatizadas de planes',
            'activo': True,
            'latitud': Decimal('0.0'),
            'longitud': Decimal('0.0')
        }
    )

    # Limpiar planes anteriores de prueba
    Planes.objects.filter(sede=sede).delete()

    rf = RequestFactory()

    # 2. Registrar Plan Estándar (Internet)
    print("2. Probando creación de Plan Estándar (Internet)...")
    payload_std = {
        "sede_id": sede.id,
        "tipo_servicio": "internet",
        "tipo_cliente": "residencial",
        "nombre_plan": "Plan Test Internet 100M",
        "costo_plan": 75.90,
        "caracteristicas_tecnicas_json": {
            "caracteristicas_base": {
                "velocidad_mbps": 100
            },
            "activacion_funciones": {
                "admite_prorrogas": True,
                "compromisos_pago_flexibles": False,
                "bloqueo_automatico_mora": False,
                "prioridad_soporte_critica": False
            },
            "permisos_formularios": {
                "requiere_api_externa_olt": False,
                "permite_cambio_mufa_campo": False
            }
        },
        "configuracion_fecha_pago": "fin_mes",
        "dias_amnistia": 5,
        "dias_anticipacion_descuento": 0,
        "monto_descuento_pago_anticipado": 0,
        "admite_prorroga": True,
        "admite_prorrateo": True,
        "velocidad_mbps": 100
    }

    req_std = rf.post(
        '/api/sede/config/plan/',
        data=json.dumps(payload_std),
        content_type='application/json'
    )
    # Mock session check
    from core.sede import plan
    plan.checksession = lambda request: True

    res_std = api_plan(req_std)
    res_data_std = json.loads(res_std.content)
    assert res_data_std.get('status') == 'success', f"Error creando plan estándar: {res_data_std.get('message')}"
    print("   [OK] Plan estándar creado exitosamente.")

    # 3. Registrar Plan Personalizado (Cámaras)
    print("3. Probando creación de Plan Personalizado (Cámaras)...")
    payload_custom = {
        "sede_id": sede.id,
        "tipo_servicio": "app", # Fallback value in DB enum
        "custom_tipo_servicio": "camaras", # Custom category mapping
        "tipo_cliente": "residencial",
        "nombre_plan": "Plan Test Seguridad Cámaras",
        "costo_plan": 120.00,
        "caracteristicas_tecnicas_json": {
            "caracteristicas_base": {},
            "activacion_funciones": {
                "admite_prorrogas": True,
                "compromisos_pago_flexibles": False,
                "bloqueo_automatico_mora": False,
                "prioridad_soporte_critica": False
            },
            "permisos_formularios": {
                "requiere_api_externa_olt": False,
                "permite_cambio_mufa_campo": False
            },
            "custom_tipo_servicio": "camaras"
        },
        "configuracion_fecha_pago": "fin_mes",
        "dias_amnistia": 5,
        "dias_anticipacion_descuento": 0,
        "monto_descuento_pago_anticipado": 0,
        "admite_prorroga": True,
        "admite_prorrateo": True
    }

    req_custom = rf.post(
        '/api/sede/config/plan/',
        data=json.dumps(payload_custom),
        content_type='application/json'
    )

    res_custom = api_plan(req_custom)
    res_data_custom = json.loads(res_custom.content)
    assert res_data_custom.get('status') == 'success', f"Error creando plan personalizado: {res_data_custom.get('message')}"
    print("   [OK] Plan personalizado (Cámaras) creado exitosamente.")

    # Debug: check what is in Planes database table
    print("Debug: All planes in DB:")
    for p in Planes.objects.all():
        print(f"  - ID: {p.id}, Sede: {p.sede_id}, Nombre: {p.nombre}, Activo: {p.activo}")

    # 4. Verificar en el listado de configuración de la Sede
    print("4. Probando listado de Sede y mapeo de características...")
    # Mock session check on core/sede/config.py
    from core.sede import config as config_mod
    config_mod.checksession = lambda request: True

    req_config = rf.get(f'/api/sede/config/?sede_id={sede.id}')
    req_config.session = {} # Mock session

    res_config = api_config(req_config)
    res_data_config = json.loads(res_config.content)

    planes = res_data_config.get('planes', [])
    assert len(planes) == 2, f"Se esperaban 2 planes, se obtuvieron: {len(planes)}"

    # Verificar que el plan personalizado tenga 'custom_tipo_servicio' en caracteristicas_tecnicas_json
    plan_custom_rec = next(p for p in planes if 'Cámaras' in p['nombre'] or 'maras' in p['nombre'])
    assert plan_custom_rec['tipo_servicio'] == 'APP', f"El tipo en base de datos debe ser APP, se obtuvo: {plan_custom_rec['tipo_servicio']}"
    assert plan_custom_rec['caracteristicas_tecnicas_json'].get('custom_tipo_servicio') == 'camaras', "El campo custom_tipo_servicio debe estar guardado en JSONB"
    assert plan_custom_rec['admite_compromisos_pago_flexibles'] == False, "admite_compromisos_pago_flexibles debe estar desactivado"
    assert plan_custom_rec['bloqueo_automatico_mora'] == False, "bloqueo_automatico_mora debe estar desactivado"
    assert plan_custom_rec['prioridad_soporte_critica'] == False, "prioridad_soporte_critica debe estar desactivado"
    assert plan_custom_rec['requiere_api_externa_olt'] == False, "requiere_api_externa_olt debe estar desactivado"
    assert plan_custom_rec['permite_cambio_mufa_campo'] == False, "permite_cambio_mufa_campo debe estar desactivado"

    print("   [OK] Mapeo de categorías dinámicas en JSONB y limpieza de campos verificado correctamente.")

    # Limpieza
    Planes.objects.filter(sede=sede).delete()
    print("\n=== ¡TODAS LAS PRUEBAS DE PLANES PASARON EXITOSAMENTE! ===")

if __name__ == '__main__':
    run_tests()
