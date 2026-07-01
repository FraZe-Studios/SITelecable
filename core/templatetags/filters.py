from django import template

register = template.Library()


@register.filter(name='replace')
def replace_filter(value, arg):
    """
    Reemplaza la primera parte del argumento por la segunda.
    Uso en template: {{ valor|replace:"_: " }}
    El argumento se separa con ':' → replace:"buscar:reemplazar"
    O con dos argumentos separados por coma: replace:"_,' '"
    Soporta también el formato Jinja-like replace:'_',' '
    """
    if not isinstance(value, str):
        return value
    # Soporte para formato "buscar,reemplazar"
    if ',' in arg:
        parts = arg.split(',', 1)
        search = parts[0].strip().strip("'\"")
        replacement = parts[1].strip().strip("'\"")
    else:
        # Formato simple "buscar:reemplazar"
        if ':' in arg:
            parts = arg.split(':', 1)
            search = parts[0].strip().strip("'\"")
            replacement = parts[1].strip().strip("'\"")
        else:
            search = arg
            replacement = ''
    return value.replace(search, replacement)
