#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sitelecable.settings')
django.setup()

from core.models.compat import CatalogoTickets

print("=== VERIFICAR Y CORREGIR TICKETS ===")

# Buscar tickets de instalación
inst_tickets = CatalogoTickets.objects.filter(nombre_ticket__icontains='instalacion', activo=True)
print(f"\nTickets con 'instalacion' en el nombre:")
for t in inst_tickets:
    print(f"\n  - {t.nombre_ticket} (ID: {t.id})")
    print(f"    Categoria: {t.categoria}")
    print(f"    Precio base: {t.precio_base}")
    print(f"    funciones_especiales: {t.funciones_especiales}")
    print(f"    es_instalacion (prop): {t.es_instalacion}")
    print(f"    instalacion_anexo (prop): {t.instalacion_anexo}")

# Corregir tickets de instalación principal (no anexos)
for t in inst_tickets:
    if 'anexo' not in t.nombre_ticket.lower():
        print(f"\n  Corrigiendo ticket de instalación: {t.nombre_ticket}")
        if not t.funciones_especiales:
            t.funciones_especiales = {}
        if 'instalacion' not in t.funciones_especiales:
            t.funciones_especiales['instalacion'] = {}
        t.funciones_especiales['instalacion']['activado'] = True
        t.save()
        print(f"    -> instalacion.activado = True")
    elif 'anexo' in t.nombre_ticket.lower():
        print(f"\n  Corrigiendo ticket de anexo: {t.nombre_ticket}")
        if not t.funciones_especiales:
            t.funciones_especiales = {}
        if 'instalacion_anexo' not in t.funciones_especiales:
            t.funciones_especiales['instalacion_anexo'] = {}
        t.funciones_especiales['instalacion_anexo']['activado'] = True
        t.save()
        print(f"    -> instalacion_anexo.activado = True")

print("\n=== VERIFICACIÓN FINAL ===")
inst_tickets = CatalogoTickets.objects.filter(nombre_ticket__icontains='instalacion', activo=True)
for t in inst_tickets:
    print(f"\n  - {t.nombre_ticket}")
    print(f"    es_instalacion: {t.es_instalacion}")
    print(f"    instalacion_anexo: {t.instalacion_anexo}")
    print(f"    precio: {t.precio_base}")
