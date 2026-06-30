from django.http import JsonResponse
from django.db.models import Q

from core.models.models_generados import (
    Sedes, RucsGlobales, SedeRuc, Contratos, Planes, PlanAnexosTv, Personal, Tickets,
    MaterialesConfiguracion, CatalogoTickets, Sectores,
    Cajas
)
from core.auth.comun import checksession, senderror
from core.sede.sedeutils import strip_sede_prefijo

def _catalogo_ticket_dict(t):
    return {
        'id': t.id,
        'categoria': t.categoria,
        'area': t.area,
        'tecnologia': t.tecnologia,
        'modalidad': t.modalidad,
        'nombre': t.nombre_ticket,
        'funciones_especiales': t.funciones_especiales or '',
        'flag_funciones_especiales': t.flag_funciones_especiales,
        'es_universal': True,  # Todos los tickets son universales en el esquema actual
        'sede_id': None,
        'precio_base': float(t.precio_base or 0),
        'activo': t.activo,
        'permite_eliminar': True,
        'editar_mapa': getattr(t, 'editar_mapa', False),
        'mantiene_equipo_anterior': getattr(t, 'mantiene_equipo_anterior', False),
        'cobra_materiales_liquidar': getattr(t, 'cobra_materiales_liquidar', False),
        'requiere_nuevo_suministro': getattr(t, 'requiere_nuevo_suministro', False),
        'migracion_plan': getattr(t, 'migracion_plan', False),
        'migracion_genera_cambio_equipo': getattr(t, 'migracion_genera_cambio_equipo', False),
        'cambio_equipo': getattr(t, 'cambio_equipo', False),
        'es_instalacion': getattr(t, 'es_instalacion', False),
        'genera_merma': getattr(t, 'genera_merma', False),
        'corte_temporal': getattr(t, 'corte_temporal', False),
        'morosidad': getattr(t, 'morosidad', False),
        'corte_definitivo': getattr(t, 'corte_definitivo', False),
        'reiniciar_servicio': getattr(t, 'reiniciar_servicio', False),
        'instalacion_anexo': getattr(t, 'instalacion_anexo', False),
        'corte_anexo': getattr(t, 'corte_anexo', False),
    }

