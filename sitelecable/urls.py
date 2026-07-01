from django.urls import path
from django.conf import settings
from django.conf.urls.static import static

# Import standard dashboard views
from core.dashboard import (
    dashboard, organizacion, guardar, actualizar, eliminar, descargar, exportar, importar, sectorvertices, fibravertices
)

# Import auth views
from core.auth import login, logout, apilogin, apichecksession, verificar

# Import sede views
from core.sede import (
    config, datos, ruc as sede_ruc_save, desvincularruc, contrato as sede_contrato_save,
    plan, eliminarplan, plandinamico, personal, vincularpersonal, eliminarpersonal,
    habilidades, material, eliminarmaterial, catalogoticket, eliminarcatalogoticket,
    imprimir as print_ticket_sede,
    cajasave as sede_caja_save, cajaeliminar as sede_caja_delete, cajavincular as sede_caja_vincular
)
from core.sede.catalogoticket import catalogoticket_enums

# Import ruc views
from core.ruc import (
    listar as ruc_listar, detalle as ruc_detalle, contrato as ruc_contrato,
    contratover as ruc_contratover, comprobante as ruc_comprobante, convertir as ruc_convertir,
    comprobantepreview as ruc_comprobantepreview, vincular as ruc_vincular,
    desvincular as ruc_desvincular, disponibles as ruc_disponibles
)

# Import abonados views
from core.abonados import (
    listar as abonados_listar, ficha as abonados_ficha, contexto as abonados_contexto,
    consultardocumento, consultarsuministro, registrar as abonados_registrar, evaluar,
    subirdocumento, generardeuda, editardeuda, eliminardeuda, compromisopago,
    actualizarcliente, actualizarservicio, infraestructurared, registrarmultipago,
    procesarfacturacion, registrarpago, consultardni, consultarruc, buscardocumento,
    ticketsliquidados,
    buscartelecable, detalletelecable, deudastelecable, aprobaroferta, obteneroferta,
    financiardeuda, materialesdisponibles, gestionaranexo
)

# Import tickets views
from core.tickets import (
    generarticket, liquidarticket, derivarticket, imprimir as print_ticket_cliente,
    generarticketmasivo, filtrarcatalogo, opcionescatalogo, generarmanual, activarfuncion,
    actualizarestadofuncion, completarfuncion, cambioequipo, migracionplan,
    ejecutarmigracionplan, instalacion, cobramateriales, editarmapa, mantieneequipo,
    nuevosuministro, ejecutarnuevosuministro, generamerma, obtenerfunciones
)

# Import tareas views
from core.tareas import (
    listar as tareas_listar, autogenerar as tareas_autogenerar,
    repartir as tareas_repartir, contacto as tareas_contacto
)

# Import sunat views
from core.sunat import dashboard as sunat_dashboard, listar as sunat_listar, enviar as sunat_enviar

# Import calendario views
from core.calendario import calendario, eventos, reprogramar, sinprogramar

# Import caja views
from core.caja import (
    caja, resumen as caja_resumen, movimientos as caja_movimientos,
    registrar as caja_registrar, permiso as caja_permiso, turnocaja, abrirturnocaja
)

# Import materiales views
from core.materiales import (
    listar as mat_listar, detalle as mat_detalle, crear as mat_crear,
    actualizar as mat_actualizar, eliminar as mat_eliminar, portipo as mat_portipo,
    pagina as mat_pagina
)

