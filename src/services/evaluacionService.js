import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { api, useApi } from './apiClient.js'
import { byDocumento } from './practiceCases.js'
import { cuotaFija } from './creditCalculator.js'

function mapPreEval(r) {
  if (r.calificacion) return r
  const map = { apto: 'APTO', revisar: 'REVISAR', no_procede: 'NO_PROCEDE', noProcede: 'NO_PROCEDE' }
  const cal = map[r.resultado] || 'REVISAR'
  return {
    ...r,
    calificacion: cal,
    motivo: r.motivo || 'Capacidad de pago estimada según ingresos y cuota.',
  }
}

export async function consultarBuro({ documento, dni }) {
  const docId = documento || dni
  if (useApi()) {
    return api('/api/evaluacion/buro', {
      method: 'POST',
      body: JSON.stringify({ documento: docId, dni: docId }),
    })
  }
  const caso = byDocumento(docId)
  if (!caso) {
    const digit = Number(String(docId).slice(-1)) || 0
    return {
      calificacion: digit === 7 ? 'PERDIDA' : 'NORMAL',
      calificacion_sbs: digit === 7 ? 'PERDIDA' : 'NORMAL',
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
  const label = labels[caso.buro] || 'NORMAL'
  return {
    calificacion: label,
    calificacion_sbs: label,
    entidades_con_deuda: caso.buroEntidades,
    deuda_total: caso.buroDeudaTotal,
    dias_mayor_mora: caso.buroDiasMora,
    en_lista_inhabilitados: caso.buroInhabilitado,
    bloquea_solicitud: caso.buroInhabilitado,
    motivo_bloqueo: caso.buroInhabilitado ? caso.motivoDecision : null,
    interpretacion: `Buró ${label}: ${caso.buroEntidades} entidad(es), deuda S/ ${caso.buroDeudaTotal.toFixed(2)}`,
  }
}

export async function preEvaluar(payload) {
  if (useApi()) {
    const r = await api('/api/evaluacion/preeval', { method: 'POST', body: JSON.stringify(payload) })
    return mapPreEval(r)
  }
  const documento = payload.documento || payload.numero_documento
  const ingreso = payload.ingreso ?? payload.ingresos_estimados ?? 0
  const gasto = payload.gasto ?? payload.gastos_estimados ?? 0
  const monto = payload.monto ?? payload.monto_solicitado ?? 0
  const plazo_meses = payload.plazo_meses || 12
  const tea = payload.tea || payload.tea_referencial || 40.92
  const caso = byDocumento(documento)
  const cuota = cuotaFija(monto, plazo_meses, tea)
  const disponible = ingreso - gasto
  const ratio = disponible <= 0 ? 999 : cuota / disponible

  if (caso) {
    const map = { apto: 'apto', revisar: 'revisar', noProcede: 'no_procede' }
    return mapPreEval({
      resultado: map[caso.preEval] || 'revisar',
      puntaje: caso.puntajePreEval,
      ratio,
      cuota_estimada: cuota,
      capacidad_disponible: disponible,
      motivo: `Evaluación según caso de práctica #${caso.numero}.`,
    })
  }
  if (ratio > 0.5) {
    return mapPreEval({ resultado: 'no_procede', puntaje: 45, ratio, cuota_estimada: cuota, capacidad_disponible: disponible })
  }
  if (ratio > 0.35) {
    return mapPreEval({ resultado: 'revisar', puntaje: 60, ratio, cuota_estimada: cuota, capacidad_disponible: disponible })
  }
  return mapPreEval({ resultado: 'apto', puntaje: 85, ratio, cuota_estimada: cuota, capacidad_disponible: disponible })
}

export async function guardarBuroEnSolicitud(solicitudId, buro) {
  if (useApi()) return { ok: true }
  await updateDoc(doc(db, 'solicitudes_credito', solicitudId), {
    buro,
    buro_consultado_at: serverTimestamp(),
  })
}

export async function guardarPreEvalEnSolicitud(solicitudId, pre) {
  if (useApi()) return { ok: true }
  await updateDoc(doc(db, 'solicitudes_credito', solicitudId), {
    pre_evaluacion: pre,
    updated_at: serverTimestamp(),
  })
}
