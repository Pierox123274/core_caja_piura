const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export function useApi() {
  return Boolean(API_URL)
}

export function getToken() {
  return localStorage.getItem('cp_token')
}

export function setToken(token) {
  if (token) localStorage.setItem('cp_token', token)
  else localStorage.removeItem('cp_token')
}

export async function api(path, options = {}) {
  if (!API_URL) throw new Error('API no configurada (VITE_API_URL)')
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || body.message || detail
      if (Array.isArray(detail)) detail = detail.map((d) => d.msg || d).join(', ')
    } catch {
      /* ignore */
    }
    throw new Error(detail || 'Error de servidor')
  }
  if (res.status === 204) return null
  return res.json()
}
