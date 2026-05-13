-- ============================================================
--  SAPRO - Script adaptado para PostgreSQL
-- ============================================================

-- Creación de la base de datos (ejecutar como superusuario si es necesario)
-- CREATE DATABASE script_sapro;
-- \c script_sapro

-- ============================================================
-- TABLAS DE CATÁLOGOS GEOGRÁFICOS
-- ============================================================

-- Tabla: Pais
CREATE TABLE Pais (
    Pai_ID_Pais SERIAL PRIMARY KEY,
    Pai_Nombre VARCHAR(100) NOT NULL
);

-- Tabla: Estado
CREATE TABLE Estado (
    Edo_ID_Estado SERIAL PRIMARY KEY,
    Edo_Nombre VARCHAR(100) NOT NULL,
    Pai_ID_Pais INT NOT NULL,
    FOREIGN KEY (Pai_ID_Pais) REFERENCES Pais(Pai_ID_Pais)
);

-- Tabla: Municipio
CREATE TABLE municipio (
    Mun_ID_Municipio SERIAL PRIMARY KEY,
    Mun_Nombre VARCHAR(100) NOT NULL,
    Edo_ID_Estado INT NOT NULL,
    FOREIGN KEY (Edo_ID_Estado) REFERENCES Estado(Edo_ID_Estado)
);

-- Tabla: Ciudad
CREATE TABLE ciudad (
    Cdi_ID_Ciudad SERIAL PRIMARY KEY,
    Cdi_Nombre VARCHAR(100) NOT NULL,
    Mun_ID_Municipio INT NOT NULL,
    FOREIGN KEY (Mun_ID_Municipio) REFERENCES municipio(Mun_ID_Municipio)
);

-- Tabla: Direccion
CREATE TABLE Direccion (
    Dir_ID_Direccion SERIAL PRIMARY KEY,
    Dir_Calle VARCHAR(150) NOT NULL,
    Dir_Numero VARCHAR(10) NOT NULL,
    Dir_Colonia VARCHAR(100) NOT NULL,
    Cdi_ID_Ciudad INT NOT NULL,
    FOREIGN KEY (Cdi_ID_Ciudad) REFERENCES ciudad(Cdi_ID_Ciudad)
);

-- ============================================================
-- TABLAS DE CATÁLOGOS GENERALES
-- ============================================================

-- Tabla: Proveedor
CREATE TABLE Proveedor (
    Prv_ID_Proveedor SERIAL PRIMARY KEY,
    Prv_Nombre_Proveedor VARCHAR(255) NOT NULL
);

-- Tabla: Estado_Proyecto
CREATE TABLE Estado_Proyecto (
    Epr_ID_Estatus_Proyecto SERIAL PRIMARY KEY,
    Epr_Nombre_Estatus VARCHAR(100) NOT NULL
);

-- Tabla: Puesto_Proyecto
CREATE TABLE Puesto_Proyecto (
    Ppr_ID_Puesto_Proyecto SERIAL PRIMARY KEY,
    Ppr_Nombre_Puesto VARCHAR(100) NOT NULL
);

-- Tabla: Estatus_Gasto
CREATE TABLE Estatus_Gasto (
    Egs_ID_Estatus_Gasto SERIAL PRIMARY KEY,
    Egs_Nombre VARCHAR(100) NOT NULL
);

-- Tabla: Forma_Gasto
CREATE TABLE Forma_Gasto (
    Fgs_ID_Forma_Gasto SERIAL PRIMARY KEY,
    Fgs_Nombre VARCHAR(100) NOT NULL
);

-- Tabla: Concepto_Gasto
CREATE TABLE Concepto_Gasto (
    Cgs_ID_Concepto_Gasto SERIAL PRIMARY KEY,
    Cgs_Nombre VARCHAR(100) NOT NULL
);

