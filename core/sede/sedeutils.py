"""Utilidades para nombres de sede y prefijos de sector."""
import re

# Quita uno o más sufijos " - PREFIJO" al final del nombre
_SUFFIX_PATTERN = re.compile(r'(\s*-\s*[A-Za-z0-9]+)+$')


def strip_sede_prefijo(nombre: str) -> str:
    if not nombre:
        return ''
    return _SUFFIX_PATTERN.sub('', nombre).strip()
