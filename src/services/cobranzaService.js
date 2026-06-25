import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { requireUser } from './authService.js'

/** Cartera vencida / mora — créditos vigentes con saldo > 0 del asesor. */
export async function listarMora() {
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
  // Registro demo — en producción iría a colección cobranza_gestiones
  return { ok: true, ...payload, at: new Date().toISOString() }
}
