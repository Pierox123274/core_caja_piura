# Despliegue en la nube — Caja Piura Core

Stack de producción:

| Capa | Plataforma | Repositorio |
|------|------------|-------------|
| Frontend (React + Vite) | [Vercel](https://vercel.com/) | `core_caja_piura` |
| Backend (FastAPI) | [Koyeb](https://www.koyeb.com/) | `Dockerfile` en la raíz |
| Base de datos (PostgreSQL) | [Neon](https://neon.com/) | Conexión vía `DATABASE_URL` |

El código ya está en GitHub: https://github.com/Pierox123274/core_caja_piura

En producción el portal usa **REST API** (`VITE_API_URL`). En local, sin esa variable, sigue usando **Firebase** como antes.

---

## 1. Neon — PostgreSQL

1. Crea cuenta en [neon.com](https://neon.com/) e inicia un proyecto (ej. `caja-piura`).
2. En el panel, copia la **connection string** (modo *pooled*, recomendado para serverless/Koyeb):
   ```
   postgresql://usuario:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
3. Guárdala como `DATABASE_URL` (la usarás en Koyeb).

No hace falta crear tablas manualmente: el backend ejecuta `create_all` y **seed** de demo al arrancar.

---

## 2. Koyeb — Backend FastAPI

1. Entra en [Koyeb](https://app.koyeb.com/) → **Create App** → **GitHub** → repo `Pierox123274/core_caja_piura`.
2. Tipo de build: **Dockerfile** (raíz del repo).
3. Puerto: **8000** (HTTP).
4. Variables de entorno:

| Variable | Valor |
|----------|--------|
| `DATABASE_URL` | Connection string de Neon |
| `JWT_SECRET` | Clave larga aleatoria (producción) |
| `CORS_ORIGINS` | URL de Vercel (ej. `https://core-caja-piura.vercel.app`) |
| `DNI_API_TOKEN` | Token apisperu.com (opcional) |
| `DNI_API_BASE_URL` | `https://dniruc.apisperu.com/api/v1/dni` |
| `PORT` | `8000` |

5. Despliega y anota la URL pública, por ejemplo:
   ```
   https://caja-piura-api-xxxxx.koyeb.app
   ```
6. Verifica: `GET https://TU-API.koyeb.app/health` → `{"status":"ok"}`

### Credenciales demo (API)

| Código | Contraseña |
|--------|------------|
| `100245` | `demo1234` |
| `900001` | `demo1234` |

---

## 3. Vercel — Frontend

1. Entra en [vercel.com/new](https://vercel.com/new) → importa `Pierox123274/core_caja_piura`.
2. Framework: **Vite** (detectado automáticamente).
3. Variables de entorno:

| Variable | Valor |
|----------|--------|
| `VITE_API_URL` | URL de Koyeb (sin `/` final), ej. `https://caja-piura-api-xxxxx.koyeb.app` |

No configures variables `VITE_FIREBASE_*` en producción si usas solo la API.

4. Deploy → obtendrás una URL como `https://core-caja-piura.vercel.app`.

5. Vuelve a Koyeb y actualiza `CORS_ORIGINS` con la URL real de Vercel si hace falta.

---

## 4. CLI (opcional)

### Vercel
```bash
cd core_caja_piura
npx vercel login
npx vercel --prod
npx vercel env add VITE_API_URL production
```

### Neon
```bash
npx neonctl auth
npx neonctl projects create --name caja-piura
npx neonctl connection-string
```

### Koyeb
```bash
# Instalar CLI: https://www.koyeb.com/docs/installation
koyeb login
koyeb app init caja-piura-api --docker Dockerfile --git github.com/Pierox123274/core_caja_piura
```

---

## Arquitectura

```
Usuario → Vercel (React)
              ↓ VITE_API_URL
         Koyeb (FastAPI)
              ↓ DATABASE_URL
         Neon (PostgreSQL)
```

Las apps Flutter (`app_clientes`, `app_fuerza_ventas`) **siguen usando Firebase**; solo el portal web usa Neon/Koyeb en producción cloud.

---

## Desarrollo local con API

```bash
# Terminal 1 — Postgres local o Neon dev branch
export DATABASE_URL=postgresql://...
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000

# Terminal 2
cp .env.example .env
# VITE_API_URL=http://localhost:8000
npm run dev
```
