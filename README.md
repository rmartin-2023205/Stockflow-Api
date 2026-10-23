# StockFlow API — Backend

Servidor API REST transaccional para **StockFlow**, un sistema integral de gestión de existencias, productos, ventas y control de inventario para pequeños y medianos negocios.

---

## 🛠 Stack Tecnológico

- **Entorno de Ejecución**: Node.js (v20+)
- **Framework Web**: Express 4
- **ORM & Modelado**: Prisma ORM (v6+)
- **Base de Datos**: PostgreSQL 18
- **Validación de Esquemas**: Zod (parámetros HTTP, payloads y variables de entorno)
- **Suite de Pruebas**: Node.js Native Test Runner (`node:test`) + Supertest

---

## 📂 Estructura del Proyecto

```text
stockflow-backend/
├── prisma/
│   ├── schema.prisma          # Modelado de datos (User, Organization, Product, Sale, Movement, AuditLog)
│   ├── migrations/            # Historial de migraciones SQL reproducibles
│   └── seed.js                # Poblado de datos iniciales / demo
├── src/
│   ├── config/
│   │   ├── env.js             # Validación estricta de variables de entorno con Zod
│   │   └── prisma.js          # Instancia singleton del cliente Prisma
│   ├── middlewares/
│   │   ├── errorHandler.js    # Manejo centralizado de errores (Zod, Prisma, HTTP)
│   │   └── notFound.js        # Manejador estructurado para rutas no encontradas (404)
│   ├── modules/
│   │   ├── health/            # Endpoint de comprobación de salud del sistema y base de datos
│   │   │   ├── health.controller.js
│   │   │   ├── health.routes.js
│   │   │   └── health.test.js
│   │   ├── auth/              # [Fase 2] Autenticación, sesiones y roles
│   │   ├── organizations/     # [Fase 2] Aislamiento multi-tenant por organización
│   │   ├── products/          # [Fase 3] Catálogo de productos y validaciones
│   │   ├── categories/        # [Fase 3] Clasificación de categorías
│   │   ├── inventory/         # [Fase 4] Trazabilidad y movimientos de stock
│   │   ├── sales/             # [Fase 5] Punto de venta transaccional
│   │   ├── dashboard/         # [Fase 6] Métricas consolidadas
│   │   └── reports/           # [Fase 6] Reportes históricos
│   ├── utils/
│   │   └── response.js        # Formato uniforme de respuestas JSON (success/error)
│   ├── app.js                 # Configuración de Express, CORS y parseo seguro
│   └── server.js              # Inicialización HTTP y graceful shutdown
├── .env.example               # Plantilla de variables de entorno
├── .gitignore                 # Exclusión estricta de credenciales y dependencias
└── package.json               # Dependencias y scripts de ejecución
```

---

## 🚀 Puesta en Marcha Local

### 1. Requisitos Previos

- [Node.js](https://nodejs.org/) v20 o superior.
- [PostgreSQL](https://www.postgresql.org/) v15+ activo en el puerto `5432`.

### 2. Instalación de Dependencias

```bash
npm install
```

### 3. Configurar Variables de Entorno

Copia la plantilla `.env.example` a un archivo `.env`:

```bash
cp .env.example .env
```

Configura tus credenciales en el archivo `.env`:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://USUARIO:CONTRASEÑA@localhost:5432/stockflow?schema=public"
CLIENT_URL="http://localhost:5173"
SESSION_SECRET="clave-secreta-larga-para-desarrollo"
```

> **Nota de Seguridad**: El archivo `.env` nunca debe versionarse en Git.

### 4. Generar Cliente Prisma y Aplicar Migraciones

Genera el cliente Prisma localmente:

```bash
npx prisma generate
```

Aplica las migraciones a PostgreSQL (creará la base de datos `stockflow` si aún no existe):

```bash
npx prisma migrate dev
```

*(Opcional) Inspecciona visualmente los datos con Prisma Studio:*

```bash
npx prisma studio
```

### 5. Iniciar Servidor de Desarrollo

```bash
npm run dev
```

El servidor iniciará en `http://localhost:3000`.

---

## 📡 Endpoints Implementados (Fase 1)

### `GET /api/health`
Comprueba la disponibilidad del servidor y realiza un ping en tiempo real a PostgreSQL.

**Respuesta Exitosa (HTTP 200)**:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "environment": "development",
    "database": "connected",
    "timestamp": "2026-10-23T02:00:00.000Z",
    "uptime": 12.34
  }
}
```

---

## 🧪 Pruebas Automatizadas

Para ejecutar la suite de pruebas automatizadas:

```bash
npm test
```

Verifica:
- Código de estado 200 y conectividad a base de datos en `/api/health`.
- Respuesta estructurada 404 para rutas inexistentes.

---

## 🔗 Repositorios Relacionados

- **Frontend SPA**: [Stockflow](https://github.com/rmartin-2023205/Stockflow.git)
- **Documentación Central & Especificación**: [Stockflow Docs](https://github.com/rmartin-2023205)
