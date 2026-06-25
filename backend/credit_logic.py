import json
import math
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path

CASES_PATH = Path(__file__).parent / "practice_cases.json"


@lru_cache
def load_practice_cases():
    if not CASES_PATH.exists():
        return []
    return json.loads(CASES_PATH.read_text(encoding="utf-8"))


def by_documento(documento: str):
    doc = str(documento).strip()
    for c in load_practice_cases():
        if c["documento"] == doc:
            return c
    return None


def by_numero(numero: int):
    for c in load_practice_cases():
        if c["numero"] == numero:
            return c
    return None


def tem_from_tea(tea_percent: float) -> float:
    return (1 + tea_percent / 100) ** (1 / 12) - 1


def cuota_fija(monto: float, plazo_meses: int, tea_percent: float) -> float:
    if plazo_meses <= 0 or monto <= 0:
        return 0.0
    tem = tem_from_tea(tea_percent)
    if tem == 0:
        return monto / plazo_meses
    factor = (1 + tem) ** plazo_meses
    return (monto * tem * factor) / (factor - 1)


def cronograma(monto: float, plazo_meses: int, tea_percent: float, fecha_base=None):
    fecha_base = fecha_base or datetime.utcnow()
    tem = tem_from_tea(tea_percent)
    cuota = cuota_fija(monto, plazo_meses, tea_percent)
    saldo = monto
    rows = []
    for n in range(1, plazo_meses + 1):
        interes = saldo * tem
        capital = cuota - interes
        saldo = max(0.0, saldo - capital)
        venc = fecha_base + timedelta(days=30 * n)
        rows.append(
            {
                "numero": n,
                "fecha_vencimiento": venc.strftime("%Y-%m-%d"),
                "cuota": round(cuota, 2),
                "capital": round(capital, 2),
                "interes": round(interes, 2),
                "saldo": round(saldo, 2),
            }
        )
    return rows


def consultar_buro(documento: str):
    caso = by_documento(documento)
    if not caso:
        digit = int(str(documento)[-1]) if documento else 0
        return {
            "calificacion": "PERDIDA" if digit == 7 else "NORMAL",
            "calificacion_sbs": "PERDIDA" if digit == 7 else "NORMAL",
            "entidades_con_deuda": 1,
            "deuda_total": 6000,
            "dias_mayor_mora": 0,
            "en_lista_inhabilitados": digit == 7,
            "bloquea_solicitud": digit == 7,
            "interpretacion": "Buró simulado (documento no catalogado)",
        }
    labels = {
        "normal": "NORMAL",
        "cpp": "CPP",
        "deficiente": "DEFICIENTE",
        "dudoso": "DUDOSO",
        "perdida": "PERDIDA",
    }
    label = labels.get(caso["buro"], "NORMAL")
    return {
        "calificacion": label,
        "calificacion_sbs": label,
        "entidades_con_deuda": caso["buroEntidades"],
        "deuda_total": caso["buroDeudaTotal"],
        "dias_mayor_mora": caso["buroDiasMora"],
        "en_lista_inhabilitados": caso["buroInhabilitado"],
        "bloquea_solicitud": caso["buroInhabilitado"],
        "motivo_bloqueo": caso["motivoDecision"] if caso["buroInhabilitado"] else None,
        "interpretacion": (
            f"Buró {label}: {caso['buroEntidades']} entidad(es), "
            f"deuda S/ {caso['buroDeudaTotal']:.2f}"
        ),
    }


def pre_evaluar(documento, ingreso, gasto, monto, plazo_meses=12, tea=40.92):
    caso = by_documento(documento or "")
    cuota = cuota_fija(float(monto or 0), int(plazo_meses or 12), float(tea or 40.92))
    ingreso = float(ingreso or 0)
    gasto = float(gasto or 0)
    disponible = ingreso - gasto
    ratio = 999 if disponible <= 0 else cuota / disponible

    if caso:
        mapa = {"apto": "APTO", "revisar": "REVISAR", "noProcede": "NO_PROCEDE"}
        cal = mapa.get(caso["preEval"], "REVISAR")
        return {
            "calificacion": cal,
            "resultado": caso["preEval"],
            "puntaje": caso["puntajePreEval"],
            "ratio": ratio,
            "cuota_estimada": cuota,
            "capacidad_disponible": disponible,
            "motivo": f"Evaluación según caso de práctica #{caso['numero']}.",
        }
    if ratio > 0.5:
        cal = "NO_PROCEDE"
        puntaje = 45
    elif ratio > 0.35:
        cal = "REVISAR"
        puntaje = 60
    else:
        cal = "APTO"
        puntaje = 85
    return {
        "calificacion": cal,
        "resultado": cal.lower(),
        "puntaje": puntaje,
        "ratio": ratio,
        "cuota_estimada": cuota,
        "capacidad_disponible": disponible,
        "motivo": "Capacidad de pago estimada según ingresos y cuota.",
    }