-- Tabla: Tipo_Documento
CREATE TABLE Tipo_Documento (
    Tdd_ID_Tipo_Documento SERIAL PRIMARY KEY,
    Tdd_Nombre_Tipo VARCHAR(100) NOT NULL
);

-- Tabla: Estatus_Ingreso
CREATE TABLE Estatus_Ingreso (
    Ein_ID_Estatus_Ingreso SERIAL PRIMARY KEY,
    Ein_Nombre VARCHAR(100) NOT NULL
);

-- Tabla: Forma_Ingreso
CREATE TABLE Forma_Ingreso (
    Fin_ID_Forma_Ingreso SERIAL PRIMARY KEY,
    Fin_Nombre VARCHAR(100) NOT NULL
);

-- Tabla: Concepto_Ingreso
CREATE TABLE Concepto_Ingreso (
    Cin_ID_Concepto_Ingreso SERIAL PRIMARY KEY,
    Cin_Nombre VARCHAR(100) NOT NULL
);

-- Tabla: Tipo_Cliente
CREATE TABLE Tipo_Cliente (
    Tpc_ID_Tipo_Cliente SERIAL PRIMARY KEY,
    Tpc_Nombre VARCHAR(50) NOT NULL UNIQUE
);

-- ============================================================
-- TABLAS PRINCIPALES
-- ============================================================

-- Tabla: Usuario
CREATE TABLE Usuario (
    Usu_ID_Usuario SERIAL PRIMARY KEY,
    Usu_Nombre VARCHAR(100) NOT NULL,
    Usu_Apellido VARCHAR(100) NOT NULL,
    Usu_Puesto_Principal VARCHAR(100) NOT NULL,
    Usu_Telefono VARCHAR(100) NOT NULL,
    Usu_Correo VARCHAR(100) NOT NULL
);

-- Tabla: Clientes
CREATE TABLE Clientes (
    Cli_ID_Cliente SERIAL PRIMARY KEY,
    Cli_Nombre VARCHAR(150) NOT NULL,
    Tpc_ID_Tipo_Cliente INT,
    Cli_Tipo VARCHAR(50) NOT NULL,
    Cli_RFC VARCHAR(13),
    Cli_Telefono VARCHAR(20) NOT NULL,
    Cli_Correo VARCHAR(100) NOT NULL,
    Cli_Contacto_Nombre VARCHAR(150),
    Cli_Contacto_Puesto VARCHAR(100),
    Dir_ID_Direccion INT,
    Cli_Fecha_Registro DATE DEFAULT CURRENT_DATE,
    Cli_Estatus BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (Dir_ID_Direccion) REFERENCES Direccion(Dir_ID_Direccion),
    FOREIGN KEY (Tpc_ID_Tipo_Cliente) REFERENCES Tipo_Cliente(Tpc_ID_Tipo_Cliente)
);

-- Índices para la tabla Clientes
CREATE INDEX idx_cliente_nombre  ON Clientes (Cli_Nombre);
CREATE INDEX idx_cliente_rfc     ON Clientes (Cli_RFC);
CREATE INDEX idx_cliente_correo  ON Clientes (Cli_Correo);
CREATE INDEX idx_cliente_estatus ON Clientes (Cli_Estatus);

COMMENT ON TABLE Clientes IS 'Catálogo de clientes que contratan proyectos en el sistema.';

-- Tabla: Proyecto
CREATE TABLE Proyecto (
    Pro_ID_Proyecto SERIAL PRIMARY KEY,
    Pro_Nombre VARCHAR(100) NOT NULL,
    Pro_Descripcion TEXT,
    Cli_ID_Cliente INT,
    Usu_ID_Usuario INT,
    Dir_ID_Direccion INT,
    Gas_ID_Gasto INT,
    Ing_ID_Ingreso INT,
    Pro_Fecha_Inicio DATE NOT NULL,
    Pro_Fecha_Finalizacion DATE,
    Pro_Costo_Proyecto DECIMAL(10,2),
    Epr_ID_Estatus_Proyecto INT,
    FOREIGN KEY (Cli_ID_Cliente) REFERENCES Clientes(Cli_ID_Cliente),
    FOREIGN KEY (Usu_ID_Usuario) REFERENCES Usuario(Usu_ID_Usuario),
    FOREIGN KEY (Dir_ID_Direccion) REFERENCES Direccion(Dir_ID_Direccion),
    FOREIGN KEY (Epr_ID_Estatus_Proyecto) REFERENCES Estado_Proyecto(Epr_ID_Estatus_Proyecto)
);

