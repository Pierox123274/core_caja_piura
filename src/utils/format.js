// Utilidades de formato para el portal del personal (Core Mobile).
// El backend devuelve montos como números y fechas ISO.

/** Formatea un monto a moneda peruana: "S/ 1,234.56". */
export function formatMoney(value, { simbolo = 'S/' } = {}) {
  const n = toNumber(value)
  const formatted = n.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${simbolo} ${formatted}`
}

/** Formatea un monto compacto sin decimales: "S/ 8,500". */
export function formatMoneyShort(value, { simbolo = 'S/' } = {}) {
  const n = toNumber(value)
  return `${simbolo} ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`
}

/** Convierte un valor string/number a Number de forma segura. */
export function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return value
  const n = parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Convierte Timestamp de Firestore, ISO string o Date a Date de JS. */
export function toJsDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value?.toDate === 'function') return value.toDate()
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000)
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Formatea una fecha ISO ("2026-06-03"), Timestamp Firestore o Date a "dd/mm/yyyy". */
export function formatDate(value) {
  const d = toJsDate(value)
  if (!d) {
    const m = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return `${m[3]}/${m[2]}/${m[1]}`
    return '—'
  }
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

/** Formatea una fecha+hora a "dd/mm/yyyy HH:MM". */
export function formatDateTime(value) {
  const d = toJsDate(value)
  if (!d) return formatDate(value)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`
}

/** Formatea un porcentaje: "85.0%". */
export function formatPct(value) {
  if (value === null || value === undefined || value === '') return '—'
  const n = toNumber(value)
  return `${n.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

/** Iniciales para el avatar: "Carlos Ramirez" -> "CR". */
export function iniciales(nombre = '') {
  const parts = String(nombre).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '—'
  const a = parts[0]?.[0] || ''
  const b = parts[1]?.[0] || ''
  return (a + b).toUpperCase()
}

/** Convierte una etiqueta tipo "RECUPERACION_MORA" en "Recuperación mora". */
export function humanizar(value = '') {
  if (!value) return '—'
  return String(value)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase())
}

/** Extrae mensaje legible (Firebase, axios u otros). */
export function extractError(err, fallback = 'Ocurrió un error. Intente nuevamente.') {
  const code = err?.code
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return 'Código o contraseña incorrectos.'
  }
  if (code === 'auth/user-not-found') return 'Usuario no registrado en Firebase.'
  if (code === 'permission-denied') {
    return 'Sin permisos en Firestore. Verifique que su perfil de asesor esté activo.'
  }
  if (err?.message?.includes('Firebase')) return err.message
  const detail = err?.response?.data?.detail
  if (detail == null) {
    if (err?.message === 'Network Error') {
      return 'Sin conexión. Verifique internet y la configuración de Firebase.'
    }
    return err?.message || fallback
  }
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((d) => d?.msg || 'Dato inválido').join(' · ')
  }
  if (typeof detail === 'object') return JSON.stringify(detail)
  return fallback
}
