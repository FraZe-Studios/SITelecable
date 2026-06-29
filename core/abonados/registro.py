import uuid
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from django.db import connection, transaction
from django.utils import timezone

# Importaciones alineadas estrictamente al contrato de persistencia unificada core
from core.models.models_generados import (
    Abonados, ServiciosAbonados, TicketsOrdenes, Planes, FacturacionPagos, CacheSuministro
)


def _decimal(value, default='0'):
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError):
        return Decimal(default)


def _parse_fecha(value):
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value)[:10], '%Y-%m-%d').date()
    except ValueError:
        return None


def _normalize_estado_civil(value):
    if not value:
        return 'soltero'
    val = str(value).strip().lower()
    if val in ('soltero', 'soltera'):
        return 'soltero'
    elif val in ('casado', 'casada'):
        return 'casado'
    elif val in ('divorciado', 'divorciada'):
        return 'divorciado'
    elif val in ('viudo', 'viuda'):
        return 'viudo'
    elif val in ('conviviente',):
        return 'conviviente'
    return 'soltero'


def sistema_registro_cliente(datos):
    """
    Registra cliente + suscripción de servicio, o añade un nuevo servicio a un abonado existente.
    Garantiza la ciberseguridad transaccional y auditoría nativa del sistema.
    """
    def _clean_str(val):
        if not val:
            return None
        s = str(val).strip()
        if s in ('', '—', '-', 'None', 'null'):
            return None
        return s

    dni = _clean_str(datos.get('dni'))
    ruc = _clean_str(datos.get('ruc'))
    celular = _clean_str(datos.get('celular_1'))
    existing_client_id = datos.get('cliente_id')

    suministro_num = _clean_str(datos.get('suministro'))
    if not suministro_num:
        raise ValueError('Número de suministro requerido')

    plan_id = datos.get('plan_id')
    if not plan_id:
        raise ValueError('Plan requerido')

    vendedor_id = datos.get('vendedor_id')
    if not vendedor_id:
        raise ValueError('Vendedor requerido')

    plan = Planes.objects.select_related('sede').get(id=plan_id)
    lat = _decimal(datos.get('latitud', '-11.593160'))
    lng = _decimal(datos.get('longitud', '-75.896170'))
    direccion = (datos.get('direccion_servicio') or 'Sin dirección')[:255]
    
    # Blindaje de costos consultando la tabla de caché de suministros relacional (Regla 7)
    cache_entry = CacheSuministro.objects.filter(numero_suministro=suministro_num).first()
    if cache_entry:
        lat = cache_entry.latitud if cache_entry.latitud else lat
        lng = cache_entry.longitud if cache_entry.longitud else lng
        direccion = (cache_entry.direccion or direccion)[:255]

    nombre = _clean_str(datos.get('nombre_apellidos') or datos.get('razon_social'))
    if not nombre:
        nombre = f"Abonado DNI {dni}" if dni else "Nuevo Abonado"
    razon = _clean_str(datos.get('razon_social'))

    with transaction.atomic():
        # Invocación obligatoria del registro de responsabilidad transaccional en PostgreSQL (Regla 7)
        with connection.cursor() as cursor:
            cursor.execute("SELECT set_auditoria_usuario(%s);", [int(vendedor_id)])

        client_id = None
        if not existing_client_id:
            if not celular:
                raise ValueError('Celular principal requerido')
            
            if dni and Abonados.objects.filter(dni=dni).exists():
                raise ValueError('Ya existe un cliente registrado con este DNI')
            if ruc and Abonados.objects.filter(ruc=ruc).exists():
                raise ValueError('Ya existe un cliente registrado con este RUC')

            cliente = Abonados.objects.create(
                tipo_cliente='juridico' if ruc else 'natural',
                dni=dni,
                ruc=ruc,
                razon_social=razon,
                nombres_apellidos=nombre if not ruc else None,
                celular_1=celular,
                celular_2=_clean_str(datos.get('celular_2')),
                correo=_clean_str(datos.get('correo')) or '',
                direccion_fiscal=_clean_str(datos.get('direccion_fiscal') or direccion) or '',
                estado_civil=_normalize_estado_civil(datos.get('estado_civil')),
                fecha_nacimiento=_parse_fecha(datos.get('cumpleanos')),
                datos_adicionales_json={}
            )
            client_id = cliente.id
        else:
            from core.abonados.geoutils import parse_cliente_id
            parsed_id = parse_cliente_id(existing_client_id)
            
            try:
                cliente = Abonados.objects.get(pk=parsed_id)
                client_id = cliente.id
            except Abonados.DoesNotExist:
                raise ValueError(f'Cliente con código {existing_client_id} no existe')

        # Deducir procedencia de infraestructura por herencia lógica ascendente (Regla A4)
        from core.abonados.generador import obtener_codigo_servicio_actualizado
        from core.abonados.geoutils import buscar_sector_por_gps
        from core.models.infraestructura import CajasNap, Sectores, Sedes

        sector = buscar_sector_por_gps(lat, lng)
        nap = None
        if sector:
            nap = CajasNap.objects.filter(sector=sector, activo=True).first()
            if not nap:
                nap = CajasNap.objects.create(
                    sector=sector,
                    codigo=f"NAP-{sector.prefijo_comercial.upper()}-001",
                    activo=True,
                    capacidad_puertos="16",
                    estado_puertos={},
                    estado_precinto="activo"
                )
        
        if not nap and plan.sede:
            nap = CajasNap.objects.filter(sector__sede=plan.sede, activo=True).first()
            if not nap:
                sector_sede = Sectores.objects.filter(sede=plan.sede, activo=True).first()
                if sector_sede:
                    base_codigo = f"NAP-{sector_sede.prefijo_comercial.upper()}"
                    siguiente = CajasNap.objects.filter(codigo__startswith=base_codigo).count() + 1
                    nap = CajasNap.objects.create(
                        sector=sector_sede,
                        codigo=f"{base_codigo}-{siguiente:03d}",
                        activo=True,
                        capacidad_puertos="16",
                        estado_puertos={},
                        estado_precinto="activo"
                    )
        if not nap:
            sede = plan.sede or Sedes.objects.filter(activo=True).first()
            if not sede:
                sede = Sedes.objects.create(nombre="Sede Central", activo=True)
            sector_fallback = Sectores.objects.filter(sede=sede, activo=True).first()
            if not sector_fallback:
                sector_fallback = Sectores.objects.create(
                    sede=sede,
                    nombre="Sector Central",
                    prefijo_comercial="CEN",
                    activo=True
                )
            nap = CajasNap.objects.create(
                sector=sector_fallback,
                codigo="NAP-CEN-001",
                activo=True,
                capacidad_puertos="16",
                estado_puertos={},
                estado_precinto="activo"
            )

        # Generación incremental del código de servicio e identificador único
        sub_code = f"TMP-{uuid.uuid4().hex[:24]}"

        evaluacion = datos.get('evaluacion') or {}
        cuotas = int(datos.get('cuotas') or 1)
        pagar_deuda_cuotas = bool(datos.get('pagar_deuda_cuotas'))
        deuda_a_pagar = Decimal(str(evaluacion.get('deuda_a_pagar') or '0'))
        descuento_deuda = Decimal(str(datos.get('descuento_deuda') or '0'))
        
        # Apply debt discount if specified
        if descuento_deuda > 0 and deuda_a_pagar > 0:
            deuda_a_pagar = max(Decimal('0'), deuda_a_pagar - descuento_deuda)
        
        control_json = {}
        modo_pago_plan = (datos.get('modo_pago_plan') or 'FIN_MES').upper()
        control_json['modo_pago_plan'] = modo_pago_plan
        
        # Process facturacion structured object if provided
        facturacion = datos.get('facturacion', {})
        if facturacion:
            # Store base tariff info
            control_json['tarifa_base'] = facturacion.get('tarifa_base', {})
            
            # Store permanent discounts
            descuentos_perm = facturacion.get('descuentos_permanentes', {})
            descuento_plan = Decimal(str(descuentos_perm.get('porcentaje_plan') or 0))
            meses_gratis = int(descuentos_perm.get('meses_gratis') or 0)
            if descuento_plan > 0:
                control_json['descuento_permanente'] = float(descuento_plan)
            if meses_gratis > 0:
                control_json['meses_gratis'] = meses_gratis
                control_json['fecha_fin_gratis'] = (date.today() + timedelta(days=30*meses_gratis)).isoformat()
            
            # Store debt proration info
            deuda_info = facturacion.get('deuda', {})
            cuotas_deuda = int(deuda_info.get('cuotas') or 1)
            if cuotas_deuda > 1:
                control_json['deuda_prorrateo'] = {
                    'total': deuda_info.get('total'),
                    'cuotas': cuotas_deuda,
                    'monto_cuota': deuda_info.get('monto_cuota')
                }
                # Override cuotas for debt payment
                cuotas = cuotas_deuda
            
            # Store additional services info
            control_json['servicios_adicionales'] = facturacion.get('servicios_adicionales', {})
        else:
            # Legacy support: process individual fields
            descuento_plan = Decimal(str(datos.get('descuento_plan') or '0'))
            meses_gratis = int(datos.get('meses_gratis') or 0)
            if descuento_plan > 0:
                control_json['descuento_permanente'] = float(descuento_plan)
            if meses_gratis > 0:
                control_json['meses_gratis'] = meses_gratis
                control_json['fecha_fin_gratis'] = (date.today() + timedelta(days=30*meses_gratis)).isoformat()
            
            cuotas_deuda = int(datos.get('cuotas_deuda') or 1)
            if cuotas_deuda > 1:
                cuotas = cuotas_deuda
        
        if pagar_deuda_cuotas and cuotas > 1 and deuda_a_pagar > 0:
            monto_cuota = (deuda_a_pagar / cuotas).quantize(Decimal('0.01'))
            total_cobrar = float(evaluacion.get('total_cobrar_ahora') or 0)
            cuotas_restantes = cuotas - 1 if (modo_pago_plan == 'CONTADO' and total_cobrar > 0) else cuotas
            control_json['plan_financiamiento'] = {
                'monto_total': float(deuda_a_pagar),
                'cuotas_totales': cuotas,
                'cuotas_restantes': cuotas_restantes,
                'monto_cuota': float(monto_cuota)
            }

        generar_orden = datos.get('generar_orden_instalacion', True)
        est_serv = 'pendiente_instalacion' if generar_orden else 'activo'
        f_instalacion = None if generar_orden else date.today()

        suscripcion = ServiciosAbonados(
            id=None,
            cliente_id=client_id,
            caja_nap=nap,
            plan_id=plan.id,
            codigo=sub_code,
            numero_suministro=suministro_num,
            direccion_servicio=direccion,
            distrito=datos.get('distrito', 'La Oroya') or 'La Oroya',
            provincia=datos.get('provincia', 'Yauli') or 'Yauli',
            departamento=datos.get('departamento', 'Junín') or 'Junín',
            latitud=lat,
            longitud=lng,
            estado_servicio=est_serv,
            fecha_instalacion=f_instalacion,
            control_operativo_json=control_json,
            deuda_acumulada=Decimal('0'),
            vendedora_id=vendedor_id
        )
        suscripcion.save()
        suscripcion.refresh_from_db()
        suscripcion.codigo = obtener_codigo_servicio_actualizado(suscripcion)
        suscripcion.save(update_fields=['codigo'])

        ticket_id = None
        if datos.get('generar_orden_instalacion', True):
            p_instalacion = _decimal(datos.get('precio_instalacion') or datos.get('precio_base') or datos.get('costo_instalacion'), '0.00')
            
            # Orden de instalación configurada bajo tipos enumerados acotados (Filtro del MVP)
            ticket_campo = TicketsOrdenes.objects.create(
                servicio=suscripcion,
                categoria='instalacion',
                area='planta_externa',
                tecnologia='todos',
                modalidad='campo',
                nombre_ticket='Nueva instalación (Campo)',
                estado='pendiente',
                prioridad='media',
                precio_base=p_instalacion,
                empleado_atc_generador_id=vendedor_id
            )
            ticket_id = ticket_campo.id
            
            # Generate app installation ticket if apps selected
            app_ids = datos.get('app_ids', [])
            if app_ids:
                TicketsOrdenes.objects.create(
                    servicio=suscripcion,
                    categoria='instalacion',
                    area='planta_interna',
                    tecnologia='todos',
                    modalidad='remoto',
                    nombre_ticket='Orden de Instalación - App a Virtual (Remoto)',
                    estado='pendiente',
                    prioridad='media',
                    precio_base=Decimal('0'),
                    empleado_atc_generador_id=vendedor_id
                )
            
            # Generate anexo installation tickets for DUO/TV plans
            num_anexos = int(datos.get('num_anexos') or 0)
            if num_anexos > 0:
                tipo_servicio = plan.tipo_servicio.lower() if plan.tipo_servicio else ''
                if 'duo' in tipo_servicio or 'tv' in tipo_servicio:
                    # First anexo is free at registration
                    anexos_cobrar = max(0, num_anexos - 1)
                    for i in range(num_anexos):
                        es_gratis = (i == 0)  # First one is free
                        costo_anexo = Decimal('0') if es_gratis else p_instalacion
                        
                        # Activate instalacion_anexo special function
                        funciones_anexo = {
                            "instalacion_anexo": {
                                "activado": True,
                                "fecha_activacion": timezone.now().isoformat(),
                                "tipo_anexo": tipo_servicio.upper(),
                                "costo_mensual": float(costo_anexo) if not es_gratis else 0,
                                "es_gratis_registro": es_gratis,
                                "estado": "pendiente",
                                "numero_anexo": i + 1,
                                "total_anexos": num_anexos
                            }
                        }
                        
                        TicketsOrdenes.objects.create(
                            servicio=suscripcion,
                            categoria='instalacion',
                            area='planta_externa',
                            tecnologia='tv' if 'tv' in tipo_servicio else 'duo',
                            modalidad='campo',
                            nombre_ticket=f'Instalación de Anexo #{i+1} ({"GRATIS" if es_gratis else "COBRADO"})',
                            estado='pendiente',
                            prioridad='media',
                            precio_base=costo_anexo,
                            empleado_atc_generador_id=vendedor_id,
                            funciones_especiales=funciones_anexo
                        )

        # Registro de planes dinámicos adicionales opcionales (apps)
        app_ids = datos.get('app_ids', [])
        omitir_pago_apps = bool(datos.get('omitir_pago_apps'))
        for app_id in app_ids:
            try:
                app_plan = Planes.objects.get(id=app_id, tipo_servicio='app')
                app_sub_code = f"TMP-{uuid.uuid4().hex[:24]}"
                
                # Generate unique supply number for app plan to avoid duplicate constraint
                app_suministro_num = f"{suministro_num}-APP{app_ids.index(app_id)+1}"
                
                app_sub = ServiciosAbonados.objects.create(
                    cliente_id=client_id,
                    caja_nap=nap,
                    plan_id=app_plan.id,
                    codigo=app_sub_code,
                    numero_suministro=app_suministro_num,
                    direccion_servicio=direccion,
                    distrito=suscripcion.distrito,
                    provincia=suscripcion.provincia,
                    departamento=suscripcion.departamento,
                    latitud=lat,
                    longitud=lng,
                    estado_servicio='activo',
                    fecha_instalacion=date.today(),
                    vendedora_id=vendedor_id
                )
                app_sub.codigo = obtener_codigo_servicio_actualizado(app_sub)
                app_sub.save(update_fields=['codigo'])
                
                if omitir_pago_apps:
                    FacturacionPagos.objects.create(
                        servicio=app_sub,
                        ruc_emisor_id=int(datos.get('ruc_emisor_id') or 1),
                        tipo_documento='nota_venta',
                        tipo_transaccion='exoneracion',
                        monto=Decimal('0.00'),
                        descripcion=f'Pago inicial de aplicativo {app_plan.nombre_plan} omitido (Gratis por 1 año)',
                        vendedor_id=vendedor_id,
                        fecha_transaccion=timezone.now(),
                        fecha_vencimiento=date.today(),
                        fecha_creacion=timezone.now(),
                    )
            except Planes.DoesNotExist:
                continue

    evaluacion = datos.get('evaluacion') or {}
    return {
        'cliente_id': suscripcion.cliente_id,
        'suscripcion_id': suscripcion.codigo,
        'ticket_id': ticket_id,
        'sede': plan.sede.nombre,
        'pago': {
            'modo_plan': datos.get('modo_pago_plan', 'FIN_MES'),
            'ruc_emisor_id': datos.get('ruc_emisor_id'),
            'tipo_comprobante': datos.get('tipo_comprobante'),
            'total_cobrar': evaluacion.get('total_cobrar_ahora'),
            'emitir_comprobante': bool(datos.get('emitir_comprobante', True)),
        },
    }