-- Tabla: Gasto
CREATE TABLE Gasto (
    Gas_ID_Gasto SERIAL PRIMARY KEY,
    Cgs_ID_Concepto_Gasto INT NOT NULL,
    Gas_Monto DECIMAL(10,2) NOT NULL,
    Gas_Fecha_Gasto DATE NOT NULL,
    Fgs_ID_Forma_Gasto INT NOT NULL,
    Gas_Comprobante_Gasto TEXT,
    Gas_Es_Proveedor BOOLEAN NOT NULL,
    Prv_ID_Proveedor INT,
    Usu_ID_Usuario INT NOT NULL,
    Pro_ID_Proyecto INT NOT NULL,
    Egs_ID_Estatus_Gasto INT NOT NULL,
    FOREIGN KEY (Cgs_ID_Concepto_Gasto) REFERENCES Concepto_Gasto(Cgs_ID_Concepto_Gasto),
    FOREIGN KEY (Fgs_ID_Forma_Gasto) REFERENCES Forma_Gasto(Fgs_ID_Forma_Gasto),
    FOREIGN KEY (Prv_ID_Proveedor) REFERENCES Proveedor(Prv_ID_Proveedor),
    FOREIGN KEY (Usu_ID_Usuario) REFERENCES Usuario(Usu_ID_Usuario),
    FOREIGN KEY (Pro_ID_Proyecto) REFERENCES Proyecto(Pro_ID_Proyecto),
    FOREIGN KEY (Egs_ID_Estatus_Gasto) REFERENCES Estatus_Gasto(Egs_ID_Estatus_Gasto)
);

-- Tabla: Ingresos
CREATE TABLE Ingresos (
    Ing_ID_Ingreso SERIAL PRIMARY KEY,
    Cin_ID_Concepto_Ingreso INT NOT NULL,
    Ing_Monto DECIMAL(10,2) NOT NULL,
    Ing_Fecha_Ingreso DATE NOT NULL,
    Fin_ID_Forma_Ingreso INT NOT NULL,
    Ing_Comprobante_Pago TEXT,
    Pro_ID_Proyecto INT NOT NULL,
    Ein_ID_Estatus_Ingreso INT NOT NULL,
    FOREIGN KEY (Cin_ID_Concepto_Ingreso) REFERENCES Concepto_Ingreso(Cin_ID_Concepto_Ingreso),
    FOREIGN KEY (Fin_ID_Forma_Ingreso) REFERENCES Forma_Ingreso(Fin_ID_Forma_Ingreso),
    FOREIGN KEY (Pro_ID_Proyecto) REFERENCES Proyecto(Pro_ID_Proyecto),
    FOREIGN KEY (Ein_ID_Estatus_Ingreso) REFERENCES Estatus_Ingreso(Ein_ID_Estatus_Ingreso)
);

-- Tabla: Documento
CREATE TABLE Documento (
    Doc_ID_Documento SERIAL PRIMARY KEY,
    Doc_Nombre VARCHAR(100) NOT NULL,
    Doc_Descripcion TEXT,
    Doc_Archivo TEXT NOT NULL,
    Pro_ID_Proyecto INT NOT NULL,
    Tdd_ID_Tipo_Documento INT NOT NULL,
    FOREIGN KEY (Pro_ID_Proyecto) REFERENCES Proyecto(Pro_ID_Proyecto),
    FOREIGN KEY (Tdd_ID_Tipo_Documento) REFERENCES Tipo_Documento(Tdd_ID_Tipo_Documento)
);

