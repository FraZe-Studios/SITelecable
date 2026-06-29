import json
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import (
    Sedes, Hubs, CajasNap, Mufas, Sectores, FibrasOpticas
)
from core.auth.comun import checksession, senderror, sendsuccess

@csrf_exempt
def eliminar(request):
    """
    API para eliminar un elemento de red.
    """
    if not checksession(request):
        return senderror('Sin sesión activa', status=401)

    if request.method != 'POST':
        return senderror('Método no permitido', status=405)

    try:
        body = json.loads(request.body)
        tipo = body.get('tipo', '').upper()
        item_id = body.get('id')
    except Exception:
        return senderror('JSON inválido', status=400)

    if not item_id:
        return senderror('ID del elemento requerido', status=400)

    try:
        if tipo == 'SEDE':
            Sedes.objects.filter(pk=item_id).delete()
        elif tipo == 'HUB':
            Hubs.objects.filter(pk=item_id).delete()
        elif tipo == 'NAP':
            CajasNap.objects.filter(pk=item_id).delete()
        elif tipo == 'MUFA':
            Mufas.objects.filter(pk=item_id).delete()
        elif tipo == 'SECTOR':
            Sectores.objects.filter(pk=item_id).delete()
        elif tipo == 'FIBRA':
            FibrasOpticas.objects.filter(pk=item_id).delete()
        else:
            return senderror(f'Tipo desconocido: {tipo}', status=400)

        return sendsuccess(f'{tipo} eliminado correctamente')

    except Exception as e:
        return senderror(str(e), status=500)