urlpatterns = [
    path('dashboard/', dashboard.dashboard, name='dashboard'),
    path('login/', login.login, name='login'),
    path('logout/', logout.logout, name='logout'),
    path('organizacion/', organizacion.organizacion, name='organizacion'),
    path('api/login/', apilogin.apilogin, name='api_login'),
    path('api/movil/verificar-codigo/', verificar.verificar, name='api_movil_verificar_codigo'),
    path('api/check-session/', apichecksession.apichecksession, name='api_check_session'),

    path('api/organizacion/guardar/', guardar.guardar, name='api_organizacion_guardar'),
    path('api/organizacion/actualizar/', actualizar.actualizar, name='api_organizacion_actualizar'),
    path('api/organizacion/eliminar/', eliminar.eliminar, name='api_organizacion_eliminar'),
    path('api/organizacion/importar-excel/', importar.importar, name='api_organizacion_importar_excel'),
    path('api/organizacion/descargar-modelo/', descargar.descargar, name='api_organizacion_descargar_modelo'),
    path('api/organizacion/exportar-excel/', exportar.exportar, name='api_organizacion_exportar_excel'),
    path('api/organizacion/vertices-sector/', sectorvertices.sectorvertices, name='api_organizacion_vertices_sector'),
    path('api/organizacion/vertices-fibra/', fibravertices.fibravertices, name='api_organizacion_vertices_fibra'),

    # Sede Master Configuration Dashboard
    path('api/sede/config/', config.config, name='api_sede_config_get'),
    path('api/sede/config/datos/', datos.datos, name='api_sede_config_save_datos'),
    path('api/sede/config/ruc/', sede_ruc_save.ruc, name='api_sede_config_save_ruc'),
    path('api/sede/config/ruc/desvincular/', desvincularruc.desvincularruc, name='api_sede_config_delete_ruc'),
    path('api/sede/config/contrato/', sede_contrato_save.contrato, name='api_sede_config_save_contrato'),
    path('api/sede/config/plan/', plan.plan, name='api_sede_config_save_plan'),
    path('api/sede/config/plan/eliminar/', eliminarplan.eliminarplan, name='api_sede_config_delete_plan'),
    path('api/sede/config/plan/dinamico/', plandinamico.plandinamico, name='api_sede_config_plan_dinamico'),
    path('api/sede/config/personal/', personal.personal, name='api_sede_config_save_personal'),
    path('api/sede/config/personal/vincular/', vincularpersonal.vincularpersonal, name='api_sede_config_vincular_personal'),
    path('api/sede/config/personal/eliminar/', eliminarpersonal.eliminarpersonal, name='api_sede_config_delete_personal'),
    path('api/sede/config/habilidades/', habilidades.habilidades, name='api_sede_config_save_habilidades'),
    path('api/sede/config/material/', material.material, name='api_sede_config_save_material'),
    path('api/sede/config/material/eliminar/', eliminarmaterial.eliminarmaterial, name='api_sede_config_delete_material'),
    path('api/sede/config/catalogo-ticket/', catalogoticket.catalogoticket, name='api_sede_config_save_catalogo_ticket'),
    path('api/sede/config/catalogo-ticket/enums/', catalogoticket_enums, name='api_sede_config_catalogo_ticket_enums'),
    path('api/sede/config/catalogo-ticket/eliminar/', eliminarcatalogoticket.eliminarcatalogoticket, name='api_sede_config_delete_catalogo_ticket'),
    path('api/sede/ticket/print/', print_ticket_sede.imprimir, name='api_sede_ticket_print'),
    path('api/sede/config/caja/', sede_caja_save.cajasave, name='api_sede_config_save_caja'),
    path('api/sede/config/caja/eliminar/', sede_caja_delete.cajaeliminar, name='api_sede_config_delete_caja'),
    path('api/sede/config/caja/personal/', sede_caja_vincular.cajavincular, name='api_sede_config_vincular_caja'),

    # RUCs por sede
    path('api/sede/rucs/', ruc_listar.listar, name='api_sede_rucs_list'),
    path('api/sede/rucs/<int:ruc_id>/', ruc_detalle.detalle, name='api_sede_rucs_detail'),
    path('api/sede/rucs/<int:ruc_id>/contrato/', ruc_contrato.contrato, name='api_sede_rucs_contrato'),
    path('api/sede/rucs/<int:ruc_id>/contrato/ver/', ruc_contratover.contratover, name='api_sede_rucs_contrato_view'),
    path('api/sede/rucs/<int:ruc_id>/comprobante/<int:comprobante_id>/ver/', ruc_comprobante.comprobante, name='api_sede_rucs_comprobante_view'),
    path('api/sede/rucs/<int:ruc_id>/nota-venta/<int:nota_venta_id>/convertir/', ruc_convertir.convertir, name='api_sede_rucs_nota_venta_convertir'),
    path('api/sede/rucs/<int:ruc_id>/comprobante/vista-previa/', ruc_comprobantepreview.comprobantepreview, name='api_sede_rucs_comprobante_preview_muestra'),
    path('api/sede/rucs/<int:ruc_id>/comprobante/<int:comprobante_id>/vista-previa/', ruc_comprobantepreview.comprobantepreview, name='api_sede_rucs_comprobante_preview'),
    path('api/sede/rucs/<int:ruc_id>/vincular/', ruc_vincular.vincular, name='api_sede_rucs_vincular'),
    path('api/sede/rucs/<int:ruc_id>/desvincular/', ruc_desvincular.desvincular, name='api_sede_rucs_desvincular'),
    path('api/sede/rucs/disponibles/', ruc_disponibles.disponibles, name='api_sede_rucs_disponibles'),

    # Abonados
    path('abonados/', abonados_listar.listar, name='abonados_list'),
    path('abonados/<str:cliente_id>/', abonados_ficha.ficha, name='abonado_ficha'),
    path('api/abonados/contexto/', abonados_contexto.contexto, name='api_abonados_contexto'),
    path('api/abonados/consultar-documento/', consultardocumento.consultardocumento, name='api_abonados_consultar_documento'),
    path('api/abonados/consultar-suministro/', consultarsuministro.consultarsuministro, name='api_abonados_consultar_suministro'),
    path('api/abonados/registrar/', abonados_registrar.registrar, name='api_abonados_registrar'),
    path('api/abonados/evaluar/', evaluar.evaluar, name='api_abonados_evaluar_registro'),
    path('api/abonados/subir-documento/', subirdocumento.subirdocumento, name='api_abonados_subir_documento'),
    path('api/abonados/generar-deuda/', generardeuda.generardeuda, name='api_abonados_generar_deuda'),
    path('api/abonados/editar-deuda/', editardeuda.editardeuda, name='api_abonados_editar_deuda'),
    path('api/abonados/eliminar-deuda/', eliminardeuda.eliminardeuda, name='api_abonados_eliminar_deuda'),
    path('api/abonados/compromiso-pago/', compromisopago.compromisopago, name='api_abonados_compromiso_pago'),
    path('api/abonados/generar-ticket/', generarticket.generarticket, name='api_abonados_generar_ticket'),
    path('api/abonados/infraestructura-red/', infraestructurared.infraestructurared, name='api_abonados_infraestructura_red'),
    path('api/abonados/registrar-multipago/', registrarmultipago.registrarmultipago, name='api_abonados_registrar_multipago'),
    path('api/abonados/sistema-procesar-facturacion-mensual/', procesarfacturacion.procesarfacturacion, name='api_abonados_sistema_procesar_facturacion_mensual'),
    path('api/abonados/generar-ticket-masivo/', generarticketmasivo.generarticketmasivo, name='api_abonados_generar_ticket_masivo'),
    path('api/abonados/turno-caja/', turnocaja.turnocaja, name='api_abonados_turno_caja'),
    path('api/abonados/turno-caja/abrir/', abrirturnocaja.abrirturnocaja, name='api_abonados_turno_caja_abrir'),
    path('api/abonados/registrar-pago/', registrarpago.registrarpago, name='api_abonados_registrar_pago'),
    path('api/abonados/liquidar-ticket/', liquidarticket.liquidarticket, name='api_abonados_liquidar_ticket'),
    path('api/abonados/actualizar-cliente/', actualizarcliente.actualizarcliente, name='api_abonados_actualizar_cliente'),
    path('api/abonados/actualizar-servicio/', actualizarservicio.actualizarservicio, name='api_abonados_actualizar_servicio'),
    path('api/abonados/aprobar-oferta/', aprobaroferta.aprobar_oferta, name='api_abonados_aprobar_oferta'),
    path('api/abonados/obtener-oferta/', obteneroferta.obtener_oferta, name='api_abonados_obtener_oferta'),
    path('api/abonados/derivar-ticket/', derivarticket.derivarticket, name='api_abonados_derivar_ticket'),
    path('api/abonados/servicio/<str:servicio_id>/tickets-liquidados/', ticketsliquidados.tickets_liquidados, name='api_abonados_servicio_tickets_liquidados'),
    path('api/cliente/ticket/print/', print_ticket_cliente.imprimir, name='api_cliente_ticket_print'),
    path('api/abonados/financiar-deuda/', financiardeuda.financiardeuda, name='api_abonados_financiar_deuda'),
    path('api/abonados/materiales-disponibles/', materialesdisponibles.materialesdisponibles, name='api_abonados_materiales_disponibles'),
    path('api/abonados/gestionar-anexo/', gestionaranexo.gestionaranexo, name='api_abonados_gestionar_anexo'),

    # Tareas de Llamadas
    path('tareas/', tareas_listar.listar, name='tareas_list'),
    path('api/tareas/auto-generar/', tareas_autogenerar.autogenerar, name='api_tareas_auto_generar'),
    path('api/tareas/listar/', tareas_autogenerar.autogenerar, name='api_tareas_listar'),
    path('api/tareas/repartir/', tareas_repartir.repartir, name='api_tareas_repartir'),
    path('api/tareas/registrar-contacto/', tareas_contacto.contacto, name='api_tareas_registrar_contacto'),

    # SUNAT Facturación Electrónica
    path('sunat/', sunat_dashboard.dashboard, name='sunat_dashboard'),
    path('api/sunat/listar/', sunat_listar.listar, name='api_sunat_listar_comprobantes'),
    path('api/sunat/enviar/', sunat_enviar.enviar, name='api_sunat_enviar_comprobante'),

    # Calendario Interactivo
    path('calendario/', calendario.calendario, name='calendario'),
    path('api/calendario/eventos/', eventos.eventos, name='api_calendario_eventos'),
    path('api/calendario/reprogramar/', reprogramar.reprogramar, name='api_calendario_reprogramar_ticket'),
    path('api/calendario/sin-programar/', sinprogramar.sinprogramar, name='api_calendario_tickets_sin_programar'),

    # Caja Diaria y Permisos
    path('caja/', caja.caja, name='caja'),
    path('api/caja/resumen/', caja_resumen.resumen, name='api_caja_resumen'),
    path('api/caja/movimientos/', caja_movimientos.movimientos, name='api_caja_movimientos'),
    path('api/caja/registrar/', caja_registrar.registrar, name='api_caja_registrar'),
    path('api/caja/toggle-permiso/', caja_permiso.permiso, name='api_caja_toggle_permiso'),

    # APIs externas (DNI/RUC/Suministro/Telecable)
    path('api/empresa/consultar-dni/', consultardni.consultardni, name='api_empresa_consultar_dni'),
    path('api/empresa/consultar-ruc/', consultarruc.consultarruc, name='api_empresa_consultar_ruc'),
    path('api/empresa/buscar-documento/', buscardocumento.buscardocumento, name='api_empresa_buscar_documento'),
    path('api/suministro/consultar-externo/', consultarsuministro.consultarsuministro, name='api_suministro_consultar_externo'),
    path('api/net/buscar-abonado/', buscartelecable.buscartelecable, name='api_net_buscar_abonado'),
    path('api/net/detalle-abonado/', detalletelecable.detalletelecable, name='api_net_detalle_abonado'),
    path('api/net/deudas-abonado/', deudastelecable.deudastelecable, name='api_net_deudas_abonado'),
    path('api/net/catalogo-tickets/', filtrarcatalogo.filtrarcatalogo, name='api_catalogo_tickets_filtrar'),
    path('api/net/catalogo-tickets-opciones/', opcionescatalogo.opcionescatalogo, name='api_catalogo_tickets_opciones'),
    path('api/net/generar-ticket/', generarmanual.generarmanual, name='api_generar_ticket_manual'),

    # Materiales y Equipos
    path('materiales/', mat_pagina.pagina, name='materiales'),
    path('api/materiales/listar/', mat_listar.listar, name='api_materiales_listar'),
    path('api/materiales/detalle/', mat_detalle.detalle, name='api_materiales_detalle'),
    path('api/materiales/crear/', mat_crear.crear, name='api_materiales_crear'),
    path('api/materiales/actualizar/', mat_actualizar.actualizar, name='api_materiales_actualizar'),
    path('api/materiales/eliminar/', mat_eliminar.eliminar, name='api_materiales_eliminar'),
    path('api/materiales/por-tipo/', mat_portipo.portipo, name='api_materiales_por_tipo'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