-- Tabla: Comprobante
CREATE TABLE Comprobante (
    Com_ID_Comprobante SERIAL PRIMARY KEY,
    Com_Nombre VARCHAR(100) NOT NULL,
    Com_Descripcion TEXT,
    Com_Archivo TEXT NOT NULL,
    Tdd_ID_Tipo_Documento INT NOT NULL,
    FOREIGN KEY (Tdd_ID_Tipo_Documento) REFERENCES Tipo_Documento(Tdd_ID_Tipo_Documento)
);

-- Tabla: Proyecto_Usuario (relación muchos a muchos)
CREATE TABLE Proyecto_Usuario (
    Usu_ID_Usuario INT NOT NULL,
    Pro_ID_Proyecto INT NOT NULL,
    Ppr_ID_Puesto_Proyecto INT NOT NULL,
    PRIMARY KEY (Usu_ID_Usuario, Pro_ID_Proyecto),
    FOREIGN KEY (Usu_ID_Usuario) REFERENCES Usuario(Usu_ID_Usuario),
    FOREIGN KEY (Pro_ID_Proyecto) REFERENCES Proyecto(Pro_ID_Proyecto),
    FOREIGN KEY (Ppr_ID_Puesto_Proyecto) REFERENCES Puesto_Proyecto(Ppr_ID_Puesto_Proyecto)
);

-- Tabla: Login
CREATE TABLE Login (
    Log_ID SERIAL PRIMARY KEY,
    Log_Contraseña VARCHAR(100) NOT NULL,
    Usu_ID_Usuario INT NOT NULL,
    Log_Activo BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (Usu_ID_Usuario) REFERENCES Usuario(Usu_ID_Usuario)
);

-- ============================================================
-- DATOS DE PRUEBA
-- ============================================================

-- 1. PAIS
INSERT INTO Pais (Pai_Nombre) VALUES
('México'),
('Estados Unidos'),
('Canadá'),
('España'),
('Colombia');

-- 2. ESTADO
INSERT INTO Estado (Edo_Nombre, Pai_ID_Pais) VALUES
('Aguascalientes', 1),
('Baja California', 1),
('Baja California Sur', 1),
('Campeche', 1),
('Chiapas', 1),
('Chihuahua', 1),
('Coahuila', 1),
('Colima', 1),
('Durango', 1),
('Guanajuato', 1),
('Guerrero', 1),
('Hidalgo', 1),
('México', 1),
('Michoacán', 1),
('Morelos', 1),
('Nayarit', 1),
('Oaxaca', 1),
('Puebla', 1),
('Querétaro', 1),
('Quintana Roo', 1),
('San Luis Potosí', 1),
('Sinaloa', 1),
('Tabasco', 1),
('Tamaulipas', 1),
('Tlaxcala', 1),
('Veracruz', 1),
('Yucatán', 1),
('Zacatecas', 1);

-- 3. MUNICIPIO
INSERT INTO municipio (Mun_Nombre, Edo_ID_Estado) VALUES
('Cajeme', 1),
('Hermosillo', 1),
('Guadalajara', 2),
('Cuauhtémoc', 3),
('Tijuana', 5);

-- 4. CIUDAD
INSERT INTO ciudad (Cdi_Nombre, Mun_ID_Municipio) VALUES
('Ciudad Obregón', 1),
('Hermosillo Centro', 2),
('Guadalajara Centro', 3),
('Roma Norte', 4),
('Zona Río', 5);

