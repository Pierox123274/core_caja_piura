import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { requireUser } from './authService.js'
import { api, useApi } from './apiClient.js'
import { cuotaFija, cronograma } from './creditCalculator.js'
import { byDocumento, byNumero } from './practiceCases.js'

export async function listarSolicitudes() {
  if (useApi()) return api('/api/solicitudes')
  const user = requireUser()
  const q = query(
    collection(db, 'solicitudes_credito'),
    where('asesor_id', '==', user.id),
    orderBy('created_at', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function obtenerSolicitud(id) {
  if (useApi()) return api(`/api/solicitudes/${id}`)
  const snap = await getDoc(doc(db, 'solicitudes_credito', id))
  if (!snap.exists()) throw new Error('Solicitud no encontrada')
  return { id: snap.id, ...snap.data() }
}

export async function crearSolicitud(payload) {
  if (useApi()) {
    return api('/api/solicitudes', { method: 'POST', body: JSON.stringify(payload) })
  }
  const user = requireUser()
  const dni = payload.dni || payload.numero_documento
  const caso = byDocumento(dni)
  const expediente = `EXP-${new Date().getFullYear()}-WEB-${String(dni).slice(-4)}`
  const ref = doc(collection(db, 'solicitudes_credito'))
  const tea = payload.tea || payload.tea_referencial || 40.92
  const monto = payload.monto || payload.monto_solicitado
  const cuota = cuotaFija(monto, payload.plazo_meses, tea)
  const clienteNombre =
    payload.cliente_nombre ||
    `${payload.nombres || ''} ${payload.apellidos || ''}`.trim()

  await setDoc(ref, {
    numero_expediente: expediente,
    canal: 'asesor_web',
    asesor_id: user.id,
    cliente_id: caso?.clienteId || `web-${dni}`,
    cliente_nombre: clienteNombre,
    dni,
    producto: 'credito_empresarial_microempresa',
    monto_solicitado: Number(monto),
    plazo_meses: Number(payload.plazo_meses),
    tea,
    cuota_referencia: cuota,
    estado: 'recibido_comite',
    caso_numero: caso?.numero,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  })
  return { id: ref.id, numero_expediente: expediente }
}

export async function listarNotas(solicitudId) {
  if (useApi()) return api(`/api/solicitudes/${solicitudId}/notas`)
  const s = await obtenerSolicitud(solicitudId)
  return s.notas || []
}

export async function agregarNota(solicitudId, contenido) {
  if (useApi()) {
    return api(`/api/solicitudes/${solicitudId}/notas`, {
      method: 'POST',
      body: JSON.stringify({ contenido }),
    })
  }
  const s = await obtenerSolicitud(solicitudId)
  const notas = [...(s.notas || []), { contenido, at: new Date().toISOString() }]
  await updateDoc(doc(db, 'solicitudes_credito', solicitudId), { notas })
  return notas
}

export async function procesarComite(solicitudId) {
  if (useApi()) {
    return api(`/api/solicitudes/${solicitudId}/comite`, { method: 'POST' })
  }
  const s = await obtenerSolicitud(solicitudId)
  const caso = byDocumento(s.dni) || (s.caso_numero ? byNumero(s.caso_numero) : null)
  if (!caso) throw new Error('DNI no corresponde a un caso de práctica (1-30)')

  if (caso.buroInhabilitado) {
    await updateDoc(doc(db, 'solicitudes_credito', solicitudId), {
      estado: 'rechazado',
      motivo_rechazo: caso.motivoDecision,
      decision_comite: 'rechazado',
      decision_at: serverTimestamp(),
    })
    return { estado: 'rechazado' }
  }

  await updateDoc(doc(db, 'solicitudes_credito', solicitudId), {
    documentos_completos: true,
    estado: 'en_evaluacion',
    updated_at: serverTimestamp(),
  })

  const estadoFinal =
    caso.decision === 'aprobado'
      ? 'aprobado'
      : caso.decision === 'condicionado'
        ? 'condicionado'
        : 'rechazado'

  await updateDoc(doc(db, 'solicitudes_credito', solicitudId), {
    estado: estadoFinal,
    decision_comite: estadoFinal,
    monto_aprobado: caso.montoAprobado,
    motivo_condicion: caso.decision === 'condicionado' ? caso.motivoDecision : null,
    motivo_rechazo: caso.decision === 'rechazado' ? caso.motivoDecision : null,
    decision_at: serverTimestamp(),
  })

  if (estadoFinal === 'aprobado' || estadoFinal === 'condicionado') {
    const plan = cronograma(caso.montoAprobado, caso.plazoMeses, caso.tea)
    const creditoRef = doc(collection(db, 'creditos'))
    const batch = writeBatch(db)
    batch.set(creditoRef, {
      cliente_id: caso.clienteId,
      solicitud_id: solicitudId,
      numero_credito: `CR-${caso.numero}-${new Date().getFullYear()}`,
      monto_otorgado: caso.montoAprobado,
      saldo_capital: caso.montoAprobado,
      plazo_meses: caso.plazoMeses,
      tasa_interes: caso.tea,
      cuota_mensual: plan[0]?.cuota || 0,
      estado: 'vigente',
      created_at: serverTimestamp(),
    })
    plan.forEach((c) => {
      batch.set(doc(creditoRef, 'cronograma', `cuota-${c.numero}`), {
        ...c,
        estado: 'pendiente',
      })
    })
    batch.update(doc(db, 'solicitudes_credito', solicitudId), {
      estado: 'desembolsado',
      credito_id: creditoRef.id,
      desembolsado_at: serverTimestamp(),
    })
    await batch.commit()
    return { estado: 'desembolsado', monto: caso.montoAprobado }
  }

  return { estado: estadoFinal }
}
