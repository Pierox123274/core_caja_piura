import { useEffect, useRef, useState } from 'react'
import { consultarDni } from '../services/dniService.js'

/**
 * Al completar 8 dígitos de DNI, consulta RENIEC y rellena campos del formulario.
 *
 * @param {string} dni - valor actual del DNI (solo dígitos)
 * @param {(persona: { nombres: string, apellidos: string, nombreCompleto: string }) => void} onFound
 */
export function useDniAutofill(dni, onFound) {
  const lastLookup = useRef('')
  const onFoundRef = useRef(onFound)
  onFoundRef.current = onFound
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const clean = String(dni || '').replace(/\D/g, '')
    if (clean.length !== 8 || clean === lastLookup.current) return

    lastLookup.current = clean
    let cancelled = false
    setError(null)
    setLoading(true)

    consultarDni(clean)
      .then((p) => {
        if (!cancelled) onFoundRef.current(p)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'No se pudo consultar el DNI')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [dni])

  return { dniLoading: loading, dniError: error }
}
