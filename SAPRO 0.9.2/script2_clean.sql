-- ============================================================
-- MÓDULO: SUSCRIPCIONES + CORREOS
-- Base de datos: script_sapro  (PostgreSQL)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Estatus_Suscripcion
--    Catálogo de estados posibles de una suscripción
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Estatus_Suscripcion (
    Ess_ID_Estatus_Suscripcion SERIAL      PRIMARY KEY,
    Ess_Nombre                 VARCHAR(50) NOT NULL UNIQUE
);

-- ------------------------------------------------------------
-- 2. Tipo_Suscripcion
--    Planes disponibles para contratar
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Tipo_Suscripcion (
    Tsu_ID_Tipo_Suscripcion SERIAL         PRIMARY KEY,
    Tsu_Nombre              VARCHAR(100)   NOT NULL UNIQUE,
    Tsu_Duracion_Dias       INT            NOT NULL,
    Tsu_Precio              DECIMAL(10,2)  NOT NULL
);

-- ------------------------------------------------------------
-- 3. Suscripcion
--    Registro de cada suscripción contratada por un cliente
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Suscripcion (
    Sus_ID_Suscripcion         SERIAL        PRIMARY KEY,
    Cli_ID_Cliente             INT           NOT NULL,
    Tsu_ID_Tipo_Suscripcion    INT           NOT NULL,
    Sus_Fecha_Suscripcion      DATE          NOT NULL DEFAULT CURRENT_DATE,
    Sus_Monto_Pagado           DECIMAL(10,2) NOT NULL,
    Ess_ID_Estatus_Suscripcion INT           NOT NULL,

    CONSTRAINT fk_sus_cliente
        FOREIGN KEY (Cli_ID_Cliente)
        REFERENCES Clientes(Cli_ID_Cliente),

    CONSTRAINT fk_sus_tipo
        FOREIGN KEY (Tsu_ID_Tipo_Suscripcion)
        REFERENCES Tipo_Suscripcion(Tsu_ID_Tipo_Suscripcion),

    CONSTRAINT fk_sus_estatus
        FOREIGN KEY (Ess_ID_Estatus_Suscripcion)
        REFERENCES Estatus_Suscripcion(Ess_ID_Estatus_Suscripcion)
);

CREATE INDEX IF NOT EXISTS idx_sus_cliente ON Suscripcion(Cli_ID_Cliente);
CREATE INDEX IF NOT EXISTS idx_sus_fecha   ON Suscripcion(Sus_Fecha_Suscripcion);

-- ------------------------------------------------------------
-- 4. Correo_Suscripcion
--    Correos de contacto asociados a cada suscripción.
--    Una suscripción puede tener varios correos;
--    solo uno puede ser principal (Csu_Es_Principal = TRUE).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Correo_Suscripcion (
    Csu_ID_Correo          SERIAL       PRIMARY KEY,
    Sus_ID_Suscripcion     INT          NOT NULL,
    Csu_Correo             VARCHAR(255) NOT NULL,
    Csu_Nombre_Contacto    VARCHAR(150),
    Csu_Es_Principal       BOOLEAN      NOT NULL DEFAULT FALSE,
    Csu_Fecha_Registro     DATE         NOT NULL DEFAULT CURRENT_DATE,

    CONSTRAINT fk_csu_suscripcion
        FOREIGN KEY (Sus_ID_Suscripcion)
        REFERENCES Suscripcion(Sus_ID_Suscripcion)
        ON DELETE CASCADE,

    CONSTRAINT uq_csu_correo_por_suscripcion
        UNIQUE (Sus_ID_Suscripcion, Csu_Correo)
);

CREATE INDEX IF NOT EXISTS idx_csu_suscripcion ON Correo_Suscripcion(Sus_ID_Suscripcion);


-- ============================================================
-- DATOS CATÁLOGO
-- ============================================================

INSERT INTO Estatus_Suscripcion (Ess_Nombre) VALUES
    ('Activa'),
    ('Vencida'),
    ('Cancelada'),
    ('En revisión'),
    ('Suspendida')
ON CONFLICT (Ess_Nombre) DO NOTHING;

INSERT INTO Tipo_Suscripcion (Tsu_Nombre, Tsu_Duracion_Dias, Tsu_Precio) VALUES
    ('Mensual',     30,   2500.00),
    ('Trimestral',  90,   6500.00),
    ('Semestral',  180,  11000.00),
    ('Anual',      365,  19500.00),
    ('Bianual',    730,  34000.00)
ON CONFLICT (Tsu_Nombre) DO NOTHING;


-- ============================================================
-- DATOS DE PRUEBA
-- (Requiere que existan Clientes con Cli_ID_Cliente 1 al 5)
-- ============================================================

INSERT INTO Suscripcion
    (Cli_ID_Cliente, Tsu_ID_Tipo_Suscripcion, Sus_Fecha_Suscripcion, Sus_Monto_Pagado, Ess_ID_Estatus_Suscripcion)
VALUES
    (1, 4, '2026-01-10', 19500.00, 1),  -- Anual      | Activa
    (2, 3, '2026-02-01', 11000.00, 1),  -- Semestral  | Activa
    (3, 5, '2026-01-15', 34000.00, 1),  -- Bianual    | Activa
    (4, 2, '2025-09-01',  6500.00, 2),  -- Trimestral | Vencida
    (5, 1, '2026-02-15',  2500.00, 1)   -- Mensual    | Activa
ON CONFLICT DO NOTHING;

INSERT INTO Correo_Suscripcion
    (Sus_ID_Suscripcion, Csu_Correo, Csu_Nombre_Contacto, Csu_Es_Principal)
VALUES
    (1, 'contacto@hospitalobregon.mx',  'Administración',        TRUE),
    (1, 'sistemas@hospitalobregon.mx',  'Depto. Sistemas',       FALSE),
    (2, 'tic@utc.edu.mx',               'Coordinación TIC',      TRUE),
    (3, 'ti@banconoroeste.com',         'Gerencia TI',           TRUE),
    (3, 'seguridad@banconoroeste.com',  'Seguridad Informática', FALSE),
    (4, 'admin@industriasvalle.mx',     'Administrador',         TRUE),
    (5, 'clinica@sanjose.mx',           'Recepción',             TRUE)
ON CONFLICT (Sus_ID_Suscripcion, Csu_Correo) DO NOTHING;
