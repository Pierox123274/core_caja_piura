import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config.js'

export const USER_KEY = 'cp_user'

/** Misma convención que app_fuerza_ventas (SalesMockData.emailFromCodigo). */
export function emailFromCodigo(codigo) {
  const c = String(codigo).trim()
  if (c === '900001') return 'supervisor@cajapiura.demo'
  return `asesor.${c}@cajapiura.demo`
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(USER_KEY)
}

export async function login(codigoEmpleado, password) {
  const email = emailFromCodigo(codigoEmpleado)
  const cred = await signInWithEmailAndPassword(auth, email, password)
  const snap = await getDoc(doc(db, 'usuarios', cred.user.uid))
  const data = snap.data() || {}

  if (data.rol !== 'asesor') {
    await fbSignOut(auth)
    throw new Error('Acceso restringido al personal de fuerza de ventas.')
  }

  const user = {
    uid: cred.user.uid,
    id: data.asesor_id || 'asesor-001',
    codigo_empleado: data.documento || codigoEmpleado,
    nombres: data.nombres || 'Asesor',
    apellidos: data.apellidos || '',
    nombre: `${data.nombres || ''} ${data.apellidos || ''}`.trim(),
    perfil: data.perfil || 'operador',
    agencia_id: data.agencia_id || 'agencia-piura-01',
    email: cred.user.email,
  }
  saveUser(user)
  return { user, token: await cred.user.getIdToken() }
}

export async function logout() {
  clearSession()
  await fbSignOut(auth)
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
      clearSession()
      callback(null)
      return
    }
    let user = getStoredUser()
    if (!user || user.uid !== fbUser.uid) {
      const snap = await getDoc(doc(db, 'usuarios', fbUser.uid))
      const data = snap.data() || {}
      user = {
        uid: fbUser.uid,
        id: data.asesor_id || 'asesor-001',
        codigo_empleado: data.documento,
        nombres: data.nombres,
        apellidos: data.apellidos,
        nombre: `${data.nombres || ''} ${data.apellidos || ''}`.trim(),
        perfil: data.perfil || 'operador',
        agencia_id: data.agencia_id || 'agencia-piura-01',
        email: fbUser.email,
      }
      saveUser(user)
    }
    callback(user)
  })
}

export function requireUser() {
  const user = getStoredUser()
  if (!user) throw new Error('Sesión expirada. Vuelva a iniciar sesión.')
  return user
}
