import json
from django.shortcuts import render, get_object_or_404, redirect
from core.models.models_generados import Abonados
from core.abonados.contextovendedor import sistema_obtener_contexto_vendedor
from core.abonados.lista import sistema_calcular_estado_comercial
from core.abonados.fichadetalle import sistema_detalle_ficha_cliente
from core.caja.turnos import sistema_estado_turno_vendedor
from core.auth.comun import checksession

def ficha(request, cliente_id):
    """Renderiza la ficha de un abonado."""
    username = request.session.get('username')
    if not username:
        return redirect('/login/')

    from core.abonados.geoutils import parse_cliente_id
    parsed_id = parse_cliente_id(cliente_id)

    cliente = get_object_or_404(
        Abonados.objects.prefetch_related(
            'suscripciones__plan__sede',
        ),
        pk=parsed_id,
    )
    suscripciones = list(cliente.suscripciones.all())
    ctx_vendedor = sistema_obtener_contexto_vendedor(username)
    
    from core.models.usuarios import Usuario
    personal_list = list(
        Usuario.objects.filter(
            activo=True,
            rol__in=['tec', 'noc']
        ).values('id', 'nombre_completo', 'rol')
    )
    
    ficha_extra = sistema_detalle_ficha_cliente(cliente, suscripciones, ctx_vendedor.get('cargo', ''))
    turno_estado = sistema_estado_turno_vendedor(
        ctx_vendedor.get('personal_id'),
        ctx_vendedor.get('sede_id'),
    )
    
    suscripcion_filtro = request.GET.get('suscripcion', '')
    if suscripcion_filtro.isdigit():
        suscripcion_filtro = int(suscripcion_filtro)
        
    context = {
        'username': username,
        'nombre_usuario': request.session.get('nombre', 'Usuario'),
        'cliente': cliente,
        'suscripciones': suscripciones,
        'personal_list': personal_list,
        'estado_comercial': sistema_calcular_estado_comercial(cliente),
        'deudas': ficha_extra['deudas_globales'],
        'comprobantes': ficha_extra['comprobantes'],
        'suscripciones_detalles': ficha_extra['suscripciones_detalles'],
        'documento_facturacion': ficha_extra['documento_facturacion'],
        'tipo_documento': ficha_extra['tipo_documento'],
        'tab_activo': request.GET.get('tab', 'datos'),
        'suscripcion_filtro': suscripcion_filtro,
        'ctx_vendedor_json': json.dumps(ctx_vendedor),
        'permisos': ficha_extra['permisos'],
        'client_data_json': ficha_extra['client_data_json'],
        'turno_caja': turno_estado,
    }
    return render(request, 'cliente/ficha.html', context)
