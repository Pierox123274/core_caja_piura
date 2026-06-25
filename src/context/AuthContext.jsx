import { createContext, useContext, useEffect, useState } from 'react'
import * as authService from '../services/authService.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(authService.getStoredUser())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const unsub = authService.watchAuth((u) => {
      setUser(u)
      setReady(true)
    })
    return unsub
  }, [])

  const login = async (codigo, password) => {
    const { user: u } = await authService.login(codigo, password)
    setUser(u)
    return u
  }

  const logout = async () => {
    await authService.logout()
    setUser(null)
  }

  if (!ready) {
    return (
      <div className="cm-login-loading">
        <div className="cm-spinner" />
        <p>Iniciando portal…</p>
      </div>
    )
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
