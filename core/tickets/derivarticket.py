import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from core.models.tickets import TicketsOrdenes
from core.auth.comun import senderror

@csrf_exempt
@require_POST
def derivarticket(request):
    """POST /api/abonados/derivar-ticket/ — Deriva un ticket entre modalidad campo y remoto."""
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return senderror('JSON inválido', status=400)

    ticket_id = body.get('ticket_id')
    nueva_modalidad = body.get('modalidad')

    if not ticket_id:
        return senderror('ticket_id requerido', status=400)

    try:
        ticket = TicketsOrdenes.objects.get(pk=int(ticket_id))
    except (TicketsOrdenes.DoesNotExist, ValueError):
        return senderror('Ticket no encontrado', status=404)

    if not nueva_modalidad:
        nueva_modalidad = 'remoto' if ticket.modalidad == 'campo' else 'campo'

    ticket.modalidad = nueva_modalidad.lower().strip()
    if ticket.modalidad == 'campo':
        ticket.area = 'planta_externa'
    else:
        ticket.area = 'planta_interna'

    motivo = (body.get('motivo') or '').strip()
    if motivo:
        current_notas = ticket.notas or ''
        sep = '\n\n' if current_notas else ''
        ticket.notas = f"{current_notas}{sep}[DERIVACIÓN A {nueva_modalidad.upper()}] Motivo: {motivo}"

    ticket.save(update_fields=['modalidad', 'area', 'notas'])

    return JsonResponse({
        'status': 'success',
        'data': {
            'ticket_id': ticket.id,
            'modalidad': ticket.modalidad,
            'area': ticket.area
        }
    })
