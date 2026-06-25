import json
import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://localhost/caja_piura")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def utcnow():
    return datetime.now(timezone.utc)


def init_db():
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)


def seed_if_empty():
    from .models import Usuario, Cliente, SolicitudCredito, CarteraDiaria
    from .auth import hash_password
    from .credit_logic import load_practice_cases

    db = SessionLocal()
    try:
        if db.query(Usuario).count() > 0:
            return
        cases = load_practice_cases()
        db.add(
            Usuario(
                id="asesor-001",
                uid="uid-asesor-001",
                codigo_empleado="100245",
                email="asesor.100245@cajapiura.demo",
                password_hash=hash_password("demo1234"),
                nombres="Carlos",
                apellidos="Mendoza Ríos",
                rol="asesor",
                perfil="operador",
                agencia_id="agencia-piura-01",
            )
        )
        db.add(
            Usuario(
                id="asesor-sup",
                uid="uid-supervisor",
                codigo_empleado="900001",
                email="supervisor@cajapiura.demo",
                password_hash=hash_password("demo1234"),
                nombres="Lucía",
                apellidos="Vega Torres",
                rol="asesor",
                perfil="supervisor",
                agencia_id="agencia-piura-01",
            )
        )
        for c in cases[:5]:
            db.add(
                Cliente(
                    id=c["clienteId"],
                    documento=c["documento"],
                    nombres=c["nombres"],
                    apellidos=c["apellidos"],
                    distrito=c["distrito"],
                    negocio=c["negocio"],
                    ingreso_mensual=c["ingresoMensual"],
                    gasto_mensual=c["gastoMensual"],
                )
            )
        db.commit()
        today = utcnow().strftime("%Y-%m-%d")
        asesor_id = "asesor-001"
        for i, c in enumerate(cases[:3], start=1):
            sol_id = f"sol-seed-{c['numero']}"
            db.add(
                SolicitudCredito(
                    id=sol_id,
                    numero_expediente=f"EXP-{utcnow().year}-00{c['numero']}",
                    canal="cliente",
                    asesor_id=asesor_id,
                    cliente_id=c["clienteId"],
                    cliente_nombre=f"{c['nombres']} {c['apellidos']}",
                    dni=c["documento"],
                    producto="credito_empresarial_microempresa",
                    monto_solicitado=c["montoSolicitado"],
                    plazo_meses=c["plazoMeses"],
                    tea=c["tea"],
                    cuota_referencia=0,
                    estado="enviado",
                    caso_numero=c["numero"],
                    notas=[],
                )
            )
            db.add(
                CarteraDiaria(
                    id=f"cd-caso-{c['numero']}",
                    asesor_id=asesor_id,
                    cliente_id=c["clienteId"],
                    solicitud_id=sol_id,
                    fecha=today,
                    tipo_gestion="renovacion" if i == 2 else "nueva_solicitud",
                    monto_credito=c["montoSolicitado"],
                    prioridad=c.get("prioridad", "normal"),
                    score_prioridad=70 + i * 5,
                    estado_visita="pendiente",
                    orden_manual=c["numero"],
                )
            )
        db.commit()
    finally:
        db.close()
