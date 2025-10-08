# 🎬 Sistema de Videos con Vimeo - Documentación Completa

## 📋 Tabla de Contenidos

1. [Arquitectura](#arquitectura)
2. [Configuración de Vimeo](#configuración-de-vimeo)
3. [Seguridad y Control de Acceso](#seguridad-y-control-de-acceso)
4. [Endpoints Disponibles](#endpoints-disponibles)
5. [Flujo Completo](#flujo-completo)
6. [Ejemplos de Uso](#ejemplos-de-uso)

---

## Arquitectura

### Modelos de Base de Datos

**VideoCategory** - Categorías de videos (Cejas, Labios, Ojos, etc.)
- `id`, `name`, `slug`, `description`, `image`, `order`, `isActive`

**Video** - Videos individuales
- Información básica: `title`, `slug`, `description`, `thumbnail`, `duration`
- Integración Vimeo: `vimeoId`, `vimeoUrl` (NO expuestos públicamente)
- Pricing: `price`, `currency`, `isFree`
- Organización: `categoryId`, `order`
- Estado: `isPublished`, `publishedAt`
- SEO: `metaTitle`, `metaDescription`

**VideoPurchase** - Compras de videos
- Usuario y video: `userId`, `videoId`
- Pago: `amount`, `currency`, `paymentMethod`, `transactionId`, `paymentStatus`
- Acceso: `expiresAt` (null = permanente), `isActive`

**VideoView** - Analytics de visualización
- `userId`, `videoId`
- Progreso: `watchedSeconds`, `totalSeconds`, `progress`, `completed`
- Sesión: `ipAddress`, `userAgent`, `device`

---

## Configuración de Vimeo

### Paso 1: Crear Cuenta Vimeo Pro

1. Ir a https://vimeo.com/upgrade
2. Seleccionar plan **Vimeo Pro** (mínimo)
3. Completar el registro

### Paso 2: Obtener Credenciales de API

1. Ir a: https://developer.vimeo.com/apps
2. Click en **Create App**
3. Llenar formulario:
   - **App Name**: Mery Portal
   - **App Description**: Video portal for cosmetic tattoo courses
   - **URL**: Tu dominio
4. Una vez creado, obtendrás:
   - **Client ID**
   - **Client Secret**

### Paso 3: Generar Access Token

1. En la misma página de tu app
2. Ve a **Authentication** tab
3. Click en **Generate Token**
4. Seleccionar scopes necesarios:
   - ✅ `public`
   - ✅ `private`
   - ✅ `video_files`
   - ✅ `edit`
   - ✅ `delete`
5. Copiar el **Access Token** generado

### Paso 4: Configurar Variables de Entorno

Agregar al archivo `.env`:

```env
# Vimeo Integration
VIMEO_CLIENT_ID="tu-client-id-aqui"
VIMEO_CLIENT_SECRET="tu-client-secret-aqui"
VIMEO_ACCESS_TOKEN="tu-access-token-aqui"
```

### Paso 5: Configurar Privacy Settings en Vimeo

Para cada video que subas a Vimeo:

1. **Privacy**: Seleccionar **"Hide this video from Vimeo.com"**
2. **Where can this be embedded?**: **"Only on sites I choose"**
3. Agregar tu dominio a la whitelist:
   - `tu-dominio.com`
   - `www.tu-dominio.com`
   - `localhost:3000` (para development)

---

## Seguridad y Control de Acceso

### Cómo Funciona

```
Usuario solicita video
    ↓
¿Está autenticado?
    ↓ Sí
¿El video es gratis? → Sí → ✅ Dar acceso
    ↓ No
¿El usuario lo compró?
    ↓ Sí
¿La compra está activa?
    ↓ Sí
¿La compra expiró? → No → ✅ Dar acceso
    ↓ Sí
❌ Acceso denegado
```

### Capas de Seguridad

1. **Backend Authentication (JWT)**
   - Usuario debe estar logueado
   - Token JWT válido

2. **Purchase Verification**
   - Verificación en base de datos
   - Check de expiración
   - Check de estado activo

3. **Vimeo Domain Whitelist**
   - Video solo se reproduce en dominios permitidos
   - Previene compartir URLs

4. **Signed URLs**
   - URLs de streaming temporales (1 hora)
   - Incluyen timestamp
   - No se pueden reutilizar indefinidamente

5. **Vimeo ID Oculto**
   - El `vimeoId` NUNCA se expone en las APIs públicas
   - Solo el backend conoce el ID real

---

## Endpoints Disponibles

### Públicos (No requieren autenticación)

#### 1. Listar Videos
```http
GET /api/videos
```

**Query Parameters:**
- `page` (number): Número de página (default: 1)
- `limit` (number): Items por página (default: 10, max: 100)
- `search` (string): Búsqueda por título o descripción
- `sortBy` (string): Campo de ordenamiento (default: "order")
- `sortOrder` (string): "asc" o "desc" (default: "asc")
- `categoryId` (string): Filtrar por categoría
- `isPublished` (boolean): Filtrar por publicados
- `isFree` (boolean): Filtrar por gratuitos

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "clx123...",
        "title": "Técnica de Microblading",
        "slug": "tecnica-microblading",
        "description": "Aprende...",
        "thumbnail": "https://i.vimeocdn.com/...",
        "duration": 1800,
        "price": "29.99",
        "currency": "USD",
        "isFree": false,
        "categoryId": "clx456...",
        "category": {
          "id": "clx456...",
          "name": "Cejas",
          "slug": "cejas"
        },
        "isPublished": true,
        "hasAccess": false,
        "isPurchased": false,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

#### 2. Obtener Video por ID/Slug
```http
GET /api/videos/:identifier
```

**Response:** Mismo formato que item individual arriba

---

### Protegidos (Requieren JWT)

#### 3. Obtener URL de Streaming
```http
GET /api/videos/:id/stream
Authorization: Bearer {jwt-token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "streamUrl": "https://player.vimeo.com/video/123456789?h=abc123&t=1234567890",
    "expiresIn": 3600
  }
}
```

**Errores:**
- `403`: No tienes acceso (no has comprado el video)
- `404`: Video no encontrado

#### 4. Actualizar Progreso
```http
POST /api/videos/:id/progress
Authorization: Bearer {jwt-token}
Content-Type: application/json

{
  "watchedSeconds": 900,
  "completed": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Progreso actualizado exitosamente"
}
```

#### 5. Obtener Progreso
```http
GET /api/videos/:id/progress
Authorization: Bearer {jwt-token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "watchedSeconds": 900,
    "progress": 50,
    "completed": false,
    "lastWatchedAt": "2024-01-01T12:30:00.000Z"
  }
}
```

---

### Admin (Requieren ADMIN o SUBADMIN)

#### 6. Crear Video
```http
POST /api/videos
Authorization: Bearer {jwt-token}
Content-Type: application/json

{
  "title": "Técnica de Microblading",
  "slug": "tecnica-microblading",
  "description": "Aprende la técnica completa...",
  "vimeoId": "123456789",
  "price": 29.99,
  "currency": "USD",
  "isFree": false,
  "categoryId": "clx456...",
  "order": 1,
  "metaTitle": "Técnica de Microblading | Tutorial",
  "metaDescription": "Aprende..."
}
```

**Nota:** Al crear, automáticamente se obtiene:
- `thumbnail` desde Vimeo
- `duration` desde Vimeo
- `vimeoUrl` desde Vimeo

#### 7. Actualizar Video
```http
PATCH /api/videos/:id
Authorization: Bearer {jwt-token}
Content-Type: application/json

{
  "title": "Nuevo Título",
  "isPublished": true,
  "publishedAt": "2024-01-01T00:00:00.000Z"
}
```

#### 8. Eliminar Video (Soft Delete)
```http
DELETE /api/videos/:id
Authorization: Bearer {jwt-token}
```

---

## Flujo Completo

### 1. Usuario Explora Videos (Sin Login)

```javascript
// Frontend: Lista de videos
fetch('http://localhost:3000/api/videos?categoryId=clx123')
  .then(res => res.json())
  .then(data => {
    // Mostrar videos con:
    // - hasAccess: false (no logueado)
    // - Botón "Comprar" visible
  });
```

### 2. Usuario Se Loguea

```javascript
// Login
const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'Password123'
  })
});

const { accessToken } = await loginResponse.json();
localStorage.setItem('token', accessToken);
```

### 3. Usuario Compra Video

```javascript
// (Aquí integrarías tu procesador de pagos: Stripe, PayPal, etc.)

// Una vez confirmado el pago, crear registro de compra:
const purchase = await fetch(`http://localhost:3000/api/purchases`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    videoId: 'clx123...',
    amount: 29.99,
    transactionId: 'stripe_payment_id'
  })
});
```

### 4. Usuario Accede al Video

```javascript
// Obtener URL de streaming
const streamResponse = await fetch(`http://localhost:3000/api/videos/clx123/stream`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { streamUrl } = await streamResponse.json();

// Cargar player de Vimeo
<iframe 
  src={streamUrl}
  width="640" 
  height="360" 
  frameborder="0" 
  allow="autoplay; fullscreen; picture-in-picture" 
  allowfullscreen
></iframe>
```

### 5. Tracking de Progreso

```javascript
// Cada 10 segundos o al pausar
setInterval(() => {
  const currentTime = vimeoPlayer.getCurrentTime();
  
  fetch(`http://localhost:3000/api/videos/clx123/progress`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      watchedSeconds: currentTime,
      completed: currentTime >= totalDuration
    })
  });
}, 10000);
```

---

## Ejemplos de Uso

### Crear Categoría (primero necesitas crear el módulo de categorías)

```bash
curl -X POST http://localhost:3000/api/categories \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Técnicas de Cejas",
    "slug": "cejas",
    "description": "Aprende todas las técnicas para cejas perfectas",
    "order": 1
  }'
