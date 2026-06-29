from django.http import HttpResponse
from core.dashboard.excel import generar_modelo_excel
from core.auth.comun import checksession, senderror

def descargar(request):
    """
    API para descargar la plantilla/modelo de Excel.
    """
    if not checksession(request):
        return senderror('Sin sesión activa', status=401)

    if request.method != 'GET':
        return senderror('Método no permitido', status=405)

    try:
        wb = generar_modelo_excel()
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename="modelo_red_sitelecable.xlsx"'
        wb.save(response)
        return response
    except Exception as e:
        return senderror(str(e), status=500)
