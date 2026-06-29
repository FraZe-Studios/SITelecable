import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from core.abonados.contextovendedor import sistema_obtener_contexto_vendedor
from core.abonados.evaluacion import sistema_evaluar_registro
from core.auth.comun import senderror

@csrf_exempt
@require_POST
def evaluar(request):
    """POST /api/abonados/evaluar/"""
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return senderror('JSON inválido', status=400)
    try:
        username = request.session.get('username', '')
        ctx = sistema_obtener_contexto_vendedor(username)
        evaluacion = sistema_evaluar_registro(body, ctx)
        return JsonResponse({'status': 'success', 'data': evaluacion})
    except Exception as exc:
        return senderror(f'Error en evaluación: {str(exc)}', status=500)
