# Caja Piura — Portal Core (Fuerza de Ventas Web)

Portal web en **React + Vite + Firebase** para asesores y supervisores. Consume la **misma base de datos Firestore** que `app_clientes` y `app_fuerza_ventas`.

Basado en la estructura del [portal Core Andino](https://github.com/u2008113935/mobile_front_core_andino_react), adaptado a Caja Piura con Firebase en lugar de FastAPI.

## Puesta en marcha

```bash
cd core_caja_piura
npm install
copy .env.example .env
npm run dev
```

Abrir http://localhost:5173

### Credenciales demo (Firebase Auth)

| Código | Contraseña | Rol |
|--------|------------|-----|
| `100245` | `demo1234` | Asesor |
| `900001` | `demo1234` | Supervisor |

Email interno: `asesor.{codigo}@cajapiura.demo`

## Módulos

| Pantalla | Colección Firestore |
|----------|---------------------|
| Cartera | `cartera_diaria` + sync de `solicitudes_credito` (estado `enviado`) |
| Solicitudes | `solicitudes_credito` |
| Comité / Desembolso | `solicitudes_credito` → `creditos` + `cronograma` |
| Ficha cliente | `clientes`, `creditos` |
| Evaluación | Lógica 30 casos (mismo catálogo que Flutter) |
| Cobranza | `creditos` vigentes |
| Reportes | Agregación de solicitudes del asesor |

## Ecosistema (3 proyectos)

```
caja-piura-app/
├── app_clientes/        Flutter — home banking (cliente envía solicitud)
├── app_fuerza_ventas/   Flutter — asesor en campo (móvil)
└── core_caja_piura/     React — portal web asesor/supervisor (Firebase)
```

**Firebase proyecto:** `caja-piura-f0169`

## Flujo integrado (30 casos de práctica)

1. **App Clientes**: cliente con DNI `40118120`… envía solicitud → `solicitudes_credito` estado `enviado`
2. **Core Web** o **App Fuerza Ventas**: sync cartera → visita → buró → comité → desembolso
3. **App Clientes**: ve estado en Mis solicitudes y crédito en Mis créditos

## Scripts

- `npm run dev` — desarrollo (puerto 5173)
- `npm run build` — producción
- `node scripts/gen-practice-cases.mjs` — regenerar catálogo JS desde Dart
