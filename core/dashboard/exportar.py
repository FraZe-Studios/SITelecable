from django.http import HttpResponse
from core.dashboard.excel import exportar_datos_excel
from core.auth.comun import checksession, senderror

def exportar(request):
    """
    API para exportar todos los elementos de red a Excel.
    """
    if not checksession(request):
        return senderror('Sin sesión activa', status=401)

    if request.method != 'GET':
        return senderror('Método no permitido', status=405)

    try:
        wb = exportar_datos_excel()
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename="red_completa_sitelecable.xlsx"'
        wb.save(response)
        return response
    except Exception as e:
        return senderror(str(e), status=500)
