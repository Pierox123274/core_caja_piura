import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { byDocumento } from './practiceCases.js'
import { cuotaFija } from './creditCalculator.js'

export function consultarBuro({ documento }) {
  const caso = byDocumento(documento)
  if (!caso) {
    const digit = Number(String(documento).slice(-1)) || 0
    return {
      calificacion: digit === 7 ? 'PERDIDA' : 'NORMAL',
      entidades_con_deuda: 1,
      deuda_total: 6000,
      dias_mayor_mora: 0,
      en_lista_inhabilitados: digit === 7,
      bloquea_solicitud: digit === 7,
      interpretacion: 'Buró simulado (documento no catalogado)',
    }
  }
  const labels = {
    normal: 'NORMAL',
    cpp: 'CPP',
    deficiente: 'DEFICIENTE',
    dudoso: 'DUDOSO',
    perdida: 'PERDIDA',
  }
  return {
    calificacion: labels[caso.buro] || 'NORMAL',
    entidades_con_deuda: caso.buroEntidades,
    deuda_total: caso.buroDeudaTotal,
    dias_mayor_mora: caso.buroDiasMora,
    en_lista_inhabilitados: caso.buroInhabilitado,
    bloquea_solicitud: caso.buroInhabilitado,
    motivo_bloqueo: caso.buroInhabilitado ? caso.motivoDecision : null,
    interpretacion: `Buró ${labels[caso.buro]}: ${caso.buroEntidades} entidad(es), deuda S/ ${caso.buroDeudaTotal.toFixed(2)}`,
  }
}

export function preEvaluar({ documento, ingreso, gasto, monto, plazo_meses, tea }) {
  const caso = byDocumento(documento)
  const cuota = cuotaFija(monto, plazo_meses, tea || 40.92)
  const disponible = ingreso - gasto
  const ratio = disponible <= 0 ? 999 : cuota / disponible

  if (caso) {
    const map = { apto: 'apto', revisar: 'revisar', noProcede: 'no_procede' }
    return {
      resultado: map[caso.preEval] || 'revisar',
      puntaje: caso.puntajePreEval,
      ratio,
      cuota_estimada: cuota,
      capacidad_disponible: disponible,
    }
  }
  if (ratio > 0.5) return { resultado: 'no_procede', puntaje: 45, ratio, cuota_estimada: cuota, capacidad_disponible: disponible }
  if (ratio > 0.35) return { resultado: 'revisar', puntaje: 60, ratio, cuota_estimada: cuota, capacidad_disponible: disponible }
  return { resultado: 'apto', puntaje: 85, ratio, cuota_estimada: cuota, capacidad_disponible: disponible }
}

export async function guardarBuroEnSolicitud(solicitudId, buro) {
  await updateDoc(doc(db, 'solicitudes_credito', solicitudId), {
    buro,
    buro_consultado_at: serverTimestamp(),
  })
}

export async function guardarPreEvalEnSolicitud(solicitudId, pre) {
  await updateDoc(doc(db, 'solicitudes_credito', solicitudId), {
    pre_evaluacion: pre,
    updated_at: serverTimestamp(),
  })
}
