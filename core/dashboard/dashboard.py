import json
from django.shortcuts import render, redirect
from django.db.models import Count
from django.utils import timezone
from datetime import timedelta

from core.models.models_generados import (
    Personal, Clientes, CajasNap, Sectores, Suscripciones, 
    TicketsOrdenes, Usuario, Sedes, Hubs, Mufas, FibrasOpticas
)
from core.auth.comun import checksession
from core.sede.sedeutils import strip_sede_prefijo

def dashboard(request):
    """
    Muestra el panel de control principal. Todos los datos provienen
    exclusivamente de la base de datos. Sin datos hardcodeados ni emulados.
    """
    if not checksession(request):
        return redirect('/login/')

    username = request.session.get('username')

    try:
        from core.tickets.automation import verificar_plazos_cortes_temporales
        verificar_plazos_cortes_temporales()
    except Exception:
        pass

    # ─── KPIs básicos ───────────────────────────────────────────────────────
    try:
        total_personal = Personal.objects.count()
    except Exception:
        total_personal = 0

    try:
        total_clientes = Clientes.objects.count()
    except Exception:
        total_clientes = 0

    try:
        total_naps = CajasNap.objects.count()
    except Exception:
        total_naps = 0

    try:
        total_sectores = Sectores.objects.count()
    except Exception:
        total_sectores = 0

    try:
        total_suscripciones_activas = Suscripciones.objects.filter(estado_servicio='activo').count()
    except Exception:
        total_suscripciones_activas = 0

    try:
        total_deudas_pendientes = Suscripciones.objects.filter(deuda_acumulada__gt=0).count()
    except Exception:
        total_deudas_pendientes = 0

    # ─── Tickets recientes ──────────────────────────────────────────────────
    try:
        recent_tickets = list(
            TicketsOrdenes.objects.order_by('-id')[:10]
        )
    except Exception:
        recent_tickets = []

    # ─── Estadísticas de SLA, sedes y contadores ────────────────────────────
    now = timezone.now()
    atendido_24h = 0
    atendido_48h = 0
    excedido = 0
    total_completados = 0
    reprogramado_count = 0
    anulado_count = 0
    total_tickets = 0
    sede_tickets_stats = {}

    try:
        for name in Sedes.objects.values_list('nombre', flat=True):
            sede_tickets_stats[name] = {'total': 0, 'completados': 0}
        sede_tickets_stats['Sin Sede'] = {'total': 0, 'completados': 0}

        tickets_qs = TicketsOrdenes.objects.all().select_related('servicio__caja_nap__sector__sede')
        total_tickets = tickets_qs.count()

        for t in tickets_qs.iterator():
            try:
                cfg = t.configuracion_reglas
                if cfg and isinstance(cfg, dict) and cfg.get('reprogramado_count', 0) > 0:
                    reprogramado_count += 1
            except Exception:
                pass

            if t.estado == 'cancelado':
                anulado_count += 1

            sede_name = 'Sin Sede'
            try:
                if (t.servicio_id and t.servicio and
                        t.servicio.caja_nap and
                        t.servicio.caja_nap.sector and
                        t.servicio.caja_nap.sector.sede):
                    sede_name = t.servicio.caja_nap.sector.sede.nombre
            except Exception:
                pass

            if sede_name not in sede_tickets_stats:
                sede_tickets_stats[sede_name] = {'total': 0, 'completados': 0}
            sede_tickets_stats[sede_name]['total'] += 1

            if t.estado == 'completado':
                total_completados += 1
                sede_tickets_stats[sede_name]['completados'] += 1
                try:
                    dur = (t.fecha_completado or now) - (t.fecha_creacion or now)
                    if dur <= timedelta(hours=24):
                        atendido_24h += 1
                    elif dur <= timedelta(hours=48):
                        atendido_48h += 1
                    else:
                        excedido += 1
                except Exception:
                    excedido += 1
    except Exception:
        pass

    pct_sla_optimo = round(((atendido_24h + atendido_48h) / total_completados) * 100, 1) if total_completados > 0 else 0.0
    pct_reprogramadas = round((reprogramado_count / total_tickets) * 100, 1) if total_tickets > 0 else 0.0
    pct_anuladas = round((anulado_count / total_tickets) * 100, 1) if total_tickets > 0 else 0.0

    atencion_stats_json = json.dumps([
        {'label': 'Menos de 24h', 'count': atendido_24h},
        {'label': 'Entre 24h y 48h', 'count': atendido_48h},
        {'label': 'Excedido (>48h)', 'count': excedido},
    ])

    sede_atencion_list = [
        {'name': n, 'total': s['total'], 'completados': s['completados'],
         'pct': round((s['completados'] / s['total']) * 100, 1)}
        for n, s in sede_tickets_stats.items() if s['total'] > 0
    ]
    sede_atencion_json = json.dumps(sede_atencion_list)

    # ─── Rendimiento por técnico ─────────────────────────────────────────────
    tecnico_performances = []
    try:
        tecnicos_map = {u.id: u.nombre_completo for u in Usuario.objects.filter(rol='tec')}
        tec_counts = {}
        for tid in TicketsOrdenes.objects.filter(estado='completado').values_list('tecnico_asignado_id', flat=True):
            label = tecnicos_map.get(tid, 'Sin Asignar' if tid is None else f'Técnico #{tid}')
            tec_counts[label] = tec_counts.get(label, 0) + 1
        tecnico_performances = [{'name': k, 'count': v} for k, v in tec_counts.items()]
    except Exception:
        pass
    if not tecnico_performances:
        tecnico_performances = [{'name': 'Sin datos', 'count': 0}]
    tecnico_stats_json = json.dumps(tecnico_performances)

    # ─── Categorías, prioridades, estados ───────────────────────────────────
    try:
        category_stats = list(TicketsOrdenes.objects.values('categoria').annotate(count=Count('id')))
    except Exception:
        category_stats = []

    try:
        priority_stats = list(TicketsOrdenes.objects.values('prioridad').annotate(count=Count('id')))
    except Exception:
        priority_stats = []

    try:
        status_stats = list(TicketsOrdenes.objects.values('estado').annotate(count=Count('id')))
    except Exception:
        status_stats = []

    # ─── Distribución categorías por sede ───────────────────────────────────
    sede_category_json = json.dumps({'categories': [], 'series': []})
    try:
        all_cats = list(TicketsOrdenes.objects.values_list('categoria', flat=True).distinct())
        if all_cats:
            sedes_activas = [n for n, s in sede_tickets_stats.items() if s['total'] > 0]
            cat_counts = {s: {c: 0 for c in all_cats} for s in sedes_activas}
            for t in TicketsOrdenes.objects.select_related('servicio__caja_nap__sector__sede').iterator():
                sn = 'Sin Sede'
                try:
                    if (t.servicio_id and t.servicio and
                            t.servicio.caja_nap and
                            t.servicio.caja_nap.sector and
                            t.servicio.caja_nap.sector.sede):
                        sn = t.servicio.caja_nap.sector.sede.nombre
                except Exception:
                    pass
                if sn in cat_counts and t.categoria in cat_counts[sn]:
                    cat_counts[sn][t.categoria] += 1
            series = [
                {'name': s, 'data': [cat_counts[s].get(c, 0) for c in all_cats]}
                for s in sedes_activas if sum(cat_counts[s].values()) > 0
            ]
            sede_category_json = json.dumps({
                'categories': [c.upper() for c in all_cats],
                'series': series,
            })
    except Exception:
        pass

    context = {
        'username': username,
        'nombre_usuario': request.session.get('nombre', ''),
        'total_personal': total_personal,
        'total_clientes': total_clientes,
        'total_naps': total_naps,
        'total_sectores': total_sectores,
        'total_suscripciones_activas': total_suscripciones_activas,
        'total_deudas_pendientes': total_deudas_pendientes,
        'recent_tickets': recent_tickets,
        'category_stats_json': json.dumps(category_stats),
        'atencion_stats_json': atencion_stats_json,
        'tecnico_stats_json': tecnico_stats_json,
        'priority_stats_json': json.dumps(priority_stats),
        'status_stats_json': json.dumps(status_stats),
        'pct_sla_optimo': pct_sla_optimo,
        'pct_reprogramadas': pct_reprogramadas,
        'pct_anuladas': pct_anuladas,
        'sede_atencion_json': sede_atencion_json,
        'sede_category_json': sede_category_json,
    }
    return render(request, 'dashboard/dashboard.html', context)
