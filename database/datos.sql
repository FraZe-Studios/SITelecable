-- ============================================================================
-- REGISTRO AUTOMATICO DE CUENTA SUPER ADMINISTRADOR (CREACION DE ENTORNO)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO
    usuarios (
        username,
        password_hash,
        nombre_completo,
        email,
        telefono,
        rol,
        supervisor_id,
        activo,
        habilidades_json
    )
VALUES (
        'admin',
        crypt (
            'admin123',
            gen_salt ('bf', 8)
        ),
        'Administrador Principal del Sistema',
        'admin@empresa.com',
        '999999999',
        'admin',
        NULL,
        TRUE,
        '{
            "habilidades_globales": {
                "tickets_cobro": {
                    "descuento_maximo_porcentaje": 100,
                    "cuotas_maximas": 12
                },
                "deudas_antiguas": {
                    "descuento_maximo_porcentaje": 100,
                    "cuotas_maximas": 12
                },
                "planes_mensuales": {
                    "descuento_maximo_porcentaje": 100,
                    "meses_maximos": 12,
                    "requiere_autorizacion_supervisor": false
                }
            }
        }'::jsonb
    )
ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- CARGA DE PLANTILLAS DE TICKETS (CATÁLOGO MAESTRO INICIAL)
-- ============================================================================

INSERT INTO
    tickets_plantillas (
        categoria,
        area,
        tecnologia,
        modalidad,
        nombre_ticket,
        precio_base,
        funciones_especiales,
        activo
    )
