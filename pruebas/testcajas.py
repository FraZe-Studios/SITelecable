import os
import sys
import django
from decimal import Decimal

# Add parent directory to path to find sitelecable module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sitelecable.settings')
django.setup()

from django.utils import timezone
from core.models.models_generados import Sedes, Usuario, Cajas, CajaMovimientos, FacturacionPagos, Abonados, ServiciosAbonados, Planes
from django.test import RequestFactory
from core.caja.resumen import resumen
from core.caja.movimientos import movimientos
from core.caja.registrar import registrar
from core.abonados.pagos import sistema_registrar_pago_cliente

# Mockear las funciones de autenticacion importadas en los modulos de destino
import core.caja.resumen
import core.caja.movimientos
import core.caja.registrar

core.caja.resumen.checksession = lambda request: True
core.caja.resumen.getloggeduser = lambda request: getattr(request, 'user', None)

core.caja.movimientos.checksession = lambda request: True
core.caja.movimientos.getloggeduser = lambda request: getattr(request, 'user', None)

core.caja.registrar.checksession = lambda request: True
core.caja.registrar.getloggeduser = lambda request: getattr(request, 'user', None)

def run_tests():
    print("=== Iniciando pruebas del Modulo de Cajas y Permisos ===")

    # 1. Preparar Datos de Prueba
    print("1. Creando datos de prueba...")
    
    # Obtener o crear una sede de prueba
    sede, _ = Sedes.objects.get_or_create(
        nombre='Sede Prueba Cajas',
        defaults={
            'descripcion': 'Sede para pruebas automatizadas de cajas',
            'activo': True,
            'latitud': Decimal('-12.046374'),
            'longitud': Decimal('-77.031252')
        }
    )
    
    # Obtener o crear un usuario de prueba (Cajero)
    user, _ = Usuario.objects.get_or_create(
        username='cajero_prueba',
        defaults={
            'nombre_completo': 'Cajero de Pruebas',
            'rol': 'ventas',
            'sede_id': sede.id,
            'activo': True,
            'email': 'cajero@pruebas.com'
        }
    )
    # Resetear permisos iniciales del cajero
    user.permiso_efectivo = True
    user.permiso_transferencia = True
    user.cajas_permitidas = []
    user.save()

    # Obtener o crear un usuario Admin de prueba
    admin_user, _ = Usuario.objects.get_or_create(
        username='admin_prueba',
        defaults={
            'nombre_completo': 'Administrador Pruebas',
            'rol': 'tac',
            'sede_id': sede.id,
            'activo': True,
            'email': 'admin@pruebas.com'
        }
    )

    # Limpiar cualquier caja, movimiento y pago de pruebas previos en orden relacional correcto
    CajaMovimientos.objects.filter(usuario=user).delete()
    FacturacionPagos.objects.filter(vendedor_id=user.id).delete()
    FacturacionPagos.objects.filter(caja__sede=sede).update(caja_id=None)
    Cajas.objects.filter(sede=sede).delete()

    # Crear Caja 1 (Solo Efectivo)
    caja_efectivo = Cajas.objects.create(
        nombre='Caja Solo Efectivo',
        sede=sede,
        tipo_ubicacion='oficina',
        activo=True
    )
    caja_efectivo.configuracion_recaudo = {"efectivo": True, "transferencia": False}

    # Crear Caja 2 (Solo Transferencia/Bancos)
    caja_banco = Cajas.objects.create(
        nombre='Caja Solo Transferencia',
        sede=sede,
        tipo_ubicacion='campo',
        activo=True
    )
    caja_banco.configuracion_recaudo = {"efectivo": False, "transferencia": True}

    print("   [OK] Cajas creadas con configuraciones de recaudo respectivas.")

    # 2. Probar Asignación de Permisos a Cajas
    print("2. Probando asignacion de permisos de cajas al cajero...")
    
    # Vincular ambas cajas al cajero
    user.cajas_permitidas = [caja_efectivo.id, caja_banco.id]
    user.save()

    # Verificar lectura
    permitidas = user.cajas_permitidas
    assert caja_efectivo.id in permitidas, "Error: Caja efectivo no esta en cajas permitidas"
    assert caja_banco.id in permitidas, "Error: Caja banco no esta en cajas permitidas"
    print("   [OK] Permisos de usuario guardados y leidos correctamente en JSONB.")

    # 3. Probar Operaciones de Registro en Caja 1 (Solo Efectivo)
    print("3. Probando restricciones en Caja Solo Efectivo...")
    
    factory = RequestFactory()
    
    # Configurar sesión simulada del cajero operando en Caja 1
    session = {'active_caja_id': caja_efectivo.id, 'user_id': user.id}
    
    # 3.1 Registrar Efectivo (Debe ser exitoso)
    req1 = factory.post('/api/caja/registrar/', 
                        data={'tipo_movimiento': 'entrada_pago', 'metodo_pago': 'efectivo', 'monto': '50.00', 'descripcion': 'Venta manual'},
                        content_type='application/json')
    req1.session = session
    # Mockear checksession y getloggeduser
    django_session_auth_mock(req1, user)
    
    resp1 = registrar(req1)
    import json
    res1_data = json.loads(resp1.content)
    assert res1_data['status'] == 'success', f"Error al registrar efectivo: {res1_data.get('message')}"
    print("   - Registro de Efectivo: EXITOSO")

    # 3.2 Registrar Transferencia (Debe fallar)
    req2 = factory.post('/api/caja/registrar/', 
                        data={'tipo_movimiento': 'entrada_pago', 'metodo_pago': 'transferencia', 'monto': '120.00', 'descripcion': 'Transferencia bancaria'},
                        content_type='application/json')
    req2.session = session
    django_session_auth_mock(req2, user)
    
    resp2 = registrar(req2)
    res2_data = json.loads(resp2.content)
    assert res2_data['status'] == 'error', "Error: Se permitio transferencia en una caja con solo efectivo habilitado"
    print("   - Intento de Transferencia bloqueado correctamente: EXITOSO")

    # 4. Probar Operaciones en Caja 2 (Solo Transferencia)
    print("4. Probando restricciones en Caja Solo Transferencia...")
    
    session_banco = {'active_caja_id': caja_banco.id, 'user_id': user.id}
    
    # 4.1 Registrar Efectivo (Debe fallar)
    req3 = factory.post('/api/caja/registrar/', 
                        data={'tipo_movimiento': 'entrada_pago', 'metodo_pago': 'efectivo', 'monto': '10.00', 'descripcion': 'Cobro manual'},
                        content_type='application/json')
    req3.session = session_banco
    django_session_auth_mock(req3, user)
    
    resp3 = registrar(req3)
    res3_data = json.loads(resp3.content)
    assert res3_data['status'] == 'error', "Error: Se permitio efectivo en una caja con solo transferencia habilitada"
    print("   - Intento de Efectivo bloqueado correctamente: EXITOSO")

    # 4.2 Registrar Transferencia (Debe ser exitoso)
    req4 = factory.post('/api/caja/registrar/', 
                        data={'tipo_movimiento': 'entrada_pago', 'metodo_pago': 'transferencia', 'monto': '200.00', 'descripcion': 'Abono banco'},
                        content_type='application/json')
    req4.session = session_banco
    django_session_auth_mock(req4, user)
    
    resp4 = registrar(req4)
    res4_data = json.loads(resp4.content)
    assert res4_data['status'] == 'success', f"Error al registrar transferencia: {res4_data.get('message')}"
    print("   - Registro de Transferencia: EXITOSO")

    # 5. Verificar Metadata prefix en CajaMovimientos
    print("5. Verificando almacenamiento del prefijo de Caja en la descripcion del movimiento...")
    mov_efectivo = CajaMovimientos.objects.filter(usuario=user, metodo_pago='efectivo').first()
    assert mov_efectivo.descripcion.startswith(f"[CAJA_ID: {caja_efectivo.id}]"), "Error: El prefijo de caja no fue guardado en la descripcion"
    
    mov_banco = CajaMovimientos.objects.filter(usuario=user, metodo_pago='transferencia').first()
    assert mov_banco.descripcion.startswith(f"[CAJA_ID: {caja_banco.id}]"), "Error: El prefijo de caja no fue guardado en la descripcion"
    print("   - Prefijos de caja correctos en base de datos: EXITOSO")

    # 6. Registrar pago de cliente y verificar asociación con la caja
    print("6. Probando registro de Pago de Abonado vinculado a caja...")
    
    # Intentar obtener un ServiciosAbonados activo existente o crearlo con la cadena de dependencias
    servicio = ServiciosAbonados.objects.filter(estado_servicio='activo').first()
    if not servicio:
        print("   [INFO] No se encontro ServiciosAbonados en la BD. Creando uno temporal...")
        from core.models.infraestructura import Sectores, Hubs, FibrasOpticas, CajasNap
        
        sector, _ = Sectores.objects.get_or_create(
            nombre='Sector Prueba Cajas',
            defaults={
                'prefijo_comercial': 'SPC',
                'poligono_coordenadas_json': [],
                'sede': sede
            }
        )
        hub, _ = Hubs.objects.get_or_create(
            nombre='HUB-PRUEBA',
            defaults={
                'sede': sede,
                'latitud': Decimal('-12.04'),
                'longitud': Decimal('-77.03'),
                'activo': True
            }
        )
        fibra, _ = FibrasOpticas.objects.get_or_create(
            nombre='FO-PRUEBA',
            defaults={
                'hub_origen': hub,
                'activo': True
            }
        )
        nap, _ = CajasNap.objects.get_or_create(
            codigo='NAP-PRUEBA',
            defaults={
                'sector': sector,
                'fibra_optica': fibra,
                'estado_precinto': 'activo',
                'capacidad_puertos': '8',
                'estado_puertos': {},
                'activo': True
            }
        )
        cliente, _ = Abonados.objects.get_or_create(
            dni='99999999',
            defaults={
                'tipo_cliente': 'natural',
                'nombres_apellidos': 'Cliente de Prueba Cajas',
                'celular_1': '999999999',
                'correo': 'cliente@pruebas.com',
                'direccion_fiscal': 'Direccion prueba'
            }
        )
        plan, _ = Planes.objects.get_or_create(
            nombre='Plan Prueba Cajas',
            defaults={
                'costo_mensual': Decimal('50.00'),
                'tipo_servicio': 'internet',
                'tipo_cliente': 'residencial',
                'dia_vencimiento': 'fin_mes',
                'sede': sede,
                'activo': True,
                'caracteristicas_tecnicas_json': {"caracteristicas_base": {"velocidad_mbps": 100}}
            }
        )
        servicio = ServiciosAbonados.objects.create(
            codigo='SERV-PRUEBA',
            cliente=cliente,
            caja_nap=nap,
            plan=plan,
            numero_suministro='123456',
            direccion_servicio='Direccion prueba',
            distrito='Distrito',
            provincia='Provincia',
            departamento='Departamento',
            estado_servicio='activo',
            deuda_acumulada=Decimal('100.00')
        )

    # Obtener o crear RUC de prueba para evitar violaciones de clave foránea
    from core.models.models_generados import RucsGlobales
    ruc = RucsGlobales.objects.first()
    if not ruc:
        ruc = RucsGlobales.objects.create(
            ruc_numero='20123456789',
            razon_social='Empresa de Prueba S.A.',
            direccion_fiscal='Calle Ficticia 123',
            activo=True
        )
    ruc_id = ruc.id

    # Simular registro de pago del cliente
    pago_datos = {
        'servicio_id': servicio.id,
        'cliente_id': servicio.cliente_id,
        'suministro_id': servicio.numero_suministro,
        'ruc_emisor_id': ruc_id,
        'tipo_documento': 'boleta',
        'metodo_pago': 'transferencia',
        'monto': '50.00',
        'caja_id': caja_banco.id, # Caja Solo Transferencia
        'personal_id': user.id,
        'sede_id': sede.id
    }
    
    # Registrar el pago
    resultado_pago = sistema_registrar_pago_cliente(pago_datos)
    pago_trans = FacturacionPagos.objects.get(pk=resultado_pago['transaccion_ids'][0])
    assert pago_trans.caja_id == caja_banco.id, "Error: El pago registrado no contiene el caja_id esperado"
    print("   - Pago de abonado asociado a caja_id correctamente: EXITOSO")

    # 7. Probar Resumen Diario y Cuadre de Caja
    print("7. Probando consulta de Resumen Diario de Caja...")
    
    # 7.1 Cajero consultando su Caja 2 activa
    req_resumen = factory.get(f'/api/caja/resumen/?fecha={timezone.localdate().strftime("%Y-%m-%d")}')
    req_resumen.session = session_banco
    django_session_auth_mock(req_resumen, user)
    
    resp_resumen = resumen(req_resumen)
    res_resumen_data = json.loads(resp_resumen.content)
    
    assert res_resumen_data['status'] == 'success'
    # Caja activa debe ser Caja 2
    assert res_resumen_data['active_caja']['id'] == caja_banco.id
    # Totales de Caja 2: Movimiento manual (200.00) + Pago de cliente (50.00) = 250.00
    assert float(res_resumen_data['personal_totales']['transferencia']) == 250.00, f"Error: Total transferencia esperado 250.00, obtenido {res_resumen_data['personal_totales']['transferencia']}"
    print("   - Cuadre matematico e historial consolidado (Manual + Abonos) correcto: EXITOSO")

    # 7.2 Consulta de movimientos filtrada y descripciones limpias
    req_movs = factory.get(f'/api/caja/movimientos/?fecha={timezone.localdate().strftime("%Y-%m-%d")}')
    req_movs.session = session_banco
    django_session_auth_mock(req_movs, user)
    
    resp_movs = movimientos(req_movs)
    res_movs_data = json.loads(resp_movs.content)
    assert res_movs_data['status'] == 'success'
    
    # Comprobar que en los movimientos personales están el movimiento manual y el pago del cliente
    m_personales = res_movs_data['personales']
    assert len(m_personales) >= 2
    
    # Verificar que el prefijo del movimiento manual no se muestra al usuario final
    mov_manual_api = next(m for m in m_personales if m['id'].startswith('manual_'))
    assert not mov_manual_api['descripcion'].startswith('[CAJA_ID:'), f"Error: La API expuso el prefijo de la caja: {mov_manual_api['descripcion']}"
    print("   - Limpieza de metadatos en descripciones de transacciones: EXITOSO")

    print("\n=== ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE! Modulo de cajas y control transaccional verificado. ===")

def django_session_auth_mock(request, user):
    """Auxiliar para mockear el inicio de sesión en Django para la API de comun.py"""
    request.user = user
    # Mockear las funciones checksession y getloggeduser en el request
    request.session['usuario_id'] = user.id

if __name__ == '__main__':
    run_tests()
