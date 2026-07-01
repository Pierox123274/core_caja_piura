# Despliegue — Caja Piura Core

Stack **gratis** (sin tarjeta):

| Capa | Plataforma |
|------|------------|
| Portal web (React) | [Firebase Hosting](https://firebase.google.com/docs/hosting) |
| Base de datos | [Firebase Firestore](https://firebase.google.com/docs/firestore) (mismo proyecto que las apps Flutter) |

**Producción:** https://caja-piura-f0169.web.app

El portal usa **Firebase** directamente (sin API externa). Mismos datos que `app_clientes` y `app_fuerza_ventas`.

---

## Despliegue manual

```bash
cd core_caja_piura
npm ci
npm run build
cd ..
firebase deploy --only hosting --project caja-piura-f0169
```

## Despliegue automático (GitHub Actions)

Cada push a `master` que toque `core_caja_piura/` despliega si existe el secret `FIREBASE_SERVICE_ACCOUNT` en el repo.

Generar service account:
1. [Firebase Console](https://console.firebase.google.com/) → proyecto `caja-piura-f0169` → Configuración → Cuentas de servicio
2. Generar nueva clave privada (JSON)
3. En GitHub → Settings → Secrets → `FIREBASE_SERVICE_ACCOUNT` = contenido del JSON

## Credenciales demo

| Código | Clave |
|--------|--------|
| `100245` | `demo1234` |
| `900001` | `demo1234` |

## Local

```bash
cd core_caja_piura
npm run dev
```

Variables en `.env` (ver `.env.example`).
