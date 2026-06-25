import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { requireUser } from './authService.js'
import { api, useApi } from './apiClient.js'

export async function listarMora() {
  if (useApi()) return api('/api/cobranza/mora')
  requireUser()
  const snap = await getDocs(
    query(collection(db, 'creditos'), where('estado', '==', 'vigente')),
  )
  const items = []
  for (const d of snap.docs) {
    const c = d.data()
    if ((c.saldo_capital || 0) <= 0) continue
    const clienteSnap = await getDoc(doc(db, 'clientes', c.cliente_id))
    const cl = clienteSnap.exists() ? clienteSnap.data() : {}
    items.push({
      id: d.id,
      cliente_id: c.cliente_id,
      cliente_nombre: `${cl.nombres || ''} ${cl.apellidos || ''}`.trim(),
      documento: cl.documento,
      saldo: c.saldo_capital,
      cuota_mensual: c.cuota_mensual,
      dias_mora: 15,
    })
  }
  return items
}

export async function registrarAccion(payload) {
  if (useApi()) {
    return api('/api/cobranza/accion', { method: 'POST', body: JSON.stringify(payload) })
  }
  return { ok: true, ...payload, at: new Date().toISOString() }
}