-- 5. DIRECCION
INSERT INTO Direccion (Dir_Calle, Dir_Numero, Dir_Colonia, Cdi_ID_Ciudad) VALUES
('Blvd. Lázaro Cárdenas', '1234', 'Centro', 1),
('Av. Alvaro Obregón', '567', 'Villa Fontana', 1),
('Paseo de la Reforma', '890', 'Juárez', 4),
('Av. Vallarta', '1122', 'Chapalita', 3),
('Paseo de los Héroes', '3344', 'Zona Río', 5);

-- 6. PROVEEDOR
INSERT INTO Proveedor (Prv_Nombre_Proveedor) VALUES
('Dell Technologies México'),
('HP Enterprise'),
('Cisco Systems'),
('VMware Latinoamérica'),
('Microsoft México');

-- 7. ESTADO_PROYECTO
INSERT INTO Estado_Proyecto (Epr_Nombre_Estatus) VALUES
('Planeación'),
('En progreso'),
('Pausado'),
('Terminado'),
('Cancelado');

-- 8. PUESTO_PROYECTO
INSERT INTO Puesto_Proyecto (Ppr_Nombre_Puesto) VALUES
('Gerente de Proyecto'),
('Ingeniero de Sistemas'),
('Especialista en Ciberseguridad'),
('Técnico de Soporte'),
('Coordinador de Implementación');

-- 9. USUARIO
INSERT INTO Usuario (Usu_Nombre, Usu_Apellido, Usu_Puesto_Principal, Usu_Telefono, Usu_Correo) VALUES
('Carlos', 'Mendoza', 'Gerente de Proyectos', '6441234567', 'carlos.mendoza@cits.com.mx'),
('Ana', 'López', 'Ingeniera de Sistemas', '6442345678', 'ana.lopez@cits.com.mx'),
('Roberto', 'Sánchez', 'Especialista en Ciberseguridad', '6443456789', 'roberto.sanchez@cits.com.mx'),
('María', 'Gómez', 'Coordinadora de Implementación', '6444567890', 'maria.gomez@cits.com.mx'),
('Javier', 'Torres', 'Técnico Senior', '6445678901', 'javier.torres@cits.com.mx'),
('admin', 'admin', 'admin', '6441000000', 'admin@admin.com');

-- 10. ESTATUS_GASTO
INSERT INTO Estatus_Gasto (Egs_Nombre) VALUES
('Pendiente'),
('Autorizado'),
('Pagado'),
('Rechazado'),
('Reembolsado');

-- 11. FORMA_GASTO
INSERT INTO Forma_Gasto (Fgs_Nombre) VALUES
('Transferencia'),
('Tarjeta Corporativa'),
('Cheque'),
('Efectivo'),
('Pago en línea');

-- 12. CONCEPTO_GASTO
INSERT INTO Concepto_Gasto (Cgs_Nombre) VALUES
('Hardware - Servidores'),
('Software - Licencias'),
('Capacitación Técnica'),
('Servicios de Nube'),
('Mantenimiento Preventivo'),
('Comisiones');

-- 13. TIPO_DOCUMENTO
INSERT INTO Tipo_Documento (Tdd_Nombre_Tipo) VALUES
('Contrato de Servicio'),
('Factura'),
('Cotización'),
('Acta de Entrega'),
('Certificado de Garantía');

-- 14. ESTATUS_INGRESO
INSERT INTO Estatus_Ingreso (Ein_Nombre) VALUES
('Pendiente'),
('Confirmado'),
('Depositado'),
('Rechazado'),
('Parcial');

-- 15. FORMA_INGRESO
INSERT INTO Forma_Ingreso (Fin_Nombre) VALUES
('Transferencia Bancaria'),
('Depósito en Cuenta'),
('Pago con Tarjeta'),
('Cheque Bancario'),
('Pago en Línea');

-- 16. CONCEPTO_INGRESO
INSERT INTO Concepto_Ingreso (Cin_Nombre) VALUES
('Pago Inicial'),
('Pago Parcial'),
('Pago Final'),
('Mantenimiento Mensual'),
('Soporte Técnico');

