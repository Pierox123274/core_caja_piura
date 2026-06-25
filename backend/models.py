import uuid

from sqlalchemy import Column, String, Float, Integer, DateTime, JSON, Text
from sqlalchemy.orm import relationship

from .database import Base, utcnow


class Usuario(Base):
    __tablename__ = "usuarios"
    id = Column(String, primary_key=True)
    uid = Column(String, unique=True, nullable=False)
    codigo_empleado = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    nombres = Column(String, nullable=False)
    apellidos = Column(String, nullable=False)
    rol = Column(String, default="asesor")
    perfil = Column(String, default="operador")
    agencia_id = Column(String, default="agencia-piura-01")


class Cliente(Base):
    __tablename__ = "clientes"
    id = Column(String, primary_key=True)
    documento = Column(String, index=True)
    nombres = Column(String)
    apellidos = Column(String)
    telefono = Column(String)
    distrito = Column(String)
    negocio = Column(String)
    ingreso_mensual = Column(Float, default=0)
    gasto_mensual = Column(Float, default=0)
    calificacion_sbs = Column(String, default="NORMAL")


class SolicitudCredito(Base):
    __tablename__ = "solicitudes_credito"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    numero_expediente = Column(String, index=True)
    canal = Column(String)
    asesor_id = Column(String, index=True)
    cliente_id = Column(String, index=True)
    cliente_nombre = Column(String)
    dni = Column(String, index=True)
    producto = Column(String, default="credito_empresarial_microempresa")
    monto_solicitado = Column(Float)
    plazo_meses = Column(Integer)
    tea = Column(Float)
    cuota_referencia = Column(Float, default=0)
    estado = Column(String, index=True)
    caso_numero = Column(Integer)
    monto_aprobado = Column(Float)
    motivo_rechazo = Column(Text)
    motivo_condicion = Column(Text)
    decision_comite = Column(String)
    credito_id = Column(String)
    notas = Column(JSON, default=list)
    buro = Column(JSON)
    pre_evaluacion = Column(JSON)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    decision_at = Column(DateTime)
    desembolsado_at = Column(DateTime)


class CarteraDiaria(Base):
    __tablename__ = "cartera_diaria"
    id = Column(String, primary_key=True)
    asesor_id = Column(String, index=True)
    cliente_id = Column(String)
    solicitud_id = Column(String)
    fecha = Column(String, index=True)
    tipo_gestion = Column(String)
    monto_credito = Column(Float)
    prioridad = Column(String)
    score_prioridad = Column(Integer, default=0)
    estado_visita = Column(String, default="pendiente")
    resultado_visita = Column(String)
    observacion_visita = Column(Text)
    orden_manual = Column(Integer, default=0)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class Credito(Base):
    __tablename__ = "creditos"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    cliente_id = Column(String, index=True)
    solicitud_id = Column(String)
    numero_credito = Column(String)
    monto_otorgado = Column(Float)
    saldo_capital = Column(Float)
    plazo_meses = Column(Integer)
    tasa_interes = Column(Float)
    cuota_mensual = Column(Float)
    estado = Column(String, default="vigente")
    cronograma = Column(JSON, default=list)
    created_at = Column(DateTime, default=utcnow)
