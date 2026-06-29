from core.models.models_generados import (
    Usuario, Planes, Sedes, Ruc, RucSedes,
)
from core.sede.sedeutils import strip_sede_prefijo

CARGOS_VENDEDOR = {'ADMIN', 'ATC', 'TAC', 'SUPERVISOR_ATC', 'JEFE_TAC'}


def sistema_obtener_contexto_vendedor(username):
    """Contexto de sede y habilidades del usuario autenticado."""
    contexto = {
        'personal_id': None,
        'personal_nombre': '',
        'cargo': '',
        'sede_id': None,
        'sede_nombre': '',
        'es_admin': False,
        'habilidades': None,
    }
    if not username:
        return contexto

    try:
        # Apunta al modelo de identidad único unificado (Usuario)
        usuario = Usuario.objects.get(username=username)
    except Usuario.DoesNotExist:
        return contexto

    contexto['personal_id'] = usuario.id
    contexto['personal_nombre'] = usuario.nombre_apellidos
    contexto['cargo'] = (usuario.rol or '').upper()
    contexto['es_admin'] = (usuario.rol or '').lower() in ('admin', 'tac', 'noc')
    
    sede = usuario.sede
    if sede:
        contexto['sede_id'] = sede.id
        contexto['sede_nombre'] = strip_sede_prefijo(sede.nombre)
    else:
        # Fallback a la primera sede si el usuario no tiene ninguna asignada físicamente
        default_sede = Sedes.objects.order_by('id').first()
        if default_sede:
            contexto['sede_id'] = default_sede.id
            contexto['sede_nombre'] = strip_sede_prefijo(default_sede.nombre)

    # Lectura simplificada de permisos comerciales directos desde habilidades_json (Regla C3)
    habilidades_json = usuario.habilidades_json or {}
    if habilidades_json:
        hg = habilidades_json.get('habilidades_globales', {})
        tickets_cobro = hg.get('tickets_cobro', {})
        deudas_antiguas = hg.get('deudas_antiguas', {})
        planes_mensuales = hg.get('planes_mensuales', {})
        
        contexto['habilidades'] = {
            'tickets_cobro': {
                'descuento_maximo_porcentaje': tickets_cobro.get('descuento_maximo_porcentaje', 0),
                'cuotas_maximas': tickets_cobro.get('cuotas_maximas', 0)
            },
            'deudas_antiguas': {
                'descuento_maximo_porcentaje': deudas_antiguas.get('descuento_maximo_porcentaje', 0),
                'cuotas_maximas': deudas_antiguas.get('cuotas_maximas', 0)
            },
            'planes_mensuales': {
                'descuento_maximo_porcentaje': planes_mensuales.get('descuento_maximo_porcentaje', 100),
                'meses_maximos': planes_mensuales.get('meses_maximos', 0),
                'requiere_autorizacion_supervisor': planes_mensuales.get('requiere_autorizacion_supervisor', False)
            }
        }
    return contexto


def sistema_planes_por_sede(sede_id):
    planes = Planes.objects.filter(sede_id=sede_id).order_by('tipo_servicio', 'nombre')
    return [
        {
            'id': p.id,
            'nombre_plan': p.nombre,
            'tipo_servicio': p.tipo_servicio.upper() if p.tipo_servicio else '',
            'tipo_cliente': p.tipo_cliente.upper() if p.tipo_cliente else '',
            'costo_plan': float(p.costo_mensual),
            'velocidad_mbps': (p.caracteristicas_tecnicas_json or {}).get('caracteristicas_base', {}).get('velocidad_mbps', 0) or (p.velocidad_mbps or 0),
            'configuracion_fecha_pago': 'FECHA_INSTALACION' if (p.dia_vencimiento or '').lower() == 'fecha_instalacion' else 'FIN_DE_MES',
        }
        for p in planes
    ]


def sistema_sedes_disponibles(es_admin, sede_id_usuario):
    qs = Sedes.objects.all().order_by('nombre')
    if not es_admin and sede_id_usuario:
        qs = qs.filter(id=sede_id_usuario)
    return [
        {
            'id': s.id,
            'nombre': strip_sede_prefijo(s.nombre),
            'sector_prefijo': s.sector.prefijo_comercial if s.sector_id else '',
        }
        for s in qs
    ]


def sistema_vendedores_por_sede(sede_id):
    valid_db_roles = {'tac', 'noc', 'atc', 'ventas', 'tec'}
    cargos_lower = [c.lower() for c in CARGOS_VENDEDOR if c.lower() in valid_db_roles]
    
    # Obtenemos los IDs de los usuarios asignados a esta sede
    user_ids = Usuario.objects.filter(sede_id=sede_id).values_list('id', flat=True)
    
    # Filtramos el universo unificado de personal (Usuario) en minúsculas
    qs = Usuario.objects.filter(
        id__in=user_ids,
        rol__in=cargos_lower
    ).order_by('nombre_completo')
    
    return [
        {
            'id': p.id,
            'nombre': p.nombre_completo,
            'cargo': (p.rol or '').upper()
        }
        for p in qs
    ]


def sistema_rucs_emision_sede(sede_id):
    """Retorna los RUCs disponibles para emisión de comprobantes en una sede."""
    if not sede_id:
        return []
    sede_rucs = RucSedes.objects.filter(sede_id=sede_id).select_related('ruc')
    return [
        {
            'id': sr.ruc_id,
            'numero_ruc': sr.ruc.ruc_numero,
            'razon_social': sr.ruc.razon_social,
        }
        for sr in sede_rucs if sr.ruc.activo
    ]