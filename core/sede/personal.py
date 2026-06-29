import json
import bcrypt
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import Sedes, Personal
from core.auth.comun import checksession, senderror

@csrf_exempt
def personal(request):
    """POST /api/sede/config/personal/ — Crea o actualiza un empleado de la sede."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)
        
    try:
        body = json.loads(request.body)
        sede_id = body.get('sede_id')
        if not sede_id:
            return senderror('sede_id requerido', status=400)
            
        sede = Sedes.objects.get(pk=int(sede_id))
        personal_id = body.get('personal_id')
        
        req_username = body.get('username', '').strip()
        if req_username.lower() == 'admin':
            return senderror('No se puede utilizar o asignar el nombre de usuario "admin".', status=400)
        
        req_email = body.get('correo', '').strip()
        if personal_id:
            empleado = Personal.objects.get(pk=int(personal_id))
            if empleado.username == 'admin':
                return senderror('No se puede modificar el administrador principal del sistema.', status=400)
            
            if req_username and Personal.objects.filter(username__iexact=req_username).exclude(pk=empleado.pk).exists():
                return senderror(f"El usuario '{req_username}' ya está registrado.", status=400)
            
            if req_email and Personal.objects.filter(email__iexact=req_email).exclude(pk=empleado.pk).exists():
                return senderror(f"El correo '{req_email}' ya está registrado.", status=400)
        else:
            if req_username and Personal.objects.filter(username__iexact=req_username).exists():
                return senderror(f"El usuario '{req_username}' ya está registrado.", status=400)
            
            if req_email and Personal.objects.filter(email__iexact=req_email).exists():
                return senderror(f"El correo '{req_email}' ya está registrado.", status=400)
            
            empleado = Personal()
            
        empleado.nombre_completo = body['nombre_apellidos']
        empleado.email = body['correo']
        empleado.telefono = body.get('celular', '')
        empleado.rol = body['cargo'].lower()

        if body.get('supervisor_id'):
            empleado.supervisor_id = int(body['supervisor_id'])

        if body.get('username'):
            empleado.username = req_username
        if body.get('password'):
            hashed = bcrypt.hashpw(body['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            empleado.password = hashed

        empleado.activo = bool(body.get('is_active', True))

        # Guardar cajas permitidas en dispositivos_y_seguridad
        cajas_permitidas = body.get('cajas_permitidas', [])
        if not isinstance(cajas_permitidas, list):
            cajas_permitidas = []

        dispositivos_y_seguridad = empleado.dispositivos_y_seguridad or {}
        if 'caja_permisos' not in dispositivos_y_seguridad:
            dispositivos_y_seguridad['caja_permisos'] = {}

        dispositivos_y_seguridad['caja_permisos']['cajas_permitidas'] = cajas_permitidas
        empleado.dispositivos_y_seguridad = dispositivos_y_seguridad

        empleado.save()

        # Vincular con la sede
        empleado.sede_id = sede.id
        empleado.save()

        return JsonResponse({'status': 'success', 'personal_id': empleado.id})
        
    except Sedes.DoesNotExist:
        return senderror('Sede no encontrada', status=404)
    except Exception as e:
        return senderror(str(e), status=500)
