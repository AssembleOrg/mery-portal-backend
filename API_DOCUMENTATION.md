# Mery Portal API - Documentación

## 📋 Información General

- **Base URL**: `http://localhost:3000/api`
- **Versión**: 1.0
- **Swagger UI**: `http://localhost:3000/api/docs`

## 💰 Sistema de Precios y Cursos

Esta API implementa un **sistema de cursos** donde:

- **Las categorías representan cursos completos** que los usuarios pueden comprar
- **Cada curso tiene precio dual**: ARS (Pesos Argentinos) y USD (Dólares) que coexisten
- **Los videos NO tienen precio individual** - pertenecen a un curso
- Al comprar un curso, el usuario obtiene acceso a **todos los videos** de ese curso
- Los cursos pueden ser gratuitos (`isFree: true`) o de pago
- El acceso se controla a nivel de categoría/curso, no por video individual

### Flujo de Compra

1. Usuario navega las categorías/cursos disponibles
2. Selecciona un curso y ve su precio en ARS y USD
3. Procede con la compra (integración con payment gateway)
4. Al confirmar el pago, se crea un registro `CategoryPurchase`
5. El usuario obtiene acceso a todos los videos del curso comprado

## 🔐 Autenticación

La API utiliza **JWT (JSON Web Token)** para autenticación. Todos los endpoints protegidos requieren el header:

```
Authorization: Bearer <token>
```

### Obtener Token
Usa el endpoint `POST /auth/login` para obtener tu token de acceso.

---

## 📦 Estructura de Respuesta

Todas las respuestas exitosas siguen este formato:

```json
{
  "success": true,
  "message": "Operación exitosa",
  "data": { ... },
  "timestamp": "2025-10-07T00:00:00.000Z"
}
```

### Respuestas Paginadas

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "timestamp": "2025-10-07T00:00:00.000Z"
}
```

### Respuestas de Error

```json
{
  "success": false,
  "message": "Descripción del error",
  "error": "Error Type",
  "statusCode": 400,
  "timestamp": "2025-10-07T00:00:00.000Z"
}
```

---

## 👥 Roles de Usuario

| Role | Descripción |
|------|-------------|
| `ADMIN` | Acceso completo a todos los recursos |
| `SUBADMIN` | Puede gestionar contenido (videos, categorías) |
| `USER` | Usuario estándar (ver contenido, comprar, progreso) |

---

## 🔑 Endpoints de Autenticación

### 1. Registrar Usuario

```
POST /auth/register
```

**Acceso**: Público

**Body**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "Juan",        // Opcional
  "lastName": "Pérez"         // Opcional
}
```

