def editar_registro(instancia, **kwargs):
    """
    Performs generic updates of records using unpacked kwargs.
    """
    for campo, valor in kwargs.items():
        setattr(instancia, campo, valor)
    instancia.save()
    return instancia
