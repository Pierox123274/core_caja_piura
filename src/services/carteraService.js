import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { requireUser } from './authService.js'

function fechaKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function fetchCliente(clienteId) {
  const snap = await getDoc(doc(db, 'clientes', clienteId))
  return snap.exists() ? snap.data() : null
}

/** Incorpora solicitudes `enviado` del canal cliente a cartera del día (igual que Flutter). */
export async function syncEnviadasACartera() {
  const user = requireUser()
  const q = query(
    collection(db, 'solicitudes_credito'),
    where('asesor_id', '==', user.id),
    where('estado', '==', 'enviado'),
  )
  const snap = await getDocs(q)
  const today = fechaKey()
  const batch = writeBatch(db)

  for (const docSnap of snap.docs) {
    const s = docSnap.data()
    const casoNum = s.caso_numero || 0
    const carteraId = `cd-caso-${casoNum}`
    batch.set(
      doc(db, 'cartera_diaria', carteraId),
      {
        asesor_id: user.id,
        cliente_id: s.cliente_id,
        solicitud_id: docSnap.id,
        fecha: today,
        tipo_gestion: 'nueva_solicitud',
        monto_credito: s.monto_solicitado,
        prioridad: 'normal',
        score_prioridad: 70,
        estado_visita: 'pendiente',
        orden_manual: casoNum,
        updated_at: serverTimestamp(),
      },
      { merge: true },
    )
  }
  if (!snap.empty) await batch.commit()
  return snap.size
}

export async function listarCartera(fecha) {
  const user = requireUser()
  await syncEnviadasACartera()
  const f = fecha || fechaKey()
  const q = query(
    collection(db, 'cartera_diaria'),
    where('asesor_id', '==', user.id),
    where('fecha', '==', f),
  )
  const snap = await getDocs(q)
  const items = []
  for (const d of snap.docs) {
    const row = d.data()
    const cliente = await fetchCliente(row.cliente_id)
    items.push({
      id: d.id,
      cliente_id: row.cliente_id,
      solicitud_id: row.solicitud_id,
      cliente_nombre: cliente
        ? `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim()
        : 'Cliente',
      documento: cliente?.documento || '',
      tipo_gestion: row.tipo_gestion || 'seguimiento',
      monto_credito: row.monto_credito || 0,
      prioridad: row.prioridad || 'normal',
      estado_visita: row.estado_visita || 'pendiente',
      distrito: cliente?.distrito || '',
      orden_manual: row.orden_manual || 0,
    })
  }
  items.sort((a, b) => (a.orden_manual || 0) - (b.orden_manual || 0))
  return items
}

export async function marcarVisita(carteraId, { resultado, observacion }) {
  await updateDoc(doc(db, 'cartera_diaria', carteraId), {
    estado_visita: resultado === 'visitado' ? 'visitado' : resultado,
    resultado_visita: resultado,
    observacion_visita: observacion || '',
    updated_at: serverTimestamp(),
  })
  return { ok: true }
}
