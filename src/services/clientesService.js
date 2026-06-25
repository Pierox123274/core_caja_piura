import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { api, useApi } from './apiClient.js'

export async function obtenerFicha(clienteId) {
  if (useApi()) return api(`/api/clientes/${clienteId}/ficha`)
  const clienteSnap = await getDoc(doc(db, 'clientes', clienteId))
  if (!clienteSnap.exists()) throw new Error('Cliente no encontrado')
  const c = clienteSnap.data()

  const creditosQ = query(collection(db, 'creditos'), where('cliente_id', '==', clienteId))
  const creditosSnap = await getDocs(creditosQ)
  const creditos = creditosSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const solQ = query(collection(db, 'solicitudes_credito'), where('cliente_id', '==', clienteId))
  const solSnap = await getDocs(solQ)

  return {
    id: clienteId,
    nombres: c.nombres,
    apellidos: c.apellidos,
    nombre_completo: `${c.nombres || ''} ${c.apellidos || ''}`.trim(),
    documento: c.documento,
    telefono: c.telefono,
    distrito: c.distrito,
    negocio: c.negocio,
    ingreso_mensual: c.ingreso_mensual,
    gasto_mensual: c.gasto_mensual,
    calificacion_sbs: c.calificacion_sbs || 'NORMAL',
    creditos,
    solicitudes: solSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    deuda_total: creditos.reduce((a, cr) => a + (cr.saldo_capital || 0), 0),
  }
}