-- 17. TIPO_CLIENTE
INSERT INTO Tipo_Cliente (Tpc_Nombre) VALUES
('Institución Pública'),
('Institución Educativa'),
('Empresa Financiera'),
('Empresa Industrial'),
('Pyme/Servicios');

-- 18. CLIENTES
INSERT INTO Clientes (Cli_Nombre, Tpc_ID_Tipo_Cliente, Cli_Tipo, Cli_RFC, Cli_Telefono, Cli_Correo, Cli_Contacto_Nombre, Cli_Contacto_Puesto, Dir_ID_Direccion) VALUES
('Hospital General de Ciudad Obregón', 1, 'Institución Pública', 'HGC9012345A1', '6441112233', 'sistemas@hospitalobregon.gob.mx', 'Dr. Ricardo Vega', 'Director de TI', 1),
('Universidad Tecnológica de Cajeme', 2, 'Institución Educativa', 'UTC8765432B2', '6442223344', 'tic@utc.edu.mx', 'Mtro. Laura Martínez', 'Coordinadora de TI', 2),
('Banco del Noroeste SA', 3, 'Empresa Financiera', 'BNM7654321C3', '6623334455', 'infraestructura@banconoroeste.com.mx', 'Ing. Eduardo Ruiz', 'Gerente de Infraestructura', 3),
('Industrias del Valle SA de CV', 4, 'Empresa Industrial', 'IVS6543210D4', '3314445566', 'ti@industriasvalle.com.mx', 'Sr. Miguel Ángel Torres', 'Director General', 4),
('Clínica Médica San José', 5, 'Empresa de Servicios', 'CMS5432109E5', '6445556677', 'administracion@clinicasanjose.com.mx', 'Dra. Camila Restrepo', 'Gerente Administrativa', 1);

-- 19. PROYECTO
INSERT INTO Proyecto (Pro_Nombre, Pro_Descripcion, Cli_ID_Cliente, Usu_ID_Usuario, Dir_ID_Direccion, Pro_Fecha_Inicio, Pro_Fecha_Finalizacion, Pro_Costo_Proyecto, Epr_ID_Estatus_Proyecto) VALUES
('Implementación de Servidores HP para Hospital Obregón', 'Instalación y configuración de 3 servidores HP ProLiant para sistema de historiales médicos', 1, 1, 1, '2026-01-10', '2026-03-15', 450000.00, 2),
('Migración a VMware - Universidad Tecnológica', 'Virtualización de servidores y migración a plataforma VMware vSphere', 2, 2, 2, '2026-02-01', '2026-04-30', 320000.00, 2),
('Firewall Fortinet - Banco del Noroeste', 'Implementación de solución de ciberseguridad con firewall Fortinet y políticas de acceso', 3, 3, 3, '2026-01-15', '2026-02-28', 280000.00, 1),
('Almacenamiento NAS - Industrias del Valle', 'Instalación de sistema de almacenamiento NAS Synology para respaldos empresariales', 4, 4, 4, '2026-03-01', '2026-04-15', 195000.00, 1),
('Servidor de Correo - Clínica San José', 'Configuración de servidor de correo Microsoft Exchange para 50 usuarios', 5, 5, 1, '2026-02-15', '2026-03-20', 120000.00, 2);

-- 20. GASTO
INSERT INTO Gasto (Cgs_ID_Concepto_Gasto, Gas_Monto, Gas_Fecha_Gasto, Fgs_ID_Forma_Gasto, Gas_Comprobante_Gasto, Gas_Es_Proveedor, Prv_ID_Proveedor, Usu_ID_Usuario, Pro_ID_Proyecto, Egs_ID_Estatus_Gasto) VALUES
(1, 280000.00, '2026-01-12', 1, 'factura_hp_servidores_001.pdf', TRUE, 2, 1, 1, 3),
(2, 45000.00, '2026-02-05', 1, 'licencia_vmware_enterprise.pdf', TRUE, 4, 2, 2, 3),
(1, 150000.00, '2026-01-18', 1, 'fortinet_firewall_3000e.pdf', TRUE, 3, 3, 3, 3),
(1, 95000.00, '2026-03-05', 2, 'synology_rs2419+.pdf', TRUE, 1, 4, 4, 2),
(2, 28000.00, '2026-02-20', 1, 'licencia_exchange_server.pdf', TRUE, 5, 5, 5, 3);

