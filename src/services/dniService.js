const BASE_URL =
  import.meta.env.VITE_DNI_API_BASE_URL || 'https://dniruc.apisperu.com/api/v1/dni'

const TOKEN = import.meta.env.VITE_DNI_API_TOKEN || ''

function titleCase(value) {
  return String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length === 1 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ')
}

/**
 * Consulta datos de persona por DNI (RENIEC vía apisperu.com).
 * @returns {{ dni: string, nombres: string, apellidos: string, nombreCompleto: string }}
 */
export async function consultarDni(dni) {
  const clean = String(dni).replace(/\D/g, '')
  if (clean.length !== 8) throw new Error('El DNI debe tener 8 dígitos')
  if (!TOKEN) throw new Error('API DNI no configurada (VITE_DNI_API_TOKEN)')

  const res = await fetch(`${BASE_URL}/${clean}?token=${encodeURIComponent(TOKEN)}`)
  const data = await res.json()
  if (!data?.success) throw new Error('DNI no encontrado en RENIEC')

  const nombres = titleCase(data.nombres || '')
  const apellidos = titleCase(`${data.apellidoPaterno || ''} ${data.apellidoMaterno || ''}`)
  return {
    dni: data.dni || clean,
    nombres,
    apellidos,
    nombreCompleto: [nombres, apellidos].filter(Boolean).join(' '),
  }
}
