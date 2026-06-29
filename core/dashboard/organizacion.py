import json
from django.shortcuts import render, redirect

from core.models.models_generados import (
    Sedes, Hubs, CajasNap, Mufas, Sectores, FibrasOpticas, ServiciosAbonados
)
from core.auth.comun import checksession
from core.sede.sedeutils import strip_sede_prefijo
from core.abonados.generador import obtener_codigo_cliente_actualizado, obtener_codigo_servicio_actualizado

def organizacion(request):
    """
    Módulo de Organización: mapa interactivo de la planta de red.
    Serializa todos los elementos geográficos de la red para el mapa Leaflet.
    """
    if not checksession(request):
        return redirect('/login/')

    username = request.session.get('username')

    # ─── Serializar Sedes ────────────────────────────────────────────────
    sedes_qs = Sedes.objects.all()
    sedes_json = json.dumps([
        {
            'id':          s.id,
            'nombre':      strip_sede_prefijo(s.nombre),
            'descripcion': s.descripcion or '',
            'latitud':     float(s.latitud) if s.latitud is not None else 0.0,
            'longitud':    float(s.longitud) if s.longitud is not None else 0.0,
            'sector_prefijo': s.sector.prefijo_comercial if s.sector else '',
        }
        for s in sedes_qs
    ])

    # ─── Serializar Hubs ─────────────────────────────────────────────────
    hubs_qs = Hubs.objects.all()
    hubs_json = json.dumps([
        {
            'id':       h.id,
            'codigo':   h.nombre,
            'latitud':  float(h.latitud) if h.latitud is not None else 0.0,
            'longitud': float(h.longitud) if h.longitud is not None else 0.0,
        }
        for h in hubs_qs
    ])

    # ─── Serializar NAPs ─────────────────────────────────────────────────
    naps_qs = CajasNap.objects.all()
    naps_json = json.dumps([
        {
            'id':              n.id,
            'codigo':          n.codigo_identificador,
            'latitud':         float(n.latitud) if n.latitud is not None else 0.0,
            'longitud':        float(n.longitud) if n.longitud is not None else 0.0,
            'cantidad_puertos': n.cantidad_puertos,
        }
        for n in naps_qs
    ])

    # ─── Serializar Mufas ────────────────────────────────────────────────
    mufas_qs = Mufas.objects.all()
    mufas_json = json.dumps([
        {
            'id':              m.id,
            'codigo':         m.codigo_identificador,
            'latitud':        float(m.latitud) if m.latitud is not None else 0.0,
            'longitud':       float(m.longitud) if m.longitud is not None else 0.0,
            'capacidad_hilos': m.capacidad_hilos,
        }
        for m in mufas_qs
    ])

    # ─── Serializar Sectores ─────────────────────────────────────────────
    sectores_qs = Sectores.objects.all()
    sectores_json = json.dumps([
        {
            'id':             s.id,
            'codigo':          s.nombre,
            'prefijo':         s.prefijo_comercial,
            'latitud_centro':  float(s.latitud_centro) if s.latitud_centro is not None else 0.0,
            'longitud_centro': float(s.longitud_centro) if s.longitud_centro is not None else 0.0,
            'coordenadas':     s.coordenadas or '',
        }
        for s in sectores_qs
    ])

    # ─── Serializar Fibras ───────────────────────────────────────────────
    fibras_qs = FibrasOpticas.objects.all()
    fibras_json = json.dumps([
        {
            'id':               f.id,
            'codigo':           f.codigo_identificador,
            'lat_inicio':       float(f.latitud_inicio) if f.latitud_inicio is not None else 0.0,
            'lng_inicio':       float(f.longitud_inicio) if f.longitud_inicio is not None else 0.0,
            'lat_fin':          float(f.latitud_fin) if f.latitud_fin is not None else 0.0,
            'lng_fin':          float(f.longitud_fin) if f.longitud_fin is not None else 0.0,
            'coordenadas_ruta': f.coordenadas_ruta or '',
            'hub_id':           f.hub_id,
            'capacidad':        f.capacidad_total,
        }
        for f in fibras_qs
    ])

    # ─── Serializar Clientes (ServiciosAbonados) ─────────────────────────
    clientes_qs = ServiciosAbonados.objects.select_related('cliente', 'caja_nap__sector').filter(
        latitud__isnull=False, 
        longitud__isnull=False
    ).exclude(estado_servicio='baja')
    clientes_json = json.dumps([
        {
            'id':               s.id,
            'cliente_id':       s.cliente.id,
            'cliente_nombre':   s.cliente.nombre_apellidos or s.cliente.razon_social or '—',
            'cliente_dni':      s.cliente.dni or '—',
            'codigo_cliente':   obtener_codigo_cliente_actualizado(s.cliente),
            'codigo_servicio': obtener_codigo_servicio_actualizado(s),
            'latitud':          float(s.latitud) if s.latitud is not None else 0.0,
            'longitud':         float(s.longitud) if s.longitud is not None else 0.0,
            'direccion':        s.direccion_servicio or '—',
            'sector_nombre':    s.caja_nap.sector.nombre if s.caja_nap and s.caja_nap.sector else '—',
            'sector_prefijo':   s.caja_nap.sector.prefijo_comercial if s.caja_nap and s.caja_nap.sector else '',
        }
        for s in clientes_qs
    ])

    context = {
        'username':      username,
        'sedes_json':    sedes_json,
        'hubs_json':     hubs_json,
        'naps_json':     naps_json,
        'mufas_json':    mufas_json,
        'sectores_json': sectores_json,
        'fibras_json':   fibras_json,
        'clientes_json': clientes_json,
    }
    return render(request, 'organizacion/organizacion.html', context)
