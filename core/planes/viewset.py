from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from core.models.planes import Planes
from core.planes.serializers import PlanesSerializer, PlanesListSerializer, PlanesDetalleSerializer

class PlanesViewSet(viewsets.ModelViewSet):
    """
    ViewSet para CRUD de Planes Comerciales.
    Soporta operaciones transaccionales y validaciones según las Reglas del negocio.
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filtrar planes por sede si se proporciona el parámetro."""
        queryset = Planes.objects.filter(activo=True)
        sede_id = self.request.query_params.get('sede_id')
        
        if sede_id:
            queryset = queryset.filter(sede_id=sede_id)
        
        tipo_servicio = self.request.query_params.get('tipo_servicio')
        if tipo_servicio:
            queryset = queryset.filter(tipo_servicio=tipo_servicio)
        
        tipo_cliente = self.request.query_params.get('tipo_cliente')
        if tipo_cliente:
            queryset = queryset.filter(tipo_cliente=tipo_cliente)
        
        return queryset
    
    def get_serializer_class(self):
        """Usar serializer diferente según la acción."""
        if self.action == 'list':
            return PlanesListSerializer
        elif self.action == 'retrieve':
            return PlanesDetalleSerializer
        return PlanesSerializer
    
    def create(self, request, *args, **kwargs):
        """Crear nuevo plan con validación transaccional."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            with transaction.atomic():
                self.perform_create(serializer)
        except Exception as e:
            return Response(
                {'error': f'Error al crear plan: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers
        )
    
    def update(self, request, *args, **kwargs):
        """Actualizar plan existente con validación transaccional."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        try:
            with transaction.atomic():
                self.perform_update(serializer)
        except Exception as e:
            return Response(
                {'error': f'Error al actualizar plan: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return Response(serializer.data)
    
    def destroy(self, request, *args, **kwargs):
        """Eliminar plan (soft delete)."""
        instance = self.get_object()
        instance.activo = False
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=False, methods=['get'])
    def tipos_servicio(self, request):
        """Obtener lista de tipos de servicio disponibles."""
        tipos = [
            {'value': 'internet', 'label': 'Internet'},
            {'value': 'tv', 'label': 'TV Cable'},
            {'value': 'duo', 'label': 'Dúo'},
            {'value': 'app', 'label': 'App / Servicios Digitales'},
            {'value': 'servicio', 'label': 'Servicio'}
        ]
        return Response(tipos)
    
    @action(detail=False, methods=['get'])
    def tipos_cliente(self, request):
        """Obtener lista de tipos de cliente disponibles."""
        tipos = [
            {'value': 'residencial', 'label': 'Residencial'},
            {'value': 'corporativo', 'label': 'Corporativo'}
        ]
        return Response(tipos)
    
    @action(detail=False, methods=['get'])
    def dias_vencimiento(self, request):
        """Obtener lista de días de vencimiento disponibles."""
        dias = [
            {'value': 'fin_mes', 'label': 'Cada fin de mes'},
            {'value': 'fecha_instalacion', 'label': 'Día de la instalación'}
        ]
        return Response(dias)
    
    @action(detail=False, methods=['get'])
    def aplicaciones_digitales(self, request):
        """Obtener lista de aplicaciones digitales disponibles para planes duo/servicio."""
        aplicaciones = [
            {'value': 'netflix', 'label': 'Netflix'},
            {'value': 'max', 'label': 'Max (HBO)'},
            {'value': 'disney_plus', 'label': 'Disney+'},
            {'value': 'amazon_prime', 'label': 'Amazon Prime'},
            {'value': 'spotify', 'label': 'Spotify'},
            {'value': 'youtube_premium', 'label': 'YouTube Premium'}
        ]
        return Response(aplicaciones)
    
    @action(detail=True, methods=['post'])
    def duplicar(self, request, pk=None):
        """Duplicar un plan existente."""
        plan_original = self.get_object()
        
        nuevo_plan = Planes(
            sede=plan_original.sede,
            nombre=f"{plan_original.nombre} (Copia)",
            tipo_servicio=plan_original.tipo_servicio,
            tipo_cliente=plan_original.tipo_cliente,
            costo_mensual=plan_original.costo_mensual,
            caracteristicas_tecnicas_json=plan_original.caracteristicas_tecnicas_json.copy() if plan_original.caracteristicas_tecnicas_json else {},
            dia_vencimiento=plan_original.dia_vencimiento,
            dias_gracia=plan_original.dias_gracia,
            descripcion=plan_original.descripcion
        )
        
        try:
            with transaction.atomic():
                nuevo_plan.save()
            serializer = PlanesDetalleSerializer(nuevo_plan)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response(
                {'error': f'Error al duplicar plan: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
