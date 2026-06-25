"""Caja Piura API — FastAPI + PostgreSQL (Neon)."""

import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import Depends, FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .auth import hash_password, verify_password
from .credit_logic import (
    by_documento,
    by_numero,
    consultar_buro,
    cronograma,
    cuota_fija,
    pre_evaluar,
)
from .database import get_db, init_db, seed_if_empty, utcnow
from .models import CarteraDiaria, Cliente, Credito, SolicitudCredito, Usuario

JWT_SECRET = os.environ.get("JWT_SECRET", "caja-piura-demo-secret-change-in-prod")
JWT_ALG = "HS256"
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")

app = FastAPI(title="Caja Piura API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()
    seed_if_empty()


def fecha_key(d=None):
    d = d or utcnow()
    return d.strftime("%Y-%m-%d")


def user_payload(u: Usuario) -> dict:
    return {
        "uid": u.uid,
        "id": u.id,
        "codigo_empleado": u.codigo_empleado,
        "nombres": u.nombres,
        "apellidos": u.apellidos,
        "nombre": f"{u.nombres} {u.apellidos}".strip(),
        "perfil": u.perfil,
        "agencia_id": u.agencia_id,
        "email": u.email,
    }


def create_token(user: Usuario) -> str:
    return jwt.encode(
        {"sub": user.id, "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7},
        JWT_SECRET,
        algorithm=JWT_ALG,
    )


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Usuario:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Sesión expirada. Vuelva a iniciar sesión.")
    token = authorization[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(401, "Token inválido")
    user = db.get(Usuario, user_id)
    if not user or user.rol != "asesor":
        raise HTTPException(403, "Acceso restringido al personal de fuerza de ventas.")
    return user


class LoginBody(BaseModel):
    codigo: str
    password: str


@app.get("/health")
def health():
    return {"status": "ok", "service": "caja-piura-api"}


@app.post("/api/auth/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    codigo = body.codigo.strip()
    user = db.query(Usuario).filter(Usuario.codigo_empleado == codigo).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Código o contraseña incorrectos")
    token = create_token(user)
    return {"user": user_payload(user), "token": token}


@app.get("/api/auth/me")
def me(user: Usuario = Depends(get_current_user)):
    return user_payload(user)


def sol_dict(s: SolicitudCredito) -> dict:
    return {
        "id": s.id,
        "numero_expediente": s.numero_expediente,
        "canal": s.canal,
        "asesor_id": s.asesor_id,
        "cliente_id": s.cliente_id,
        "cliente_nombre": s.cliente_nombre,
        "dni": s.dni,
        "producto": s.producto,
        "monto_solicitado": s.monto_solicitado,
        "plazo_meses": s.plazo_meses,
        "tea": s.tea,
        "cuota_referencia": s.cuota_referencia,
        "estado": s.estado,
        "caso_numero": s.caso_numero,
        "monto_aprobado": s.monto_aprobado,
        "motivo_rechazo": s.motivo_rechazo,
        "notas": s.notas or [],
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        "decision_at": s.decision_at.isoformat() if s.decision_at else None,
        "desembolsado_at": s.desembolsado_at.isoformat() if s.desembolsado_at else None,
    }


@app.get("/api/solicitudes")
def listar_solicitudes(user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(SolicitudCredito)
        .filter(SolicitudCredito.asesor_id == user.id)
        .order_by(SolicitudCredito.created_at.desc())
        .all()
    )
    return [sol_dict(s) for s in rows]


@app.get("/api/solicitudes/{solicitud_id}")
def obtener_solicitud(solicitud_id: str, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    s = db.get(SolicitudCredito, solicitud_id)
    if not s or s.asesor_id != user.id:
        raise HTTPException(404, "Solicitud no encontrada")
    return sol_dict(s)


@app.post("/api/solicitudes")
def crear_solicitud(payload: dict, user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    dni = payload.get("dni") or payload.get("numero_documento")
    if not dni:
        raise HTTPException(400, "DNI requerido")
    caso = by_documento(dni)
    nombres = payload.get("nombres", "")
    apellidos = payload.get("apellidos", "")
    cliente_nombre = payload.get("cliente_nombre") or f"{nombres} {apellidos}".strip()
    monto = float(payload.get("monto") or payload.get("monto_solicitado") or 0)
    plazo = int(payload.get("plazo_meses") or 12)
    tea = float(payload.get("tea") or payload.get("tea_referencial") or 40.92)
    expediente = f"EXP-{utcnow().year}-WEB-{str(dni)[-4:]}"
    sol_id = str(uuid.uuid4())
    cuota = cuota_fija(monto, plazo, tea)
    s = SolicitudCredito(
        id=sol_id,
        numero_expediente=expediente,
        canal="asesor_web",
        asesor_id=user.id,
        cliente_id=caso["clienteId"] if caso else f"web-{dni}",
        cliente_nombre=cliente_nombre,
        dni=str(dni),
        monto_solicitado=monto,
        plazo_meses=plazo,
        tea=tea,
        cuota_referencia=cuota,
        estado="recibido_comite",
        caso_numero=caso["numero"] if caso else None,
        notas=[],
    )
    db.add(s)
    db.commit()
    return {"id": sol_id, "numero_expediente": expediente}


@app.get("/api/solicitudes/{solicitud_id}/notas")
def listar_notas(solicitud_id: str, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    s = db.get(SolicitudCredito, solicitud_id)
    if not s or s.asesor_id != user.id:
        raise HTTPException(404, "Solicitud no encontrada")
    return s.notas or []


class NotaBody(BaseModel):
    contenido: str


@app.post("/api/solicitudes/{solicitud_id}/notas")
def agregar_nota(
    solicitud_id: str,
    body: NotaBody,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    s = db.get(SolicitudCredito, solicitud_id)
    if not s or s.asesor_id != user.id:
        raise HTTPException(404, "Solicitud no encontrada")
    notas = list(s.notas or [])
    notas.append({"contenido": body.contenido, "at": utcnow().isoformat()})
    s.notas = notas
    s.updated_at = utcnow()
    db.commit()
    return notas


@app.post("/api/solicitudes/{solicitud_id}/comite")
def procesar_comite(solicitud_id: str, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    s = db.get(SolicitudCredito, solicitud_id)
    if not s or s.asesor_id != user.id:
        raise HTTPException(404, "Solicitud no encontrada")
    caso = by_documento(s.dni) or (by_numero(s.caso_numero) if s.caso_numero else None)
    if not caso:
        raise HTTPException(400, "DNI no corresponde a un caso de práctica (1-30)")

    now = utcnow()
    if caso["buroInhabilitado"]:
        s.estado = "rechazado"
        s.motivo_rechazo = caso.get("motivoDecision")
        s.decision_comite = "rechazado"
        s.decision_at = now
        db.commit()
        return {"estado": "rechazado"}

    s.estado = "en_evaluacion"
    s.updated_at = now

    estado_final = caso["decision"]
    if estado_final == "aprobado":
        s.estado = "aprobado"
    elif estado_final == "condicionado":
        s.estado = "condicionado"
    else:
        s.estado = "rechazado"
    s.decision_comite = s.estado
    s.monto_aprobado = caso["montoAprobado"]
    s.motivo_condicion = caso["motivoDecision"] if estado_final == "condicionado" else None
    s.motivo_rechazo = caso["motivoDecision"] if estado_final == "rechazado" else None
    s.decision_at = now

    if s.estado in ("aprobado", "condicionado"):
        plan = cronograma(caso["montoAprobado"], caso["plazoMeses"], caso["tea"])
        credito_id = str(uuid.uuid4())
        credito = Credito(
            id=credito_id,
            cliente_id=caso["clienteId"],
            solicitud_id=solicitud_id,
            numero_credito=f"CR-{caso['numero']}-{utcnow().year}",
            monto_otorgado=caso["montoAprobado"],
            saldo_capital=caso["montoAprobado"],
            plazo_meses=caso["plazoMeses"],
            tasa_interes=caso["tea"],
            cuota_mensual=plan[0]["cuota"] if plan else 0,
            estado="vigente",
            cronograma=[{**c, "estado": "pendiente"} for c in plan],
        )
        db.add(credito)
        s.estado = "desembolsado"
        s.credito_id = credito_id
        s.desembolsado_at = now
        db.commit()
        return {"estado": "desembolsado", "monto": caso["montoAprobado"]}

    db.commit()
    return {"estado": s.estado}


def sync_enviadas(user: Usuario, db: Session):
    today = fecha_key()
    rows = (
        db.query(SolicitudCredito)
        .filter(SolicitudCredito.asesor_id == user.id, SolicitudCredito.estado == "enviado")
        .all()
    )
    for s in rows:
        caso_num = s.caso_numero or 0
        cartera_id = f"cd-caso-{caso_num}"
        existing = db.get(CarteraDiaria, cartera_id)
        if existing:
            existing.solicitud_id = s.id
            existing.monto_credito = s.monto_solicitado
            existing.updated_at = utcnow()
        else:
            db.add(
                CarteraDiaria(
                    id=cartera_id,
                    asesor_id=user.id,
                    cliente_id=s.cliente_id,
                    solicitud_id=s.id,
                    fecha=today,
                    tipo_gestion="nueva_solicitud",
                    monto_credito=s.monto_solicitado,
                    prioridad="normal",
                    score_prioridad=70,
                    estado_visita="pendiente",
                    orden_manual=caso_num,
                )
            )
    db.commit()
    return len(rows)


@app.get("/api/cartera")
def listar_cartera(
    fecha: Optional[str] = None,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sync_enviadas(user, db)
    f = fecha or fecha_key()
    rows = (
        db.query(CarteraDiaria)
        .filter(CarteraDiaria.asesor_id == user.id, CarteraDiaria.fecha == f)
        .all()
    )
    items = []
    for row in rows:
        cliente = db.get(Cliente, row.cliente_id)
        items.append(
            {
                "id": row.id,
                "cliente_id": row.cliente_id,
                "solicitud_id": row.solicitud_id,
                "cliente_nombre": (
                    f"{cliente.nombres} {cliente.apellidos}".strip() if cliente else "Cliente"
                ),
                "documento": cliente.documento if cliente else "",
                "tipo_gestion": row.tipo_gestion or "seguimiento",
                "monto_credito": row.monto_credito or 0,
                "prioridad": row.prioridad or "normal",
                "estado_visita": row.estado_visita or "pendiente",
                "distrito": cliente.distrito if cliente else "",
                "orden_manual": row.orden_manual or 0,
            }
        )
    items.sort(key=lambda x: x.get("orden_manual") or 0)
    return items


class VisitaBody(BaseModel):
    resultado: str
    observacion: Optional[str] = ""


@app.patch("/api/cartera/{cartera_id}/visita")
def marcar_visita(
    cartera_id: str,
    body: VisitaBody,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    row = db.get(CarteraDiaria, cartera_id)
    if not row or row.asesor_id != user.id:
        raise HTTPException(404, "Registro de cartera no encontrado")
    row.estado_visita = "visitado" if body.resultado == "visitado" else body.resultado
    row.resultado_visita = body.resultado
    row.observacion_visita = body.observacion or ""
    row.updated_at = utcnow()
    db.commit()
    return {"ok": True}


@app.get("/api/clientes/{cliente_id}/ficha")
def obtener_ficha(cliente_id: str, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    c = db.get(Cliente, cliente_id)
    if not c:
        raise HTTPException(404, "Cliente no encontrado")
    creditos = db.query(Credito).filter(Credito.cliente_id == cliente_id).all()
    solicitudes = db.query(SolicitudCredito).filter(SolicitudCredito.cliente_id == cliente_id).all()
    creditos_list = [
        {
            "id": cr.id,
            "numero_credito": cr.numero_credito,
            "monto_otorgado": cr.monto_otorgado,
            "saldo_capital": cr.saldo_capital,
            "cuota_mensual": cr.cuota_mensual,
            "estado": cr.estado,
        }
        for cr in creditos
    ]
    return {
        "id": cliente_id,
        "nombres": c.nombres,
        "apellidos": c.apellidos,
        "nombre_completo": f"{c.nombres or ''} {c.apellidos or ''}".strip(),
        "documento": c.documento,
        "telefono": c.telefono,
        "distrito": c.distrito,
        "negocio": c.negocio,
        "ingreso_mensual": c.ingreso_mensual,
        "gasto_mensual": c.gasto_mensual,
        "calificacion_sbs": c.calificacion_sbs or "NORMAL",
        "creditos": creditos_list,
        "solicitudes": [sol_dict(s) for s in solicitudes],
        "deuda_total": sum(cr.saldo_capital or 0 for cr in creditos),
    }


@app.post("/api/evaluacion/buro")
def api_buro(payload: dict):
    doc = payload.get("documento") or payload.get("dni") or ""
    return consultar_buro(str(doc))


@app.post("/api/evaluacion/preeval")
def api_preeval(payload: dict):
    doc = payload.get("documento") or payload.get("numero_documento") or ""
    ingreso = payload.get("ingreso") or payload.get("ingresos_estimados") or 0
    gasto = payload.get("gasto") or payload.get("gastos_estimados") or 0
    monto = payload.get("monto") or payload.get("monto_solicitado") or 0
    plazo = payload.get("plazo_meses") or 12
    tea = payload.get("tea") or payload.get("tea_referencial") or 40.92
    return pre_evaluar(doc, ingreso, gasto, monto, plazo, tea)


@app.get("/api/cobranza/mora")
def listar_mora(db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    _ = user
    creditos = db.query(Credito).filter(Credito.estado == "vigente").all()
    items = []
    for cr in creditos:
        if (cr.saldo_capital or 0) <= 0:
            continue
        cl = db.get(Cliente, cr.cliente_id)
        items.append(
            {
                "id": cr.id,
                "cliente_id": cr.cliente_id,
                "cliente_nombre": f"{cl.nombres or ''} {cl.apellidos or ''}".strip() if cl else "",
                "documento": cl.documento if cl else "",
                "saldo": cr.saldo_capital,
                "cuota_mensual": cr.cuota_mensual,
                "dias_mora": 15,
            }
        )
    return items


@app.post("/api/cobranza/accion")
def registrar_accion(payload: dict, user: Usuario = Depends(get_current_user)):
    return {"ok": True, **payload, "at": utcnow().isoformat(), "asesor": user.id}


@app.get("/api/reportes/productividad")
def productividad(user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    solicitudes = (
        db.query(SolicitudCredito).filter(SolicitudCredito.asesor_id == user.id).all()
    )
    cartera = listar_cartera(user=user, db=db)
    enviadas = len(solicitudes)
    aprobadas = len([s for s in solicitudes if s.estado in ("aprobado", "condicionado", "desembolsado")])
    desembolsadas = len([s for s in solicitudes if s.estado == "desembolsado"])
    monto = sum(s.monto_aprobado or 0 for s in solicitudes if s.estado == "desembolsado")
    visitas = len([c for c in cartera if c.get("estado_visita") != "pendiente"])
    return {
        "asesores": [
            {
                "nombre": f"{user.nombres} {user.apellidos}".strip(),
                "enviadas": enviadas,
                "aprobadas": aprobadas,
                "desembolsadas": desembolsadas,
                "monto": monto,
                "visitas_cartera": visitas,
            }
        ]
    }


@app.get("/api/dni/{dni}")
async def consultar_dni(dni: str):
    clean = "".join(c for c in dni if c.isdigit())
    if len(clean) != 8:
        raise HTTPException(400, "El DNI debe tener 8 dígitos")
    token = os.environ.get("DNI_API_TOKEN", "")
    base = os.environ.get("DNI_API_BASE_URL", "https://dniruc.apisperu.com/api/v1/dni")
    if not token:
        raise HTTPException(503, "API DNI no configurada")
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(f"{base}/{clean}", params={"token": token})
        data = res.json()
    if not data.get("success"):
        raise HTTPException(404, "DNI no encontrado en RENIEC")

    def title_case(s):
        return " ".join(w.capitalize() for w in str(s).split())

    nombres = title_case(data.get("nombres", ""))
    apellidos = title_case(f"{data.get('apellidoPaterno', '')} {data.get('apellidoMaterno', '')}")
    return {
        "dni": data.get("dni", clean),
        "nombres": nombres,
        "apellidos": apellidos,
        "nombreCompleto": f"{nombres} {apellidos}".strip(),
    }