```

### Crear Video

```bash
curl -X POST http://localhost:3000/api/videos \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Microblading para Principiantes",
    "slug": "microblading-principiantes",
    "description": "Tutorial completo de microblading",
    "vimeoId": "123456789",
    "price": 29.99,
    "categoryId": "clx_category_id",
    "order": 1
  }'
```

### Listar Videos (Usuario)

```bash
curl http://localhost:3000/api/videos?categoryId=clx_category_id
```

### Obtener Video para Reproducir

```bash
curl -X GET http://localhost:3000/api/videos/clx_video_id/stream \
  -H "Authorization: Bearer $USER_TOKEN"
```

---

## 🚨 Troubleshooting

### Error: "No tienes acceso a este video"
- Verificar que el usuario compró el video
- Verificar que la compra está activa
- Verificar que la compra no expiró

### Error: "Failed to get video info from Vimeo"
- Verificar credenciales de Vimeo en `.env`
- Verificar que el `vimeoId` es correcto
- Verificar permisos del Access Token

### Video no se reproduce
- Verificar domain whitelist en Vimeo
- Verificar que el video está en "Private" mode
- Verificar que la URL no expiró (válida 1 hora)

### Thumbnail no aparece
- Vimeo puede tardar en procesar el video
- Verificar que el video tiene thumbnail configurado
- Intentar refrescar metadata del video

---

## 🎯 Próximos Pasos

1. Crear módulo de Categorías (similar a Videos)
2. Crear módulo de Compras (con integración de pago)
3. Implementar webhooks de Vimeo para sincronización
4. Agregar analytics dashboard para admin
5. Implementar sistema de reviews/ratings

---

## 📚 Referencias

- [Vimeo API Documentation](https://developer.vimeo.com/)
- [Vimeo Player SDK](https://developer.vimeo.com/player/sdk)
- [Vimeo Privacy Settings](https://vimeo.com/help/privacy-settings-overview)