**Respuesta** (201):
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente. Se envió un correo de verificación."
}
```

**Rate Limit**: 3 registros por minuto por IP

---

### 2. Verificar Email

```
POST /auth/verify-email
```

**Acceso**: Público

**Body**:
```json
{
  "token": "verification-token-from-email"
}
```

**Respuesta** (200):
```json
{
  "success": true,
  "message": "Correo electrónico verificado exitosamente"
}
```

---

### 3. Reenviar Verificación

```
POST /auth/resend-verification
```

**Acceso**: Público

**Body**:
```json
{
  "email": "user@example.com"
}
```

**Respuesta** (200):
```json
{
  "success": true,
  "message": "Correo de verificación enviado exitosamente"
}
```

---

### 4. Iniciar Sesión

```
POST /auth/login
```

**Acceso**: Público

**Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Respuesta** (200):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "clx123...",
      "email": "user@example.com",
      "role": "USER",
      "firstName": "Juan",
      "lastName": "Pérez",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

**Rate Limit**: 5 intentos por minuto por IP

---

### 5. Olvidé mi Contraseña

```
POST /auth/forgot-password
```

**Acceso**: Público

**Body**:
```json
{
  "email": "user@example.com"
}
```

**Respuesta** (200):
```json
{
  "success": true,
  "message": "Si el correo existe, se enviaron instrucciones"
}
```

---

### 6. Restablecer Contraseña

```
POST /auth/reset-password
```

**Acceso**: Público

**Body**:
```json
{
  "token": "reset-token-from-email",
  "newPassword": "newPassword123"
}
```

**Respuesta** (200):
```json
{
  "success": true,
  "message": "Contraseña restablecida exitosamente"
}
```

---

### 7. Obtener Usuario Actual (Me)

```
GET /auth/me
```

**Acceso**: Requiere autenticación  
**Autenticación**: JWT Bearer Token

**Respuesta** (200):
```json
{
  "success": true,
  "data": {
    "id": "clx123...",
    "email": "user@example.com",
    "role": "USER",
    "firstName": "Juan",
    "lastName": "Pérez",
    "isActive": true,
    "isEmailVerified": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Respuesta** (401):
```json
{
  "success": false,
  "message": "Token inválido o sesión expirada",
  "statusCode": 401
}
```

**⚠️ Nota**: Este endpoint verifica automáticamente la validez del token JWT y retorna la información del usuario autenticado. Es útil para:
- Verificar si la sesión sigue activa
- Obtener datos actualizados del usuario
- Validar permisos en el frontend

---

## 👤 Endpoints de Usuarios

### 1. Crear Usuario

```
POST /users
```

**Acceso**: ADMIN, SUBADMIN  
**Autenticación**: JWT Bearer Token

**Body**:
```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "firstName": "María",        // Opcional
  "lastName": "García",        // Opcional
  "role": "USER"              // Opcional (por defecto: USER)
}
```

**Respuesta** (201):
```json
{
  "success": true,
  "data": {
    "id": "clx456...",
    "email": "newuser@example.com",
    "role": "USER",
    "firstName": "María",
    "lastName": "García",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "deletedAt": null
  }
}
```

---

### 2. Listar Usuarios

```
GET /users?page=1&limit=10&search=juan&role=USER&sortBy=createdAt&sortOrder=desc
```

**Acceso**: ADMIN, SUBADMIN  
**Autenticación**: JWT Bearer Token

**Query Parameters**:
| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `page` | number | 1 | Número de página |
| `limit` | number | 10 | Resultados por página |
| `search` | string | - | Buscar en email, firstName, lastName |
| `role` | string | - | Filtrar por rol (ADMIN, SUBADMIN, USER) |
| `sortBy` | string | createdAt | Campo para ordenar |
| `sortOrder` | string | desc | asc o desc |

**Respuesta** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "clx123...",
      "email": "user@example.com",
      "role": "USER",
      "firstName": "Juan",
      "lastName": "Pérez",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "deletedAt": null
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

---

### 3. Obtener Usuario por ID

```
GET /users/:id
```

**Acceso**: ADMIN, SUBADMIN  
**Autenticación**: JWT Bearer Token

**Respuesta** (200):
```json
{
  "success": true,
  "data": {
    "id": "clx123...",
    "email": "user@example.com",
    "role": "USER",
    "firstName": "Juan",
    "lastName": "Pérez",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "deletedAt": null
  }
}
```

---

### 4. Actualizar Usuario

```
PATCH /users/:id
```

**Acceso**: ADMIN, SUBADMIN  
**Autenticación**: JWT Bearer Token

**Body** (todos los campos son opcionales):
```json
{
  "email": "newemail@example.com",
  "firstName": "Juan Carlos",
  "lastName": "Pérez López",
  "role": "SUBADMIN",
  "isActive": false
}
```

**Respuesta** (200): Igual que Obtener Usuario

---

### 5. Eliminar Usuario (Soft Delete)

```
DELETE /users/:id
```

**Acceso**: ADMIN, SUBADMIN  
**Autenticación**: JWT Bearer Token

**Respuesta** (204): Sin contenido

---

### 6. Restaurar Usuario Eliminado

```
PATCH /users/:id/restore
```

**Acceso**: ADMIN, SUBADMIN  
**Autenticación**: JWT Bearer Token

**Respuesta** (200): Igual que Obtener Usuario

---

## 📁 Endpoints de Categorías

Las categorías representan cursos completos que pueden ser adquiridos por los usuarios. Cada categoría tiene precios en dos monedas (ARS y USD) que coexisten en el sistema.

### 1. Crear Categoría

```
POST /categories
```

**Acceso**: ADMIN, SUBADMIN  
**Autenticación**: JWT Bearer Token

**Body**:
```json
{
  "name": "Curso de Cejas",
  "slug": "curso-cejas",
  "description": "Técnicas y tutoriales de microblading y diseño de cejas",  // Opcional
  "image": "https://example.com/images/cejas.jpg",                          // Opcional
  "priceARS": 89999.99,                                                     // Requerido - Precio en Pesos Argentinos
  "priceUSD": 89.99,                                                        // Requerido - Precio en Dólares
  "isFree": false,                                                          // Opcional (default: false)
  "order": 0,                                                               // Opcional (default: 0)
  "isActive": true                                                          // Opcional (default: true)
}
```

**Respuesta** (201):
```json
{
  "success": true,
  "data": {
    "id": "cmgg3agy40000gxtr68qj5jgh",
    "name": "Curso de Cejas",
    "slug": "curso-cejas",
    "description": "Técnicas y tutoriales de microblading y diseño de cejas",
    "image": "https://example.com/images/cejas.jpg",
    "priceARS": 89999.99,
    "priceUSD": 89.99,
    "isFree": false,
    "order": 0,
    "isActive": true,
    "videoCount": 0,
    "createdAt": "2025-10-07T00:00:00.000Z",
    "updatedAt": "2025-10-07T00:00:00.000Z"
  }
}
```

**⚠️ Nota**: 
- Ambos precios (`priceARS` y `priceUSD`) son requeridos y deben ser mayores a 0, a menos que `isFree` sea `true`
- Para cursos gratuitos, establece `isFree: true` y ambos precios en `0`

---

### 2. Listar Categorías

```
GET /categories?page=1&limit=10&search=cejas&isActive=true&sortBy=order&sortOrder=asc
```

**Acceso**: Público (retorna información adicional si está autenticado)

**Query Parameters**:
| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `page` | number | 1 | Número de página |
| `limit` | number | 10 | Resultados por página |
| `search` | string | - | Buscar en name y description |
| `isActive` | boolean | - | Filtrar por estado activo |
| `sortBy` | string | order | Campo para ordenar (order, name, createdAt) |
| `sortOrder` | string | asc | asc o desc |

**Respuesta** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "cmgg3agy40000gxtr68qj5jgh",
      "name": "Curso de Cejas",
      "slug": "curso-cejas",
      "description": "Técnicas profesionales de diseño y microblading de cejas",
      "image": "https://example.com/images/cejas.jpg",
      "priceARS": 89999.99,
      "priceUSD": 89.99,
      "isFree": false,
      "order": 0,
      "isActive": true,
      "videoCount": 5,
      "hasAccess": true,        // Solo si está autenticado
      "isPurchased": true,      // Solo si está autenticado
      "createdAt": "2025-10-07T00:00:00.000Z",
      "updatedAt": "2025-10-07T00:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 8,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

**⚠️ Nota**: 
- `hasAccess` y `isPurchased` solo aparecen cuando el usuario está autenticado
- `hasAccess` es `true` si el usuario compró la categoría o si es gratuita
- `isPurchased` es `true` si el usuario compró específicamente la categoría

---

### 3. Obtener Categoría por ID o Slug

```
GET /categories/:id
```

**Acceso**: Público (retorna información adicional si está autenticado)  
**Parámetro**: Puede ser el ID o el slug de la categoría

**Respuesta** (200):
```json
{
  "success": true,
  "data": {
    "id": "cmgg3agy40000gxtr68qj5jgh",
    "name": "Curso de Cejas",
    "slug": "curso-cejas",
    "description": "Técnicas profesionales de diseño y microblading de cejas",
    "image": "https://example.com/images/cejas.jpg",
    "priceARS": 89999.99,
    "priceUSD": 89.99,
    "isFree": false,
    "order": 0,
    "isActive": true,
    "videoCount": 5,
    "hasAccess": true,        // Solo si está autenticado
    "isPurchased": false,     // Solo si está autenticado
    "createdAt": "2025-10-07T00:00:00.000Z",
    "updatedAt": "2025-10-07T00:00:00.000Z"
  }
}
```

---

### 4. Actualizar Categoría

```
PATCH /categories/:id
```

**Acceso**: ADMIN, SUBADMIN  
**Autenticación**: JWT Bearer Token

**Body** (todos los campos son opcionales):
```json
{
  "name": "Curso de Cejas y Pestañas",
  "slug": "curso-cejas-pestanas",
  "description": "Nueva descripción del curso",
  "image": "https://example.com/new-image.jpg",
  "priceARS": 99999.99,
  "priceUSD": 99.99,
  "isFree": false,
  "order": 1,
  "isActive": false
}
```

**Respuesta** (200): Igual que Obtener Categoría

---

### 5. Eliminar Categoría

```
DELETE /categories/:id
```

**Acceso**: ADMIN (solo admin)  
**Autenticación**: JWT Bearer Token

**Respuesta** (200):
```json
{
  "success": true,
  "message": "Categoría eliminada exitosamente"
}
```

**⚠️ Nota**: No se puede eliminar una categoría que tenga videos asociados.

---

## 🛒 Endpoints de Carrito de Compras

El carrito permite a los usuarios seleccionar múltiples cursos/categorías antes de proceder con un único pago.

### 1. Obtener Carrito

```
GET /cart
```

**Acceso**: Requiere autenticación  
**Autenticación**: JWT Bearer Token

**Respuesta** (200):
```json
{
  "success": true,
  "data": {
    "id": "cart_clx123...",
    "userId": "user_clx456...",
    "items": [
      {
        "id": "item_clx789...",
        "categoryId": "cat_clx111...",
        "category": {
          "id": "cat_clx111...",
          "name": "Curso de Cejas",
          "slug": "curso-cejas",
          "image": "https://example.com/cejas.jpg",
          "description": "Técnicas profesionales de microblading"
        },
        "priceARS": 89999.99,
        "priceUSD": 89.99,
        "addedAt": "2024-01-01T10:00:00.000Z"
      },
      {
        "id": "item_clx222...",
        "categoryId": "cat_clx333...",
        "category": {
          "id": "cat_clx333...",
          "name": "Curso de Labios",
          "slug": "curso-labios",
          "image": "https://example.com/labios.jpg",
          "description": "Técnicas de micropigmentación labial"
        },
        "priceARS": 79999.99,
        "priceUSD": 79.99,
        "addedAt": "2024-01-01T11:00:00.000Z"
      }
    ],
    "itemCount": 2,
    "totalARS": 169999.98,
    "totalUSD": 169.98,
    "createdAt": "2024-01-01T09:00:00.000Z",
    "updatedAt": "2024-01-01T11:00:00.000Z"
  }
}
```

**⚠️ Nota**: 
- Si el usuario no tiene un carrito, se crea automáticamente
- Los precios en el carrito son un "snapshot" del momento en que se agregaron
- Esto protege contra cambios de precio mientras el usuario decide

---

### 2. Agregar Curso al Carrito

```
POST /cart/add
```

**Acceso**: Requiere autenticación  
**Autenticación**: JWT Bearer Token

**Body**:
```json
{
  "categoryId": "cat_clx111..."
}
```

**Respuesta** (200): Igual que "Obtener Carrito"

**Respuestas de Error**:
- **404**: Categoría no encontrada
- **409**: El curso ya está en el carrito O ya fue comprado
- **400**: La categoría no está disponible

---

### 3. Eliminar Item del Carrito

```
DELETE /cart/items/:itemId
```

**Acceso**: Requiere autenticación  
**Autenticación**: JWT Bearer Token

**Parámetros**:
- `itemId`: ID del item en el carrito (no el categoryId)

**Respuesta** (200): Igual que "Obtener Carrito"

**Respuesta de Error**:
- **404**: Item no encontrado en el carrito

---

### 4. Vaciar Carrito Completo

```
DELETE /cart
```

**Acceso**: Requiere autenticación  
**Autenticación**: JWT Bearer Token

**Respuesta** (200):
```json
{
  "success": true,
  "message": "Carrito vaciado exitosamente"
}
```

---

### 5. Obtener Resumen para Checkout

```
GET /cart/summary
```

**Acceso**: Requiere autenticación  
**Autenticación**: JWT Bearer Token

**Respuesta** (200):
```json
{
  "success": true,
  "data": {
    "itemCount": 2,
    "totalARS": 169999.98,
    "totalUSD": 169.98,
    "items": [
      {
        "categoryId": "cat_clx111...",
        "categoryName": "Curso de Cejas",
        "priceARS": 89999.99,
        "priceUSD": 89.99
      },
      {
        "categoryId": "cat_clx333...",
        "categoryName": "Curso de Labios",
        "priceARS": 79999.99,
        "priceUSD": 79.99
      }
    ]
  }
}
```

**⚠️ Nota**: Este endpoint es útil para la página de checkout, ya que devuelve un resumen simplificado sin toda la información detallada.

---

## 🎬 Endpoints de Videos

### 1. Crear Video

```
POST /videos
```

**Acceso**: ADMIN, SUBADMIN  
**Autenticación**: JWT Bearer Token

**Body**:
```json
{
  "title": "Técnica de Microblading paso a paso",
  "slug": "tecnica-microblading-paso-a-paso",
  "description": "Aprende la técnica completa de microblading",  // Opcional
  "vimeoId": "776643755",
  "categoryId": "cmgg3agy40000gxtr68qj5jgh",
  "order": 0,                                                     // Opcional (default: 0)
  "metaTitle": "Técnica de Microblading | Tutorial",             // Opcional
  "metaDescription": "Aprende microblading paso a paso"          // Opcional
}
```

**Respuesta** (201):
```json
{
  "success": true,
  "data": {
    "id": "cmgg4aqtk0001gx3o5utlznr3",
    "title": "Técnica de Microblading paso a paso",
    "slug": "tecnica-microblading-paso-a-paso",
    "description": "Aprende la técnica completa de microblading",
    "thumbnail": "https://i.vimeocdn.com/video/...",
    "duration": 213,
    "categoryId": "cmgg3agy40000gxtr68qj5jgh",
    "category": {
      "id": "cmgg3agy40000gxtr68qj5jgh",
      "name": "Curso de Cejas",
      "slug": "curso-cejas"
    },
    "isPublished": false,
    "publishedAt": null,
    "createdAt": "2025-10-07T05:26:46.088Z",
    "updatedAt": "2025-10-07T05:26:46.088Z"
  }
}
```

**⚠️ Nota**: 
- El sistema obtiene automáticamente `thumbnail`, `duration` y `vimeoUrl` desde Vimeo
- El `vimeoId` y `vimeoUrl` no se exponen en las respuestas por seguridad
- **Los videos no tienen precio propio**: el precio se maneja a nivel de categoría (curso completo)

---

### 2. Listar Videos

```
GET /videos?page=1&limit=10&search=microblading&categoryId=cmgg3agy&isPublished=true&sortBy=order&sortOrder=asc
```

**Acceso**: Público (retorna info adicional si está autenticado)

**Query Parameters**:
| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `page` | number | 1 | Número de página |
| `limit` | number | 10 | Resultados por página |
| `search` | string | - | Buscar en title y description |
| `categoryId` | string | - | Filtrar por categoría/curso |
| `isPublished` | boolean | - | Filtrar por estado de publicación |
| `sortBy` | string | order | Campo para ordenar (order, title, createdAt) |
| `sortOrder` | string | asc | asc o desc |

**Respuesta** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "cmgg4aqtk0001gx3o5utlznr3",
      "title": "Técnica de Microblading paso a paso",
      "slug": "tecnica-microblading-paso-a-paso",
      "description": "Aprende la técnica completa",
      "thumbnail": "https://i.vimeocdn.com/video/...",
      "duration": 213,
      "categoryId": "cmgg3agy40000gxtr68qj5jgh",
      "category": {
        "id": "cmgg3agy40000gxtr68qj5jgh",
        "name": "Curso de Cejas",
        "slug": "curso-cejas"
      },
      "isPublished": true,
      "publishedAt": "2025-10-07T00:00:00.000Z",
      "createdAt": "2025-10-07T05:26:46.088Z",
      "updatedAt": "2025-10-07T05:26:46.088Z"
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
```

**⚠️ Nota**: 
- El acceso a videos se controla a nivel de **categoría/curso**, no por video individual
- Para verificar acceso, consulta los campos `hasAccess` y `isPurchased` en la categoría del video

---

### 3. Obtener Video por ID o Slug

```
GET /videos/:identifier
```

**Acceso**: Público (retorna info adicional si está autenticado)  
**Parámetro**: Puede ser el ID o el slug del video

**Respuesta** (200): Igual estructura que un elemento de la lista de videos

---

### 4. Obtener URL de Streaming

```
GET /videos/:id/stream
```

**Acceso**: Requiere autenticación  
**Autenticación**: JWT Bearer Token

**Respuesta** (200):
```json
{
  "success": true,
  "data": {
    "streamUrl": "https://player.vimeo.com/video/776643755?h=abc123&autoplay=1",
    "expiresAt": "2025-10-07T06:00:00.000Z"
  }
}
```

**⚠️ Nota**: El usuario debe tener acceso al video a través de su categoría (haber comprado el curso o ser gratuito)

---

### 5. Actualizar Progreso de Visualización

```
POST /videos/:id/progress
```

**Acceso**: Requiere autenticación  
**Autenticación**: JWT Bearer Token

**Body**:
```json
{
  "watchedSeconds": 120,
  "completed": false        // Opcional
}
```

**Respuesta** (200):
```json
{
  "success": true,
  "message": "Progreso actualizado exitosamente"
}
```

---

### 6. Obtener Progreso de Visualización

```
GET /videos/:id/progress
```

**Acceso**: Requiere autenticación  
**Autenticación**: JWT Bearer Token

**Respuesta** (200):
```json
{
  "success": true,
  "data": {
    "videoId": "cmgg4aqtk0001gx3o5utlznr3",
    "watchedSeconds": 120,
    "totalSeconds": 213,
    "progress": 56,
    "completed": false,
    "lastWatchedAt": "2025-10-07T05:30:00.000Z"
  }
}
```

---

### 7. Actualizar Video

```
PATCH /videos/:id
```

**Acceso**: ADMIN, SUBADMIN  
**Autenticación**: JWT Bearer Token

**Body** (todos los campos son opcionales):
```json
{
  "title": "Nuevo título",
  "slug": "nuevo-slug",
  "description": "Nueva descripción",
  "categoryId": "otra-categoria-id",
  "order": 1,
  "isPublished": true,
  "publishedAt": "2025-10-07T00:00:00.000Z",
  "metaTitle": "Nuevo meta título",
  "metaDescription": "Nueva meta descripción"
}
```

**Respuesta** (200): Igual estructura que Obtener Video

---

### 8. Eliminar Video (Soft Delete)

```
DELETE /videos/:id
```

**Acceso**: ADMIN, SUBADMIN  
**Autenticación**: JWT Bearer Token

**Respuesta** (204): Sin contenido

---

### 9. Subir Video a Vimeo

```
POST /videos/upload
```

**Acceso**: ADMIN, SUBADMIN  
**Autenticación**: JWT Bearer Token  
**Content-Type**: `multipart/form-data`  
**Timeout**: 1 hora (suficiente para archivos de 2GB)

**Descripción**: Sube un archivo de video grande (hasta 2GB) a Vimeo usando el protocolo tus para carga resumible. El sistema automáticamente sube el video a Vimeo, obtiene el thumbnail y duración, y crea el registro en la base de datos.

**Form Data**:
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| file | file | ✅ | Archivo de video (max 2GB) |
| title | string | ✅ | Título del video |
| slug | string | ✅ | Slug único para el video |
| description | string | ❌ | Descripción del video |
| categoryId | string | ✅ | ID de la categoría/curso |
| order | number | ❌ | Orden del video (0 = preview gratis) |
| isPublished | boolean | ❌ | Publicar inmediatamente |

**Formatos Aceptados**:
- `.mp4` - MP4 (recomendado)
- `.mov` - QuickTime
- `.avi` - AVI
- `.mkv` - Matroska
- `.mpeg` - MPEG

**Respuesta** (201):
```json
{
  "success": true,
  "data": {
    "id": "clx123...",
    "title": "Técnica Avanzada de Microblading",
    "slug": "tecnica-avanzada-microblading",
    "description": "En este video aprenderás las técnicas más avanzadas...",
    "thumbnail": "https://i.vimeocdn.com/video/...",
    "duration": 1200,
    "categoryId": "cat_456...",
    "category": {
      "id": "cat_456...",
      "name": "Curso de Cejas",
      "slug": "curso-cejas"
    },
    "isPublished": false,
    "publishedAt": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Respuestas de Error**:
- **400**: Archivo inválido, tipo no permitido, o datos incorrectos
- **404**: Categoría no encontrada
- **409**: Slug duplicado
- **500**: Error en la carga a Vimeo

**⚠️ Notas Importantes**:
- El video se sube usando el **protocolo tus** (carga resumible)
- Tamaño máximo: **2GB por archivo**
- El proceso puede tomar varios minutos dependiendo del tamaño
- Los logs del servidor muestran el progreso en tiempo real
- El archivo temporal se limpia automáticamente después de la carga
- El video se crea como **privado** en Vimeo por defecto
- `vimeoId` y `vimeoUrl` no se exponen en la respuesta por seguridad

**Ejemplo con cURL**:
```bash
curl -X POST http://localhost:3000/api/videos/upload \
  -H "Authorization: Bearer <admin-token>" \
  -F "file=@/path/to/video.mp4" \
  -F "title=Técnica Avanzada de Microblading" \
  -F "slug=tecnica-avanzada-microblading" \
  -F "description=En este video aprenderás..." \
  -F "categoryId=cat_123..." \
  -F "order=1" \
  -F "isPublished=false"
```

**Ejemplo con JavaScript/Fetch**:
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('title', 'Técnica Avanzada de Microblading');
formData.append('slug', 'tecnica-avanzada-microblading');
formData.append('description', 'En este video aprenderás...');
formData.append('categoryId', 'cat_123...');
formData.append('order', '1');
formData.append('isPublished', 'false');

const response = await fetch('http://localhost:3000/api/videos/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData,
});

const result = await response.json();
console.log('Video creado:', result.data);
```

**Ejemplo con Axios (con progreso)**:
```javascript
const formData = new FormData();
formData.append('file', file);
formData.append('title', 'Mi Video');
formData.append('slug', 'mi-video');
formData.append('categoryId', 'cat_123');

const response = await axios.post('/api/videos/upload', formData, {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  onUploadProgress: (progressEvent) => {
    const percentCompleted = Math.round(
      (progressEvent.loaded * 100) / (progressEvent.total || 100)
    );
    console.log(`Progreso: ${percentCompleted}%`);
  },
});
```

---

### 10. Verificar Estado de Procesamiento

```
GET /videos/:id/upload-status
```

**Acceso**: ADMIN, SUBADMIN  
**Autenticación**: JWT Bearer Token

**Descripción**: Verifica el estado de procesamiento del video en Vimeo. Útil para saber cuándo el video está listo para visualización después de subirlo.

**Respuesta** (200):
```json
{
  "success": true,
  "data": {
    "status": "processing",
    "message": "El video está siendo procesado por Vimeo. Esto puede tomar varios minutos."
  }
}
```

**Estados Posibles**:
| Estado | Descripción |
|--------|-------------|
| `uploading` | El video se está cargando a Vimeo |
| `processing` | El video se está procesando (transcodificación) |
| `available` | El video está listo y disponible para visualización |
| `error` | Hubo un error en el procesamiento |

**Respuesta de Error**:
- **404**: Video no encontrado

**⚠️ Nota**: Después de subir un video con `/upload`, puede tomar varios minutos hasta que Vimeo lo procese. Usa este endpoint para verificar periódicamente el estado.

**Ejemplo de uso con polling**:
```javascript
// Verificar estado cada 10 segundos
const checkVideoStatus = async (videoId) => {
  const response = await fetch(
    `http://localhost:3000/api/videos/${videoId}/upload-status`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );
  
  const { data } = await response.json();
  console.log('Estado:', data.status);
  
  if (data.status === 'available') {
    console.log('✅ Video listo para visualización!');
    return true;
  } else if (data.status === 'error') {
    console.error('❌ Error procesando el video');
    return false;
  } else {
    // Verificar de nuevo en 10 segundos
    await new Promise(resolve => setTimeout(resolve, 10000));
    return checkVideoStatus(videoId);
  }
};

// Después de subir un video
const video = await uploadVideo(file, metadata);
await checkVideoStatus(video.id);
```

---

## 📊 Modelos de Datos

### User

```typescript
{
  id: string;
  email: string;
  role: "ADMIN" | "SUBADMIN" | "USER";
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
```

### Category (Curso)

```typescript
{
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  priceARS: number;          // Precio en Pesos Argentinos
  priceUSD: number;          // Precio en Dólares
  isFree: boolean;           // Si el curso es gratuito
  order: number;
  isActive: boolean;
  videoCount?: number;       // Solo en respuestas
  hasAccess?: boolean;       // Solo si está autenticado - true si compró o es gratis
  isPurchased?: boolean;     // Solo si está autenticado - true si compró específicamente
  createdAt: Date;
  updatedAt: Date;
}
```

### Video

```typescript
{
  id: string;
  title: string;
  slug: string;
  description?: string;
  thumbnail?: string;    // Obtenido automáticamente de Vimeo
  duration?: number;     // En segundos - Obtenido de Vimeo
  categoryId: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  isPublished: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

**⚠️ Nota Importante**: 
- **Los videos NO tienen precio propio**. El pricing se maneja a nivel de categoría/curso
- Para verificar si un usuario tiene acceso a un video, verifica el `hasAccess` de su categoría
- Al comprar una categoría, el usuario obtiene acceso a todos los videos de ese curso

---

## ⚠️ Códigos de Estado HTTP

| Código | Descripción |
|--------|-------------|
| 200 | OK - Petición exitosa |
| 201 | Created - Recurso creado exitosamente |
| 204 | No Content - Recurso eliminado exitosamente |
| 400 | Bad Request - Error en los datos enviados |
| 401 | Unauthorized - No autenticado o token inválido |
| 403 | Forbidden - No tienes permisos para esta acción |
| 404 | Not Found - Recurso no encontrado |
| 409 | Conflict - Conflicto (ej: slug duplicado) |
| 429 | Too Many Requests - Límite de tasa excedido |
| 500 | Internal Server Error - Error del servidor |

---

## 🔒 Rate Limiting

La API implementa límites de tasa en diferentes niveles:

| Tipo | Límite | Ventana de Tiempo |
|------|--------|-------------------|
| short | 10 requests | 1 segundo |
| medium | 100 requests | 1 minuto |
| long | 500 requests | 15 minutos |

### Endpoints Especiales:
- `POST /auth/register`: 3 requests por minuto
- `POST /auth/login`: 5 requests por minuto

**Headers de Rate Limit**:
```
X-RateLimit-Limit-short: 10
X-RateLimit-Remaining-short: 9
X-RateLimit-Reset-short: 1
X-RateLimit-Limit-medium: 100
X-RateLimit-Remaining-medium: 99
X-RateLimit-Reset-medium: 60
X-RateLimit-Limit-long: 500
X-RateLimit-Remaining-long: 499
X-RateLimit-Reset-long: 900
```

---

## 🛡️ Seguridad

### Headers de Seguridad

La API incluye automáticamente headers de seguridad:

- `Strict-Transport-Security`: Fuerza HTTPS
- `X-Content-Type-Options`: Previene MIME sniffing
- `X-Frame-Options`: Previene clickjacking
- `X-XSS-Protection`: Protección XSS
- `Referrer-Policy`: Control de información del referrer

### CORS

Configurado para aceptar requests desde dominios permitidos. En desarrollo acepta desde `http://localhost:3000` y `http://localhost:3000`.

---

## 💡 Ejemplos de Uso

### TypeScript/JavaScript (Fetch)

```typescript
// Login
const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123',
  }),
});

const { data } = await loginResponse.json();
const token = data.accessToken;

// Verificar sesión y obtener usuario actual
const meResponse = await fetch('http://localhost:3000/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

const currentUser = await meResponse.json();
console.log('Usuario actual:', currentUser.data);

// Obtener videos (autenticado)
const videosResponse = await fetch('http://localhost:3000/api/videos?page=1&limit=10', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

const videos = await videosResponse.json();
```

### Axios

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});

// Interceptor para agregar token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Login
const { data } = await api.post('/auth/login', {
  email: 'user@example.com',
  password: 'password123',
});
localStorage.setItem('token', data.data.accessToken);

// Crear categoría/curso
const category = await api.post('/categories', {
  name: 'Curso de Cejas',
  slug: 'curso-cejas',
  priceARS: 89999.99,
  priceUSD: 89.99,
  isFree: false,
});

// Crear video dentro del curso
const video = await api.post('/videos', {
  title: 'Mi Video',
  slug: 'mi-video',
  vimeoId: '123456789',
  categoryId: category.data.id,
});
```

### React Hooks Examples

```typescript
import { useState, useEffect } from 'react';
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});

// Agregar token si existe
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Hook para obtener categorías/cursos
function useCourses(page = 1) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '10',
          sortBy: 'order',
          sortOrder: 'asc',
        });
        
        const { data } = await api.get(`/categories?${params}`);
        setCourses(data.data);
        setMeta(data.meta);
      } catch (error) {
        console.error('Error fetching courses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [page]);

  return { courses, loading, meta };
}

// Hook para obtener videos de un curso
function useCourseVideos(categoryId: string, page = 1) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '10',
          categoryId,
          isPublished: 'true',
        });
        
        const { data } = await api.get(`/videos?${params}`);
        setVideos(data.data);
        setMeta(data.meta);
      } catch (error) {
        console.error('Error fetching videos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [page, categoryId]);

  return { videos, loading, meta };
}

// Hook para verificar acceso a un curso
function useCourseAccess(courseId: string) {
  const [hasAccess, setHasAccess] = useState(false);
  const [isPurchased, setIsPurchased] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/categories/${courseId}`);
        setHasAccess(data.data.hasAccess || false);
        setIsPurchased(data.data.isPurchased || false);
      } catch (error) {
        console.error('Error checking access:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [courseId]);

  return { hasAccess, isPurchased, loading };
}

// Hook para obtener usuario actual y verificar sesión
function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get('/auth/me');
        setUser(data.data);
        setIsAuthenticated(true);
      } catch (error) {
        // Token inválido o expirado
        localStorage.removeItem('token');
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
  };

  return { user, loading, isAuthenticated, logout };
}
```

---

## 🛒 Sistema de Compras

### Modelo CategoryPurchase

Cuando un usuario compra un curso/categoría, se crea un registro en la tabla `CategoryPurchase`:

```typescript
{
  id: string;
  userId: string;
  categoryId: string;
  amount: number;           // Monto pagado
  currency: string;         // 'ARS' o 'USD'
  paymentMethod?: string;   // Método de pago utilizado
  transactionId?: string;   // ID de transacción del gateway
  status: string;           // Estado de la compra
  purchasedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Verificar Acceso

Para verificar si un usuario tiene acceso a un curso:

```typescript
// Opción 1: Al obtener la categoría (si está autenticado)
const { data } = await api.get(`/categories/${courseId}`);
if (data.data.hasAccess) {
  // Usuario tiene acceso
}

// Opción 2: Verificar los campos hasAccess y isPurchased
// hasAccess = true → Puede acceder (compró o es gratis)
// isPurchased = true → Compró específicamente el curso
if (data.data.isFree || data.data.isPurchased) {
  // Puede acceder al contenido
}
```

### Flujo de Implementación Frontend (Con Carrito)

```typescript
// 1. Mostrar lista de cursos con precios
const { courses } = useCourses();

// 2. Usuario navega y agrega cursos al carrito
const addToCart = async (courseId: string) => {
  await api.post('/cart/add', { categoryId: courseId });
  // Actualizar contador del carrito
  const { data } = await api.get('/cart');
  setCartCount(data.data.itemCount);
};

// 3. Usuario ve su carrito
const { data: cart } = await api.get('/cart');
// cart.data.items = array de cursos
// cart.data.totalARS y totalUSD = totales

// 4. Usuario procede al checkout
const { data: summary } = await api.get('/cart/summary');
// Mostrar resumen con totalARS y totalUSD

// 5. Procesar pago único por todos los cursos
const payment = await processPayment({
  amount: cart.data.totalARS, // o totalUSD según moneda elegida
  currency: 'ARS',
  items: cart.data.items,
});

// 6. Crear CategoryPurchase para cada curso del carrito
for (const item of cart.data.items) {
  await api.post('/category-purchases', {
    categoryId: item.categoryId,
    amount: item.priceARS, // o priceUSD
    currency: 'ARS',
    transactionId: payment.id,
  });
}

// 7. Vaciar carrito después de compra exitosa
await api.delete('/cart');

// 8. Usuario ahora tiene acceso a todos los cursos comprados
```

### Flujo Sin Carrito (Compra Individual)

```typescript
// 1. Mostrar lista de cursos con precios
const { courses } = useCourses();

// 2. Usuario selecciona un curso
const selectedCourse = courses[0];

// 3. Verificar si tiene acceso
if (selectedCourse.hasAccess) {
  // Mostrar contenido del curso
  const { videos } = useCourseVideos(selectedCourse.id);
} else {
  // Mostrar página de compra con ambos precios
  <PurchaseButton 
    priceARS={selectedCourse.priceARS} 
    priceUSD={selectedCourse.priceUSD}
  />
}

// 4. Procesar compra (integración con payment gateway)
// 5. Crear CategoryPurchase en el backend
// 6. Usuario ya tiene acceso al curso completo
```

---

## 📹 Carga de Videos a Vimeo

### Información General

Esta API se integra con Vimeo para almacenar y servir videos. Para videos grandes (como los tuyos de ~1GB en HD), se recomienda usar el **protocolo tus** para carga por partes.

### ✅ Recomendaciones:

1. **Para videos de 1GB**: Usa **tus upload** (carga resumible)
2. **Para videos < 200MB**: Puedes usar carga simple
3. **Plan de Vimeo recomendado**: Pro o superior
4. **Carga desde**: Backend (más seguro y controlado)

### 📦 Dependencias Necesarias:

```bash
pnpm add @vimeo/vimeo tus-js-client @nestjs/platform-express
pnpm add -D @types/multer
```

### 🔗 Documentación Completa:

Para ver la implementación completa de carga de videos a Vimeo con código de ejemplo, consulta:

**📄 [`docs/VIMEO-UPLOAD.md`](./docs/VIMEO-UPLOAD.md)**

Esta documentación incluye:
- ✅ Código completo de implementación con tus upload
- ✅ Manejo de archivos de 1GB+
- ✅ Progreso en tiempo real
- ✅ Comparación de métodos de carga
- ✅ Recomendaciones de seguridad
- ✅ Costos de planes de Vimeo
- ✅ Alternativas y mejores prácticas

### Endpoints de Video Implementados

La API incluye dos formas de trabajar con videos de Vimeo:

#### Opción 1: Carga Automática a Vimeo (Recomendado)
- ✅ `POST /videos/upload` - Subir video directamente a Vimeo (hasta 2GB)
- ✅ `GET /videos/:id/upload-status` - Verificar estado de procesamiento

#### Opción 2: Video Ya en Vimeo
- `POST /videos` - Crear video (requiere `vimeoId` existente)

#### Reproducción y Progreso
- `GET /videos/:id/stream` - Obtener URL de streaming segura
- `GET /videos/:id/progress` - Obtener progreso de visualización
- `POST /videos/:id/progress` - Actualizar progreso

### Proceso de Carga Completo

```
1. Admin sube archivo (1GB) via POST /videos/upload
   ↓
2. Backend guarda temporalmente en ./tmp/uploads
   ↓
3. Valida tipo, tamaño y extensión
   ↓
4. Sube a Vimeo con protocolo tus (carga resumible)
   ↓
5. Logs muestran progreso en tiempo real
   ↓
6. Vimeo confirma recepción
   ↓
7. Backend espera inicio de procesamiento (max 5 min)
   ↓
8. Obtiene thumbnail y duración automáticamente
   ↓
9. Crea registro en base de datos
   ↓
10. Limpia archivo temporal
   ↓
11. Retorna VideoResponseDto
   ↓
12. Admin puede verificar estado con GET /videos/:id/upload-status
```

### Características de la Carga

- **Protocolo tus**: Carga resumible (puede continuar si falla)
- **Tamaño máximo**: 2GB por archivo
- **Formatos**: MP4, MOV, AVI, MKV, MPEG
- **Timeout**: 1 hora (configurado en el servidor)
- **Progreso**: Visible en logs del servidor
- **Seguridad**: Solo ADMIN y SUBADMIN pueden subir
- **Privacidad**: Videos privados en Vimeo por defecto
- **Limpieza**: Archivos temporales se eliminan automáticamente

### Documentación Técnica Completa

Para implementación detallada, ver:
- **📄 [`docs/VIMEO-UPLOAD.md`](./docs/VIMEO-UPLOAD.md)** - Guía técnica completa
- **📄 [`VIMEO_UPLOAD_IMPLEMENTATION.md`](./VIMEO_UPLOAD_IMPLEMENTATION.md)** - Detalles de implementación

---

## 📞 Soporte

Para más información o soporte, consulta la documentación interactiva en Swagger UI: `http://localhost:3000/api/docs`

### Documentación Adicional

- **Sistema de Carrito**: [`CART_IMPLEMENTATION.md`](./CART_IMPLEMENTATION.md)
- **Carga de Videos (Guía Técnica)**: [`docs/VIMEO-UPLOAD.md`](./docs/VIMEO-UPLOAD.md)
- **Carga de Videos (Implementación)**: [`VIMEO_UPLOAD_IMPLEMENTATION.md`](./VIMEO_UPLOAD_IMPLEMENTATION.md)
- **Cookies HttpOnly**: [`docs/HTTPONLY-COOKIES.md`](./docs/HTTPONLY-COOKIES.md)
- **Configuración Email**: [`docs/EMAIL-VERIFICATION.md`](./docs/EMAIL-VERIFICATION.md)
- **Logging**: [`docs/LOGGING.md`](./docs/LOGGING.md)
- **Seguridad**: [`docs/SECURITY.md`](./docs/SECURITY.md)

---

**Última actualización**: Octubre 2025  
**Versión**: 1.3 - **VimeoId Visible para Admins**

---

## 📝 Cambios Importantes en esta Versión

### v1.3 - VimeoId Visible para Admins (Nuevo) 🔐

#### ✅ Cambios de Seguridad:

1. **Campo `vimeoId` Ahora Visible para ADMIN/SUBADMIN**
   - **Comportamiento anterior**: El campo `vimeoId` nunca se exponía en las respuestas por seguridad
   - **Comportamiento nuevo**: El campo `vimeoId` se incluye en las respuestas solo cuando el usuario autenticado tiene rol `ADMIN` o `SUBADMIN`
   - **Para usuarios regulares (USER)**: El campo NO se incluye (protección contra scraping)
   - **Para usuarios no autenticados**: El campo NO se incluye
   - **Aplica a todos los endpoints de videos**: `GET /videos`, `GET /videos/:id`, `POST /videos`, `PATCH /videos/:id`, `POST /videos/upload`
   - **Razón**: Facilita la administración y debugging sin comprometer la seguridad

2. **Guard de Actividad Sospechosa Mejorado** 🛡️
   - Ahora excluye imágenes base64 de la validación (elimina falsos positivos)
   - Mantiene protección contra SQL Injection, XSS, Path Traversal, etc.

#### 📋 Ejemplo de Respuesta por Rol:

**ADMIN/SUBADMIN** (incluye `vimeoId`):
```json
{
  "id": "clx123...",
  "title": "Técnica de Microblading",
  "slug": "tecnica-microblading",
  "vimeoId": "889893557",  ← Solo para ADMIN/SUBADMIN
  "thumbnail": "https://i.vimeocdn.com/...",
  "categoryId": "clx456...",
  "order": 0
}
```

**USER o No Autenticado** (sin `vimeoId`):
```json
{
  "id": "clx123...",
  "title": "Técnica de Microblading",
  "slug": "tecnica-microblading",
  "thumbnail": "https://i.vimeocdn.com/...",
  "categoryId": "clx456...",
  "order": 0
}
```

#### 🔒 ¿Por Qué Este Cambio?

- **Facilita administración**: Los admins pueden ver directamente el ID de Vimeo sin necesidad de consultar la base de datos
- **Mantiene seguridad**: Los usuarios regulares siguen sin poder acceder al `vimeoId` (previene scraping de videos)
- **Mejor experiencia de debugging**: Facilita la resolución de problemas con videos
- **Acceso controlado**: El `vimeoUrl` sigue NUNCA exponiéndose (ni para admins)

---

### v1.2 - Carga de Videos a Vimeo

#### ✅ Nuevas Funcionalidades:

1. **Carga Directa de Videos a Vimeo** 📹
   - Endpoint `POST /videos/upload` para subir archivos hasta 2GB
   - Protocolo tus (carga resumible) para archivos grandes
   - Procesamiento automático: thumbnail, duración, metadata
   - Endpoint `GET /videos/:id/upload-status` para verificar procesamiento
   - Validación completa: tipo, tamaño, formato
   - Limpieza automática de archivos temporales
   - Timeout de 1 hora para archivos grandes
   - Ver documentación completa en `docs/VIMEO-UPLOAD.md` y `VIMEO_UPLOAD_IMPLEMENTATION.md`

2. **Dependencias Instaladas**:
   - `tus-js-client@4.3.1`: Protocolo de carga resumible
   - `@types/multer@2.0.0`: Tipos para manejo de archivos

### v1.1 - Sistema de Carrito de Compras

#### ✅ Nuevas Funcionalidades:

1. **Carrito de Compras** 🛒
   - Los usuarios pueden agregar múltiples cursos al carrito
   - Pago único por todos los cursos seleccionados
   - Los precios se guardan como snapshot (protección contra cambios de precio)
   - Validación automática de cursos ya comprados
   - Nuevos endpoints: `GET /cart`, `POST /cart/add`, `DELETE /cart`, etc.

2. **Autenticación con Cookies HttpOnly** 🍪
   - Mayor seguridad contra ataques XSS
   - Sesión persiste después de F5
   - Soporte dual: Cookies + Bearer tokens
   - Nuevo endpoint: `POST /auth/logout`
   - Ver documentación completa en `docs/HTTPONLY-COOKIES.md`

3. **Documentación de Carga de Videos** 📹
   - Guía completa para subir videos de 1GB a Vimeo
   - Implementación con protocolo tus (resumible)
   - Código de ejemplo completo
   - Ver `docs/VIMEO-UPLOAD.md`

### v1.0 - Sistema de Cursos con Precios Duales

#### ✅ Cambios Implementados:

1. **Categorías = Cursos Completos**
   - Las categorías ahora representan cursos que se pueden comprar
   - Cada categoría tiene `priceARS` y `priceUSD` que coexisten
   - Campo `isFree` para cursos gratuitos

2. **Videos sin Precio Individual**
   - Los videos ya NO tienen campos `price`, `currency` o `isFree`
   - El acceso a videos se controla a nivel de categoría/curso
   - Al comprar una categoría, se accede a todos sus videos

3. **Modelo de Compras**
   - `VideoPurchase` renombrado a `CategoryPurchase`
   - Las compras se hacen por curso completo, no por video individual
   - Soporte para transacciones en ARS o USD

4. **Campos de Acceso**
   - `hasAccess`: `true` si el usuario compró el curso o es gratuito
   - `isPurchased`: `true` si el usuario compró específicamente el curso
   - Estos campos solo aparecen cuando el usuario está autenticado

#### 🎯 Impacto en el Frontend (v1.2):

- **Carga de Videos**: Panel de admin puede subir videos directamente
- **Progreso de Carga**: Implementar indicador de progreso con `onUploadProgress`
- **Verificación de Estado**: Polling con `/upload-status` para saber cuándo está listo
- **Formatos Soportados**: MP4, MOV, AVI, MKV, MPEG (hasta 2GB)

#### 🎯 Impacto en el Frontend (v1.1):

- **Carrito de Compras**: Nuevos endpoints para gestionar carrito
- **Autenticación**: Usar `credentials: 'include'` en fetch para cookies
- **Logout**: Llamar a `POST /auth/logout` para cerrar sesión correctamente
- **Flujo de Compra**: Ahora soporta compra múltiple de cursos

#### 🎯 Impacto en el Frontend (v1.0):

- **Endpoints de Categorías**: Ahora retornan `priceARS`, `priceUSD`, `isFree`, `hasAccess`, `isPurchased`
- **Endpoints de Videos**: Ya NO retornan campos de pricing
- **Verificación de Acceso**: Se debe verificar a nivel de categoría, no de video
- **Flujo de Compra**: Se compran cursos completos, no videos individuales
- **Visualización de Precios**: Mostrar ambas monedas (ARS y USD) al usuario

#### 📦 Ejemplos de Datos:

**Curso de Ejemplo:**
```json
{
  "name": "Curso de Cejas",
  "priceARS": 89999.99,
  "priceUSD": 89.99,
  "isFree": false,
  "hasAccess": true,
  "isPurchased": true
}
```

**Video de Ejemplo:**
```json
{
  "title": "Técnica de Microblading",
  "categoryId": "curso-cejas-id",
  "category": {
    "name": "Curso de Cejas",
    "slug": "curso-cejas"
  }
  // ❌ NO tiene price, currency, isFree
}
```



