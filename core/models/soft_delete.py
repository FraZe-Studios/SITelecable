from django.db import models

class SoftDeleteQuerySet(models.QuerySet):
    def delete(self):
        """Sustituye la eliminación física por una actualización masiva lógica."""
        return self.update(activo=False)

class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        """Filtra por defecto únicamente los registros activos en producción."""
        return SoftDeleteQuerySet(self.model, using=self._db).filter(activo=True)

class SoftDeleteModel(models.Model):
    # Alineado estrictamente con el tipo BOOLEAN DEFAULT TRUE no nulo de la base de datos
    activo = models.BooleanField(default=True)

    objects = models.Manager()  # Manager por defecto: retorna todo el universo (incluyendo inactivos)
    active_objects = SoftDeleteManager()  # Manager operativo: expone solo registros vigentes

    class Meta:
        abstract = True

    def delete(self, *args, **kwargs):
        """Ejecuta un Soft Delete atómico a nivel de instancia."""
        self.activo = False
        self.save(update_fields=['activo'])