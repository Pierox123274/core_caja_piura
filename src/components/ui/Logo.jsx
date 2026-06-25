/** Logo Caja Piura — portal core fuerza de ventas */
export default function Logo({
  size = 44,
  wordmark = true,
  variant = 'dark',
  subtitle = 'CORE · FUERZA DE VENTAS',
}) {
  const textColor = variant === 'light' ? '#ffffff' : '#021326'
  const subColor = variant === 'light' ? 'rgba(255,255,255,.85)' : '#4a6a8a'
  const nameSize = Math.round(size * 0.48)
  const subSize = Math.max(9, Math.round(size * 0.22))

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
      <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-label="Caja Piura" role="img">
        <rect x="4" y="8" width="40" height="32" rx="8" fill="#021326" />
        <rect x="8" y="14" width="32" height="6" rx="2" fill="#f5c518" />
        <rect x="8" y="24" width="20" height="4" rx="1" fill="#3d8bfd" opacity="0.9" />
        <rect x="8" y="31" width="28" height="4" rx="1" fill="#ffffff" opacity="0.85" />
      </svg>

      {wordmark && (
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.04 }}>
          <span style={{ fontWeight: 800, fontSize: nameSize, color: textColor, letterSpacing: '-0.5px' }}>
            Caja Piura
          </span>
          {subtitle && (
            <span style={{ fontSize: subSize, fontWeight: 700, color: subColor, letterSpacing: '1px' }}>
              {subtitle}
            </span>
          )}
        </span>
      )}
    </span>
  )
}