VALUES
    -- Incidencias Planta Interna Internet Remoto
    ('incidencia', 'planta_interna', 'internet', 'remoto', 'Internet lento', 0.00, DEFAULT, TRUE),
    ('incidencia', 'planta_interna', 'internet', 'remoto', 'Revision de senal', 0.00, DEFAULT, TRUE),
    ('incidencia', 'planta_interna', 'internet', 'remoto', 'Sin senal WiFi', 0.00, DEFAULT, TRUE),
    ('incidencia', 'planta_interna', 'internet', 'remoto', 'Problemas puerto LAN', 0.00, DEFAULT, TRUE),
    ('incidencia', 'planta_interna', 'internet', 'remoto', 'Navegacion lenta', 0.00, DEFAULT, TRUE),
    ('incidencia', 'planta_interna', 'internet', 'remoto', 'Paginas web no cargan', 0.00, DEFAULT, TRUE),
    ('incidencia', 'planta_interna', 'internet', 'remoto', 'Validacion de niveles', 0.00, DEFAULT, TRUE),
    ('incidencia', 'planta_interna', 'internet', 'remoto', 'Reinicio logico', 0.00, DEFAULT, TRUE),
    ('incidencia', 'planta_interna', 'internet', 'remoto', 'Configuracion WiFi', 0.00, DEFAULT, TRUE),

    -- Requerimientos Planta Interna Internet Remoto
    ('requerimiento', 'planta_interna', 'internet', 'remoto', 'Cambio de contrasena WiFi', 0.00, DEFAULT, TRUE),
    ('requerimiento', 'planta_interna', 'internet', 'remoto', 'Apertura de puertos', 0.00, DEFAULT, TRUE),

    -- Requerimientos Planta Interna Todos Remoto
    ('requerimiento', 'planta_interna', 'todos', 'remoto', 'Activacion logica', 0.00, DEFAULT, TRUE),
    ('requerimiento', 'planta_interna', 'todos', 'remoto', 'Configuracion remota', 0.00, DEFAULT, TRUE),

    -- Averias Planta Interna Internet Campo
    ('averia', 'planta_interna', 'internet', 'campo', 'Cable drop danado', 0.00, DEFAULT, TRUE),
    ('averia', 'planta_interna', 'internet', 'campo', 'Equipo sin conexion', 0.00, DEFAULT, TRUE),
    ('averia', 'planta_interna', 'internet', 'campo', 'Equipo no enciende', 0.00, DEFAULT, TRUE),
    ('averia', 'planta_interna', 'internet', 'campo', 'Fuente danada', 0.00, DEFAULT, TRUE),
    ('averia', 'planta_interna', 'internet', 'campo', 'Puerto danado', 0.00, DEFAULT, TRUE),
    ('averia', 'planta_interna', 'internet', 'campo', 'Cableado defectuoso', 0.00, DEFAULT, TRUE),
    ('averia', 'planta_interna', 'internet', 'campo', 'Conector danado', 0.00, DEFAULT, TRUE),
    ('averia', 'planta_interna', 'internet', 'campo', 'Wifi inestable', 0.00, DEFAULT, TRUE),
    ('averia', 'planta_interna', 'internet', 'campo', 'Repetidor sin conexion', 0.00, DEFAULT, TRUE),
    ('averia', 'planta_interna', 'internet', 'campo', 'Instalacion defectuosa', 0.00, DEFAULT, TRUE),

    -- Averias Planta Interna TV Campo
    ('averia', 'planta_interna', 'tv', 'campo', 'Senal inestable TV', 0.00, DEFAULT, TRUE),

    -- Averias Planta Interna Duo Campo
    ('averia', 'planta_interna', 'duo', 'campo', 'RF averiado', 0.00, DEFAULT, TRUE),

    -- Requerimientos Planta Interna Internet Campo
    ('requerimiento', 'planta_interna', 'internet', 'campo', 'Cambio de equipo', 0.00, '{
        "cambio_equipo": {
            "activado": true,
            "fecha_activacion": null,
            "equipo_anterior": null,
            "equipo_nuevo": null,
            "motivo": null,
            "estado": "pendiente"
        },
        "mantiene_equipo": {
            "activado": true,
            "fecha_activacion": null,
            "equipo_mantenido": null,
            "estado": "pendiente"
        }
    }'::jsonb, TRUE),
    ('requerimiento', 'planta_interna', 'internet', 'campo', 'Cableado Ethernet', 0.00, DEFAULT, TRUE),
    ('requerimiento', 'planta_interna', 'internet', 'campo', 'Instalacion de repetidor', 0.00, '{
        "cobra_materiales": {
            "activado": true,
            "fecha_activacion": null,
            "materiales": [],
            "monto_total": 0.00,
            "estado": "pendiente"
        }
    }'::jsonb, TRUE),

    -- Requerimientos Planta Interna TV Campo
    ('requerimiento', 'planta_interna', 'tv', 'campo', 'Instalacion de anexo', 0.00, '{
        "instalacion_anexo": {
            "activado": true,
            "fecha_activacion": null,
            "costo_mensual": null,
            "estado": "pendiente"
        }
    }'::jsonb, TRUE),

    -- Requerimientos Planta Interna Todos Campo
    ('requerimiento', 'planta_interna', 'todos', 'campo', 'Traslado interno', 0.00, '{
        "mantiene_equipo": {
            "activado": true,
            "fecha_activacion": null,
            "equipo_mantenido": null,
            "estado": "pendiente"
        }
    }'::jsonb, TRUE),
    ('requerimiento', 'planta_interna', 'todos', 'campo', 'Traslado externo', 0.00, '{
        "instalacion": {
            "activado": true,
            "fecha_activacion": null,
            "fecha_inicio": null,
            "fecha_fin": null,
            "tecnico_id": null,
            "estado": "pendiente"
        },
        "editar_mapa": {
            "activado": true,
            "fecha_activacion": null,
            "nap_id": null,
            "coordenadas_anteriores": null,
            "coordenadas_nuevas": null,
            "estado": "pendiente"
        }
    }'::jsonb, TRUE),

    -- Incidencias Planta Externa Todos Remoto
    ('incidencia', 'planta_externa', 'todos', 'remoto', 'Atenuacion alta', 0.00, DEFAULT, TRUE),
    ('incidencia', 'planta_externa', 'todos', 'remoto', 'NAP sin respuesta', 0.00, DEFAULT, TRUE),
    ('incidencia', 'planta_externa', 'todos', 'remoto', 'Caida de enlace', 0.00, DEFAULT, TRUE),
    ('incidencia', 'planta_externa', 'todos', 'remoto', 'Nodo fuera de linea', 0.00, DEFAULT, TRUE),
    ('incidencia', 'planta_externa', 'todos', 'remoto', 'Saturacion de red', 0.00, DEFAULT, TRUE),
    ('incidencia', 'planta_externa', 'todos', 'remoto', 'Monitoreo de fibra', 0.00, DEFAULT, TRUE),

    -- Averias Planta Externa Todos Campo
    ('averia', 'planta_externa', 'todos', 'campo', 'Poste danado', 0.00, DEFAULT, TRUE),
    ('averia', 'planta_externa', 'todos', 'campo', 'Mufa danada', 0.00, DEFAULT, TRUE),
    ('averia', 'planta_externa', 'todos', 'campo', 'NAP averiada', 0.00, DEFAULT, TRUE),
    ('averia', 'planta_externa', 'todos', 'campo', 'Corte de fibra', 0.00, DEFAULT, TRUE),
    ('averia', 'planta_externa', 'todos', 'campo', 'Fibra troncal danada', 0.00, DEFAULT, TRUE),
    ('averia', 'planta_externa', 'todos', 'campo', 'Splitter averiado', 0.00, DEFAULT, TRUE),
    ('averia', 'planta_externa', 'todos', 'campo', 'Red aerea caida', 0.00, DEFAULT, TRUE),
    ('averia', 'planta_externa', 'todos', 'campo', 'Caja terminal danada', 0.00, DEFAULT, TRUE),

    -- Requerimientos Planta Externa Todos Campo
    ('requerimiento', 'planta_externa', 'todos', 'campo', 'Expansion de red', 0.00, '{
        "editar_mapa": {
            "activado": true,
            "fecha_activacion": null,
            "nap_id": null,
            "coordenadas_anteriores": null,
            "coordenadas_nuevas": null,
            "estado": "pendiente"
        }
    }'::jsonb, TRUE),
    ('requerimiento', 'planta_externa', 'todos', 'campo', 'Instalacion de NAP', 0.00, '{
        "editar_mapa": {
            "activado": true,
            "fecha_activacion": null,
            "nap_id": null,
            "coordenadas_anteriores": null,
            "coordenadas_nuevas": null,
            "estado": "pendiente"
        },
        "nuevo_suministro": {
            "activado": true,
            "fecha_activacion": null,
            "suministro_anterior": null,
            "suministro_nuevo": null,
            "estado": "pendiente"
        }
    }'::jsonb, TRUE),
    ('requerimiento', 'planta_externa', 'todos', 'campo', 'Cambio de poste', 0.00, DEFAULT, TRUE),
    ('requerimiento', 'planta_externa', 'todos', 'campo', 'Tendido de fibra', 0.00, '{
        "genera_merma": {
            "activado": true,
            "fecha_activacion": null,
            "materiales_merma": [],
            "motivo": null,
            "autorizado_por": null,
            "estado": "pendiente"
        }
    }'::jsonb, TRUE),
    ('requerimiento', 'planta_externa', 'todos', 'campo', 'Reubicacion de red', 0.00, '{
        "editar_mapa": {
            "activado": true,
            "fecha_activacion": null,
            "nap_id": null,
            "coordenadas_anteriores": null,
            "coordenadas_nuevas": null,
            "estado": "pendiente"
        }
    }'::jsonb, TRUE),
    ('requerimiento', 'planta_externa', 'todos', 'campo', 'Instalacion de mufa', 0.00, DEFAULT, TRUE),

    -- Pirateria Planta Externa Todos Campo
    ('pirateria', 'planta_externa', 'todos', 'campo', 'Conexion clandestina', 0.00, DEFAULT, TRUE),
    ('pirateria', 'planta_externa', 'todos', 'campo', 'Derivacion ilegal', 0.00, DEFAULT, TRUE),
    ('pirateria', 'planta_externa', 'todos', 'campo', 'Manipulacion de NAP', 0.00, DEFAULT, TRUE),
    ('pirateria', 'planta_externa', 'todos', 'campo', 'Fibra ilegal conectada', 0.00, DEFAULT, TRUE),

    -- Otros Planta Externa Todos Campo
    ('otros', 'planta_externa', 'todos', 'campo', 'Seguimiento de infraestructura', 0.00, DEFAULT, TRUE),
    ('otros', 'planta_externa', 'todos', 'campo', 'Validacion troncal', 0.00, DEFAULT, TRUE),
    ('otros', 'planta_externa', 'todos', 'campo', 'Inspeccion de red', 0.00, DEFAULT, TRUE),
    ('otros', 'planta_externa', 'todos', 'campo', 'Auditoria tecnica', 0.00, DEFAULT, TRUE),
    ('otros', 'planta_externa', 'todos', 'campo', 'Retiro de Materiales', 0.00, '{
        "genera_merma": {
            "activado": true,
            "fecha_activacion": null,
            "materiales_merma": [],
            "motivo": null,
            "autorizado_por": null,
            "estado": "pendiente"
        }
    }'::jsonb, TRUE),
    ('otros', 'planta_externa', 'todos', 'campo', 'Retiro Logico', 0.00, '{
        "corte_definitivo": {
            "activado": true,
            "fecha_activacion": null,
            "motivo": "retiro_logico",
            "estado": "pendiente"
        }
    }'::jsonb, TRUE),

    -- Requerimientos Planta Interna Todos Remoto
    ('requerimiento', 'planta_interna', 'todos', 'remoto', 'Migracion de plan', 0.00, '{
        "migracion_plan": {
            "activado": true,
            "fecha_activacion": null,
            "plan_anterior_id": null,
            "plan_nuevo_id": null,
            "fecha_corte": null,
            "fecha_activacion_nuevo": null,
            "estado": "pendiente"
        }
    }'::jsonb, TRUE),

    -- Instalacion Planta Interna Todos Campo
    ('instalacion', 'planta_interna', 'todos', 'campo', 'Instalacion servicio', 50.00, '{
        "instalacion": {
            "activado": true,
            "fecha_activacion": null,
            "fecha_inicio": null,
            "fecha_fin": null,
            "tecnico_id": null,
            "estado": "pendiente"
        },
        "nuevo_suministro": {
            "activado": true,
            "fecha_activacion": null,
            "suministro_anterior": null,
            "suministro_nuevo": null,
            "estado": "pendiente"
        }
    }'::jsonb, TRUE),

    -- Requerimiento Planta Interna Todos Campo
    ('requerimiento', 'planta_interna', 'todos', 'campo', 'Corte de anexo', 0.00, '{
        "corte_anexo": {
            "activado": true,
            "fecha_activacion": null,
            "estado": "pendiente"
        }
    }'::jsonb, TRUE),

    -- Instalacion Planta Interna TV Campo
    ('instalacion', 'planta_interna', 'tv', 'campo', 'Instalacion de anexo', 30.00, '{
        "instalacion_anexo": {
            "activado": true,
            "fecha_activacion": null,
            "costo_mensual": null,
            "estado": "pendiente"
        },
        "cobra_materiales": {
            "activado": true,
            "fecha_activacion": null,
            "materiales": [],
            "monto_total": 0.00,
            "estado": "pendiente"
        }
    }'::jsonb, TRUE),

    -- Cortes Planta Interna Todos Remoto
    ('cortes', 'planta_interna', 'todos', 'remoto', 'Morosidad', 0.00, '{
        "morosidad": {
            "activado": true,
            "fecha_activacion": null,
            "estado": "pendiente"
        }
    }'::jsonb, TRUE),
    ('cortes', 'planta_interna', 'todos', 'remoto', 'Definitivo', 0.00, '{
        "corte_definitivo": {
            "activado": true,
            "fecha_activacion": null,
            "motivo": null,
            "estado": "pendiente"
        }
    }'::jsonb, TRUE),
    ('cortes', 'planta_interna', 'todos', 'remoto', 'Temporal', 0.00, '{
        "corte_temporal": {
            "activado": true,
            "fecha_activacion": null,
            "motivo": null,
            "estado": "pendiente"
        }
    }'::jsonb, TRUE),

    -- Reconexion Planta Interna Todos Campo
    ('reconexion', 'planta_interna', 'todos', 'campo', 'Servicio', 0.00, '{
        "reiniciar_servicio": {
            "activado": true,
            "fecha_activacion": null,
            "fecha_liquidacion": null,
            "nuevo_ciclo_facturacion": null,
            "estado": "pendiente"
        }
    }'::jsonb, TRUE)
ON CONFLICT DO NOTHING;