-- 21. INGRESOS
INSERT INTO Ingresos (Cin_ID_Concepto_Ingreso, Ing_Monto, Ing_Fecha_Ingreso, Fin_ID_Forma_Ingreso, Ing_Comprobante_Pago, Pro_ID_Proyecto, Ein_ID_Estatus_Ingreso) VALUES
(1, 135000.00, '2026-01-11', 1, 'pago_inicial_hospital.pdf', 1, 3),
(1, 96000.00, '2026-02-02', 1, 'pago_inicial_utc.pdf', 2, 3),
(1, 84000.00, '2026-01-16', 2, 'pago_inicial_banco.pdf', 3, 3),
(1, 58500.00, '2026-03-02', 1, 'pago_inicial_industrias.pdf', 4, 3),
(1, 36000.00, '2026-02-16', 1, 'pago_inicial_clinica.pdf', 5, 3);

-- 22. DOCUMENTO
INSERT INTO Documento (Doc_Nombre, Doc_Descripcion, Doc_Archivo, Pro_ID_Proyecto, Tdd_ID_Tipo_Documento) VALUES
('Contrato Hospital Obregón', 'Contrato de servicios de implementación de infraestructura', 'contrato_hospital_2026.pdf', 1, 1),
('Cotización Universidad', 'Cotización detallada de servicios de virtualización', 'cotizacion_utc_vmware.pdf', 2, 3),
('Acta de Entrega Banco', 'Acta de entrega de equipo firewall Fortinet', 'acta_entrega_fortinet.pdf', 3, 4),
('Certificado Synology', 'Certificado de garantía del equipo NAS', 'garantia_synology_3anos.pdf', 4, 5),
('Contrato Clínica San José', 'Contrato de configuración de servidor Exchange', 'contrato_clinica_correo.pdf', 5, 1);

-- 23. COMPROBANTE
INSERT INTO Comprobante (Com_Nombre, Com_Descripcion, Com_Archivo, Tdd_ID_Tipo_Documento) VALUES
('Factura HP Servidores', 'Factura de compra de 3 servidores HP ProLiant', 'fact_hp_proliant_001.pdf', 2),
('Factura VMware Licencia', 'Factura de licencia VMware vSphere Enterprise', 'fact_vmware_vsphere.pdf', 2),
('Factura Fortinet', 'Factura de firewall Fortinet 3000E', 'fact_fortinet_3000e.pdf', 2),
('Factura Synology', 'Factura de NAS Synology RS2419+', 'fact_synology_rs2419.pdf', 2),
('Factura Microsoft', 'Factura de licencia Exchange Server 2023', 'fact_exchange_server.pdf', 2);

-- 24. PROYECTO_USUARIO
INSERT INTO Proyecto_Usuario (Usu_ID_Usuario, Pro_ID_Proyecto, Ppr_ID_Puesto_Proyecto) VALUES
(1, 1, 1),
(2, 1, 2),
(3, 2, 2),
(4, 2, 5),
(5, 3, 3);

-- 25. LOGIN
INSERT INTO Login (Log_Contraseña, Usu_ID_Usuario, Log_Activo) VALUES
('Admin2026!', 1, TRUE),
('Soporte#123', 2, TRUE),
('CyberSecure99', 3, TRUE),
('Implantacion$45', 4, FALSE),
('Tecnico789*', 5, TRUE),
('admin', 6, TRUE);
