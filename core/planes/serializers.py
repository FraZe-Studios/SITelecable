"""
Serializers Django REST Framework para Planes Comerciales de la Sede
Validación transaccional y consistencia de datos según Reglas de Oro (A, B, C, D)
"""

from rest_framework import serializers
from core.models.planes import Planes
from django.core.exceptions import ValidationError


class PlanesSerializer(serializers.ModelSerializer):
    """
    Serializer para Planes Comerciales con validación dinámica de características técnicas
    """
    
    class Meta:
        model = Planes
        fields = [
            'id', 'sede', 'nombre', 'tipo_servicio', 'tipo_cliente',
            'costo_mensual', 'caracteristicas_tecnicas_json',
            'velocidad_mbps', 'canales',
            'dia_vencimiento', 'dias_gracia',
            'descripcion',
            'fecha_creacion', 'fecha_actualizacion'
        ]
        read_only_fields = ['id', 'fecha_creacion', 'fecha_actualizacion']
    
    def validate_tipo_servicio(self, value):
        """
        Validar que tipo_servicio sea uno de los valores permitidos
        """
        tipos_validos = ['internet', 'tv', 'duo', 'app', 'servicio']
        if value not in tipos_validos:
            raise serializers.ValidationError(
                f'Tipo de servicio inválido. Debe ser uno de: {", ".join(tipos_validos)}'
            )
        return value
    
    def validate_tipo_cliente(self, value):
        """
        Validar que tipo_cliente sea uno de los valores permitidos
        """
        clientes_validos = ['residencial', 'corporativo']
        if value not in clientes_validos:
            raise serializers.ValidationError(
                f'Tipo de cliente inválido. Debe ser uno de: {", ".join(clientes_validos)}'
            )
        return value
    
    def validate_dia_vencimiento(self, value):
        """
        Validar que dia_vencimiento sea uno de los valores permitidos
        """
        vencimientos_validos = ['fin_mes', 'fecha_instalacion']
        if value not in vencimientos_validos:
            raise serializers.ValidationError(
                f'Día de vencimiento inválido. Debe ser uno de: {", ".join(vencimientos_validos)}'
            )
        return value
    
    def validate_caracteristicas_tecnicas_json(self, value):
        """
        Validar estructura del JSON de características técnicas según tipo de servicio
        """
        if not isinstance(value, dict):
            raise serializers.ValidationError(
                'caracteristicas_tecnicas_json debe ser un objeto JSON válido'
            )
        return value
    
    def validate(self, attrs):
        """
        Validación cruzada de campos según tipo de servicio
        """
        tipo_servicio = attrs.get('tipo_servicio')
        caracteristicas = attrs.get('caracteristicas_tecnicas_json', {})
        
        # Si estamos actualizando, usar valores existentes si no se proporcionan
        if self.instance:
            if not tipo_servicio:
                tipo_servicio = self.instance.tipo_servicio
            if not caracteristicas:
                caracteristicas = self.instance.caracteristicas_tecnicas_json or {}
        
        # Validar características técnicas según tipo de servicio
        if tipo_servicio in ['internet', 'duo', 'servicio']:
            caracteristicas_base = caracteristicas.get('caracteristicas_base', {})
            if not caracteristicas_base.get('velocidad_mbps'):
                raise serializers.ValidationError({
                    'caracteristicas_tecnicas_json': f'Para planes de tipo {tipo_servicio} se requiere velocidad_mbps en caracteristicas_base'
                })
        
        if tipo_servicio in ['tv', 'duo', 'servicio']:
            caracteristicas_base = caracteristicas.get('caracteristicas_base', {})
            if not caracteristicas_base.get('cantidad_canales'):
                raise serializers.ValidationError({
                    'caracteristicas_tecnicas_json': f'Para planes de tipo {tipo_servicio} se requiere cantidad_canales en caracteristicas_base'
                })
        
        return attrs
    
    def create(self, validated_data):
        """
        Crear plan con sincronización de campos legacy
        """
        # Sincronizar campos legacy con JSONB
        caracteristicas = validated_data.get('caracteristicas_tecnicas_json', {})
        
        if caracteristicas.get('velocidad_mbps'):
            validated_data['velocidad_mbps'] = caracteristicas['velocidad_mbps']
        if caracteristicas.get('cantidad_canales'):
            validated_data['canales'] = caracteristicas['cantidad_canales']
        
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """
        Actualizar plan con sincronización de campos legacy
        """
        # Sincronizar campos legacy con JSONB
        caracteristicas = validated_data.get('caracteristicas_tecnicas_json', {})
        
        if caracteristicas.get('velocidad_mbps'):
            validated_data['velocidad_mbps'] = caracteristicas['velocidad_mbps']
        if caracteristicas.get('cantidad_canales'):
            validated_data['canales'] = caracteristicas['cantidad_canales']
        
        return super().update(instance, validated_data)


class PlanesListSerializer(serializers.ModelSerializer):
    """
    Serializer simplificado para listados de planes
    """
    
    class Meta:
        model = Planes
        fields = [
            'id', 'nombre', 'tipo_servicio', 'tipo_cliente',
            'costo_mensual', 'activo'
        ]


class PlanesDetalleSerializer(serializers.ModelSerializer):
    """
    Serializer detallado para vista individual de plan
    Incluye información de sede y características técnicas formateadas
    """
    sede_nombre = serializers.CharField(source='sede.nombre', read_only=True)
    velocidad_mbps_display = serializers.SerializerMethodField()
    cantidad_canales_display = serializers.SerializerMethodField()
    aplicaciones_digitales = serializers.SerializerMethodField()
    
    class Meta:
        model = Planes
        fields = [
            'id', 'sede', 'sede_nombre', 'nombre', 'tipo_servicio', 'tipo_cliente',
            'costo_mensual', 'caracteristicas_tecnicas_json',
            'velocidad_mbps', 'velocidad_mbps_display',
            'canales', 'cantidad_canales_display',
            'aplicaciones_digitales',
            'dia_vencimiento', 'dias_gracia',
            'descripcion',
            'fecha_creacion', 'fecha_actualizacion'
        ]
        read_only_fields = ['id', 'fecha_creacion', 'fecha_actualizacion']
    
    def get_velocidad_mbps_display(self, obj):
        """Obtener velocidad del JSONB o campo legacy"""
        caracteristicas = obj.caracteristicas_tecnicas_json or {}
        return caracteristicas.get('velocidad_mbps') or obj.velocidad_mbps
    
    def get_cantidad_canales_display(self, obj):
        """Obtener cantidad de canales del JSONB o campo legacy"""
        caracteristicas = obj.caracteristicas_tecnicas_json or {}
        return caracteristicas.get('cantidad_canales') or obj.canales
    
    def get_aplicaciones_digitales(self, obj):
        """Obtener lista de aplicaciones digitales del JSONB"""
        caracteristicas = obj.caracteristicas_tecnicas_json or {}
        return caracteristicas.get('aplicaciones_digitales', [])
