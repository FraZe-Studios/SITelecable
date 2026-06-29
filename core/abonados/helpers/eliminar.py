def eliminar_registro(instancia, **kwargs):
    """
    Executes soft delete (activo=False) at database level if the model supports it.
    If the instance doesn't have an active attribute or delete method, returns False.
    """
    if hasattr(instancia, 'activo'):
        instancia.activo = False
        instancia.save(update_fields=['activo'])
        return True
    elif hasattr(instancia, 'delete'):
        instancia.delete()
        return True
    return False