def config(request):
    """
    GET /api/sede/config/?sede_id=<id>
    Devuelve JSON completo con todos los datos de la sede para el panel de tabs.
    """
    if not checksession(request):
        return senderror('Sin sesión', status=401)

    sede_id = request.GET.get('sede_id')
    if not sede_id:
        return senderror('sede_id requerido', status=400)

    # Set current_sede_id in session for use in other endpoints
    request.session['current_sede_id'] = sede_id

    try:
        sede = Sedes.objects.get(pk=sede_id)
        sector = sede.sector

        nombre_base = strip_sede_prefijo(sede.nombre)
        activa = getattr(sede, 'activa', True)

        logo_url = ''
        srs_logo = SedeRuc.objects.filter(sede=sede).select_related('ruc')
        if srs_logo.exists():
            sr_logo = next((x for x in srs_logo if x.logo_url), None)
            if sr_logo and sr_logo.logo_url:
                logo_url = sr_logo.logo_url
            else:
                sr_ruc = next((x for x in srs_logo if x.ruc.logo_url), None)
                if sr_ruc and sr_ruc.ruc.logo_url:
                    logo_url = sr_ruc.ruc.logo_url

        datos_sede = {
            'id': sede.id,
            'nombre': nombre_base,
            'nombre_base': nombre_base,
            'descripcion': sede.descripcion or '',
            'latitud': float(sede.latitud) if sede.latitud is not None else None,
            'longitud': float(sede.longitud) if sede.longitud is not None else None,
            'sector_id': sector.id if sector else None,
            'sector_codigo': sector.nombre if sector else '',
            'sector_prefijo': sector.prefijo_comercial if sector else '',
            'activa': activa,
            'logo_url': logo_url,
        }

        rucs_qs = SedeRuc.objects.filter(sede=sede).select_related('ruc')
        rucs = []
        for sr in rucs_qs:
            rucs.append({
                'ruc_id': sr.ruc.id,
                'numero_ruc': sr.ruc.ruc_numero,
                'razon_social': sr.ruc.razon_social,
                'direccion_fiscal': sr.ruc.direccion_fiscal or '',
                'logo_url': sr.ruc.logo_url or '',
                'usuario_sol': sr.ruc.usuario_sol,
                'monto_recaudado_mes': float(sr.ruc.monto_recaudado_mes or 0),
                'monto_recaudado_anio': float(sr.ruc.monto_recaudado_anio or 0),
                'permite_boleta': sr.permite_boleta,
                'permite_factura': sr.permite_factura,
                'permite_nota_venta': sr.permite_nota_venta,
                'formato_impresion': sr.formato_impresion,
                'logo_url_sede': sr.logo_url or '',
            })

        todos_rucs = [
            {'id': r.id, 'numero_ruc': r.ruc_numero, 'razon_social': r.razon_social}
            for r in RucsGlobales.objects.all()
        ]

        try:
            contrato = Contratos.objects.get(sede=sede)
            datos_contrato = {
                'id': contrato.id,
                'titulo': contrato.titulo,
                'introduccion': contrato.introduccion or '',
                'clausulas': contrato.clausulas or '',
                'pdf_template_path': contrato.pdf_template_path or '',
                'velocidad_garantizada': float(contrato.velocidad_garantizada) if contrato.velocidad_garantizada else 70.0,
                'plazo_atencion_horas': contrato.plazo_atencion_horas or 48,
                'costo_reconexion': float(contrato.costo_reconexion) if contrato.costo_reconexion else 15.0,
                'ruc_facturacion_id': contrato.ruc_facturacion_id,
            }
        except Contratos.DoesNotExist:
            datos_contrato = None

        planes = []
        for p in Planes.objects.filter(sede=sede).order_by('tipo_servicio', 'costo_mensual'):
            anexos = list(
                PlanAnexosTv.objects.filter(plan=p, activo=True).values('id', 'nombre', 'precio_adicional')
            )
            for a in anexos:
                a['precio_adicional'] = float(a['precio_adicional'])
            
            caracteristicas = p.caracteristicas_tecnicas_json or {}
            caracteristicas_base = caracteristicas.get('caracteristicas_base', {})
            activacion_funciones = caracteristicas.get('activacion_funciones', {})
            permisos_formularios = caracteristicas.get('permisos_formularios', {})
            
            velocidad = caracteristicas_base.get('velocidad_mbps') or p.velocidad_mbps if hasattr(p, 'velocidad_mbps') else 0
            canales = caracteristicas_base.get('cantidad_canales') or p.canales if hasattr(p, 'canales') else 0

            planes.append({
                'id': p.id,
                'tipo_servicio': p.tipo_servicio.upper() if p.tipo_servicio else '',
                'tipo_cliente': p.tipo_cliente.upper() if p.tipo_cliente else '',
                'nombre': p.nombre_plan or p.nombre,
                'costo_mensual': float(p.costo_plan or p.costo_mensual),
                'velocidad_mbps': velocidad or 0,
                'cantidad_canales': canales or 0,
                'conexiones_tv_gratis': p.conexiones_tv_gratis or 0,
                'costo_conexion_tv_adicional': float(p.costo_conexion_tv_adicional or 0),
                'admite_prorroga': activacion_funciones.get('admite_prorrogas', p.admite_prorroga),
                'admite_prorrateo': p.admite_prorrateo,
                'admite_compromisos_pago_flexibles': activacion_funciones.get('compromisos_pago_flexibles', p.admite_compromiso_pago),
                'bloqueo_automatico_mora': activacion_funciones.get('bloqueo_automatico_mora', False),
                'prioridad_soporte_critica': activacion_funciones.get('prioridad_soporte_critica', False),
                'requiere_api_externa_olt': permisos_formularios.get('requiere_api_externa_olt', False),
                'permite_cambio_mufa_campo': permisos_formularios.get('permite_cambio_mufa_campo', False),
                'dia_vencimiento': 'fecha_instalacion' if (p.configuracion_fecha_pago or '').lower() == 'fecha_instalacion' else 'fin_mes',
                'dias_gracia': p.dias_amnistia if p.dias_amnistia is not None else (p.dias_gracia if p.dias_gracia is not None else 0),
                'descuento_pago_anticipado_monto': float(p.monto_descuento_pago_anticipado or 0),
                'descuento_pago_anticipado_dias': p.dias_anticipacion_descuento or 0,
                'caracteristicas_tecnicas_json': caracteristicas,
                'anexos_tv': anexos,
            })

        assigned_here = list(Personal.objects.filter(sede_id=sede.id).values_list('id', flat=True))
        
        personal_qs = Personal.objects.filter(
            id__in=assigned_here
        ).select_related('supervisor').order_by('rol', 'nombre_completo')
        personal = []
        for p in personal_qs:
            tiene_usuario = True
            username = p.username
            is_active = p.is_active

            # Leer habilidades desde habilidades_json del Usuario
            habilidades_json = p.habilidades_json or {}
            print(f"Leyendo habilidades para {p.nombre_apellidos} (ID: {p.id}): {habilidades_json}")
            
            # Enviar la estructura completa de habilidades_json para que el frontend pueda leerla
            habilidades = habilidades_json if habilidades_json else None
            
            if habilidades:
                print(f"Habilidades a enviar: {habilidades}")
            else:
                print("habilidades_json está vacío o es None")

            personal.append({
                'id': p.id,
                'nombre_apellidos': p.nombre_apellidos,
                'correo': p.correo,
                'celular': p.celular or '',
                'cargo': p.cargo,
                'supervisor_id': p.supervisor_id,
                'supervisor_nombre': p.supervisor.nombre_apellidos if p.supervisor else '',
                'tipo_caja_autorizada': p.tipo_caja_autorizada,
                'tiene_usuario': tiene_usuario,
                'username': username,
                'is_active': is_active,
                'habilidades': habilidades,
                'cajas_permitidas': p.cajas_permitidas,
            })

        personal_disponible = []
        disponibles_qs = Personal.objects.exclude(id__in=assigned_here).exclude(username='admin').order_by('nombre_completo')
        for p in disponibles_qs:
            personal_disponible.append({
                'id': p.id,
                'nombre_apellidos': p.nombre_apellidos,
                'cargo': p.cargo,
                'username': p.username,
            })

        tickets_qs = Tickets.objects.filter(
            servicio__plan__sede=sede
        ).select_related(
            'servicio', 'servicio__cliente', 'servicio__plan', 'servicio__caja_nap__sector'
        ).order_by('-fecha_creacion')[:100]

        tickets = []
        for t in tickets_qs:
            # Fetching assignee name (single technician from tecnico_asignado_id)
            tecnicos = []
            if t.tecnico_asignado_id:
                from core.models.usuarios import Usuario
                try:
                    tecnico = Usuario.objects.get(pk=t.tecnico_asignado_id)
                    tecnicos = [tecnico.nombre_completo]
                except Usuario.DoesNotExist:
                    pass
            tickets.append({
                'id': t.id,
                'tipo_ticket': t.tipo_ticket,
                'nombre_ticket': t.nombre_ticket,
                'tipo_origen': 'AUTOMATICO',
                'estado_ticket': t.estado_ticket,
                'fecha_creacion': t.fecha_creacion.isoformat() if t.fecha_creacion else None,
                'fecha_liquidacion': t.fecha_liquidacion.isoformat() if t.fecha_liquidacion else None,
                'sla_cumplido': True,
                'omite_generacion_deuda': False,
                'suscripcion_id': str(t.servicio.id).zfill(7) if t.servicio else '',
                'cliente_nombre': t.servicio.cliente.nombre_apellidos if t.servicio and t.servicio.cliente else '',
                'cliente_dni': t.servicio.cliente.dni if t.servicio and t.servicio.cliente else '',
                'cliente_codigo': t.servicio.codigo if t.servicio else '',
                'cliente_telefono': t.servicio.cliente.celular_1 if t.servicio and t.servicio.cliente else '',
                'cliente_celular': t.servicio.cliente.celular_2 if t.servicio and t.servicio.cliente else '',
                'suministro_direccion': t.servicio.direccion_servicio if t.servicio else '',
                'suministro_referencia': t.servicio.referencia_domicilio if t.servicio else '',
                'suscripcion_observaciones': t.servicio.observaciones if t.servicio else '',
                'plan_nombre': t.servicio.plan.nombre if t.servicio and t.servicio.plan else '',
                'plan_tipo_servicio': t.servicio.plan.tipo_servicio.upper() if t.servicio and t.servicio.plan and t.servicio.plan.tipo_servicio else '',
                'sector_nombre': t.servicio.caja_nap.sector.nombre if (t.servicio and t.servicio.caja_nap and t.servicio.caja_nap.sector) else '',
                'tecnicos': tecnicos,
            })

        catalogo_qs = CatalogoTickets.objects.filter(
            activo=True
        ).order_by('area', 'categoria', 'nombre_ticket')
        catalogo_tickets = [_catalogo_ticket_dict(t) for t in catalogo_qs]

        sug_categorias = list(CatalogoTickets.objects.filter(activo=True).exclude(categoria__isnull=True).values_list('categoria', flat=True).distinct())
        sug_areas = list(CatalogoTickets.objects.filter(activo=True).exclude(area__isnull=True).values_list('area', flat=True).distinct())
        sug_tecnologias = list(CatalogoTickets.objects.filter(activo=True).exclude(tecnologia__isnull=True).values_list('tecnologia', flat=True).distinct())
        sug_modalidades = list(CatalogoTickets.objects.filter(activo=True).exclude(modalidad__isnull=True).values_list('modalidad', flat=True).distinct())
        sug_nombres = list(CatalogoTickets.objects.filter(activo=True).exclude(nombre_ticket__isnull=True).values_list('nombre_ticket', flat=True).distinct())

        def clean_upper(val):
            return str(val).strip().upper()

        sugerencias_catalogo = {
            'categorias': sorted(list(set([clean_upper(c) for c in sug_categorias if clean_upper(c) not in ('TODOS', 'TODAS')]))),
            'areas': sorted(list(set([clean_upper(a) for a in sug_areas if clean_upper(a) not in ('TODOS', 'TODAS')]))),
            'tecnologias': sorted(list(set([str(t).strip() for t in sug_tecnologias]))),
            'modalidades': sorted(list(set([clean_upper(m) for m in sug_modalidades if clean_upper(m) not in ('TODOS', 'TODAS')]))),
            'nombres': sorted(list(set([str(n).strip() for n in sug_nombres]))),
        }

        materiales = [
            {
                'id': m.id,
                'nombre_material': m.nombre_material,
                'metraje_limite_gratis': m.metraje_limite_gratis or 0,
                'precio_exceso_metro': float(m.precio_exceso_metro or 0),
                'precio_venta_equipo': float(m.precio_venta_equipo or 0),
            }
            for m in MaterialesConfiguracion.objects.all().order_by('nombre_material')
        ]

        # Obtener cajas de esta sede
        cajas_qs = Cajas.objects.filter(sede=sede, activo=True).order_by('nombre')
        cajas = []
        for c in cajas_qs:
            cajas.append({
                'id': c.id,
                'nombre': c.nombre,
                'tipo_ubicacion': c.tipo_ubicacion,
                'recaudo': c.configuracion_recaudo
            })

        return JsonResponse({
            'status': 'success',
            'datos_sede': datos_sede,
            'contrato': datos_contrato,
            'rucs': rucs,
            'todos_rucs': todos_rucs,
            'planes': planes,
            'personal': personal,
            'personal_disponible': personal_disponible,
            'tickets': tickets,
            'catalogo_tickets': catalogo_tickets,
            'sugerencias_catalogo': sugerencias_catalogo,
            'materiales': materiales,
            'sectores': list(Sectores.objects.all().values('id', 'nombre', 'prefijo_comercial')),
            'cajas': cajas
        })

    except Sedes.DoesNotExist:
        return senderror('Sede no encontrada', status=404)
    except Exception as e:
        return senderror(str(e), status=500)
