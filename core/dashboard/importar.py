from django.views.decorators.csrf import csrf_exempt
from core.dashboard.excel import importar_desde_excel
from core.auth.comun import checksession, senderror, sendsuccess
from django.http import JsonResponse

@csrf_exempt
def importar(request):
    """
    API para importar elementos de red desde un archivo Excel.
    """
    if not checksession(request):
        return senderror('Sin sesión activa', status=401)

    if request.method != 'POST':
        return senderror('Método no permitido', status=405)

    if 'file' not in request.FILES:
        return senderror('No se proporcionó archivo', status=400)

    try:
        file_obj = request.FILES['file']
        resultado = importar_desde_excel(file_obj)
        return JsonResponse(resultado)
    except Exception as e:
        return senderror(str(e), status=500)
