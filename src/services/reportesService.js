import { listarSolicitudes } from './solicitudesService.js'
import { listarCartera } from './carteraService.js'
import { requireUser } from './authService.js'
import { api, useApi } from './apiClient.js'

export async function productividad() {
  if (useApi()) return api('/api/reportes/productividad')
  const user = requireUser()
  const solicitudes = await listarSolicitudes()
  const cartera = await listarCartera()

  const enviadas = solicitudes.length
  const aprobadas = solicitudes.filter((s) =>
    ['aprobado', 'condicionado', 'desembolsado'].includes(s.estado),
  ).length
  const desembolsadas = solicitudes.filter((s) => s.estado === 'desembolsado').length
  const monto = solicitudes
    .filter((s) => s.estado === 'desembolsado')
    .reduce((a, s) => a + (s.monto_aprobado || 0), 0)

  return {
    asesores: [
      {
        nombre: user.nombre || 'Asesor',
        enviadas,
        aprobadas,
        desembolsadas,
        monto,
        visitas_cartera: cartera.filter((c) => c.estado_visita !== 'pendiente').length,
      },
    ],
  }
}
