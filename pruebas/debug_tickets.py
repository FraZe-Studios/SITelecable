#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sitelecable.settings')
django.setup()

from core.models.compat import CatalogoTickets

print("=== DEBUG DE TICKETS ===")
print(f"\nTotal tickets activos: {CatalogoTickets.objects.filter(activo=True).count()}")

print("\n--- Tickets con categoria='instalacion' ---")
inst_tickets = CatalogoTickets.objects.filter(categoria='instalacion', activo=True)
for t in inst_tickets:
    print(f"  - {t.nombre_ticket}: precio={t.precio_base}, es_instalacion={t.es_instalacion}")
    print(f"    funciones_especiales: {t.funciones_especiales}")

print("\n--- Todos los tickets activos ---")
all_tickets = CatalogoTickets.objects.filter(activo=True)
for t in all_tickets:
    es_inst_prop = t.es_instalacion
    es_inst_json = t.funciones_especiales and t.funciones_especiales.get('instalacion', {}).get('activado')
    print(f"  - {t.nombre_ticket} ({t.categoria}): precio={t.precio_base}, es_instalacion(prop)={es_inst_prop}, es_instalacion(json)={es_inst_json}")
