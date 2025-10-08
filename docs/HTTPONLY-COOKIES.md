# 🍪 Autenticación con Cookies HttpOnly

## 📋 Resumen

El sistema de autenticación ahora soporta **cookies HttpOnly** como método principal de autenticación, manteniendo compatibilidad con **Bearer tokens** para flexibilidad (APIs, apps móviles, etc.).

## 🔒 Ventajas de Seguridad

### ✅ Cookies HttpOnly
- **Inmunes a XSS**: JavaScript no puede acceder a cookies con `httpOnly: true`
- **Persistencia automática**: El navegador envía la cookie automáticamente en cada request
- **Mejor UX**: La sesión sobrevive a F5 y recargas de página
- **Protección CSRF**: Con `sameSite: 'lax'`

### ⚠️ Bearer Tokens (anterior)
- Vulnerables a XSS si se guardan en `localStorage`
- Requieren manejo manual en el frontend
- Útiles para APIs y apps móviles

## 🎯 Cómo Funciona

### 1. Login (Backend)

Cuando un usuario inicia sesión, el backend:
1. Valida credenciales
2. Genera JWT
3. **Envía el JWT en dos formas**:
   - En el body de la respuesta (para compatibilidad)
   - En una cookie HttpOnly llamada `auth_token`

```typescript
// POST /api/auth/login
{
  "email": "user@example.com",
  "password": "Password123"
}

// Respuesta
Response Headers:
Set-Cookie: auth_token=eyJhbGc...; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400

Response Body:
{
  "accessToken": "eyJhbGc...",
  "expiresIn": "24h",
  "role": "USER",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

### 2. Logout (Backend)

```typescript
// POST /api/auth/logout
// Respuesta limpia la cookie
Response Headers:
Set-Cookie: auth_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
```

### 3. Autenticación en Requests Siguientes

El JWT Strategy busca el token en dos lugares (en orden de prioridad):
1. **Cookie `auth_token`** (preferido para web apps)
2. **Header `Authorization: Bearer <token>`** (fallback para APIs/móvil)

## 💻 Implementación Frontend

### Opción 1: Cookie HttpOnly (Recomendado para Web)

```typescript
// Login
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // ⚠️ IMPORTANTE: Necesario para cookies
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'Password123',
  }),
});

const data = await response.json();

// ✅ La cookie se guarda automáticamente
// ✅ No necesitas guardar nada en localStorage

// Requests siguientes
const videos = await fetch('http://localhost:3000/api/videos', {
  credentials: 'include', // ⚠️ IMPORTANTE: Envía la cookie
});

// Logout
await fetch('http://localhost:3000/api/auth/logout', {
  method: 'POST',
  credentials: 'include', // ⚠️ IMPORTANTE: Para limpiar la cookie
});
```

### Opción 2: Bearer Token (Para APIs/Móvil)

```typescript
// Login (igual que antes)
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'Password123',
  }),
});

const { accessToken } = await response.json();

// Guardar token (considera seguridad)
localStorage.setItem('token', accessToken);

// Requests siguientes
const videos = await fetch('http://localhost:3000/api/videos', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
});
```

## 🔧 Configuración del Sistema

### 1. Cookie Settings

```typescript
// src/modules/auth/auth.controller.ts (líneas 90-96)
res.cookie('auth_token', authResponse.accessToken, {
  httpOnly: true,              // No accesible via JavaScript (protección XSS)
  sameSite: 'lax',            // Protección CSRF + sobrevive navegación normal
  path: '/',                  // Válida en toda la app
  maxAge: 24 * 60 * 60 * 1000, // 24 horas (coincide con expiración JWT)
  secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción
});
```

### 2. JWT Strategy

```typescript
// src/modules/auth/strategies/jwt.strategy.ts (líneas 13-27)
const cookieAndHeaderExtractor = (req: Request): string | null => {
  let token = null;

  // 1. Intenta extraer de cookie primero (método preferido)
  if (req && req.cookies && req.cookies['auth_token']) {
    token = req.cookies['auth_token'];
  }

  // 2. Fallback al header Authorization (para móvil, APIs, etc.)
  if (!token) {
    token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  }

  return token;
};
```

### 3. CORS Configuration

```typescript
// src/main.ts (línea 57)
app.enableCors({
  origin: allowedOrigins, // Configurado vía CORS_ORIGIN en .env
  credentials: true,      // ⚠️ CRÍTICO: Permite envío/recepción de cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', ...],
});
```

### 4. Cookie Parser

```typescript
// src/main.ts (línea 23)
app.use(cookieParser()); // Necesario para leer cookies en req.cookies
```

## 🌍 Variables de Entorno

```bash
# .env
CORS_ORIGIN=http://localhost:3000,http://localhost:3000
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=24h
NODE_ENV=development
```

En producción:
```bash
CORS_ORIGIN=https://merygarcia.com
NODE_ENV=production
```

## 🧪 Pruebas

### Con cURL

```bash
# Login (con cookies)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123456"}' \
  -c cookies.txt \
  -v

# Usar cookie en siguiente request
curl http://localhost:3000/api/auth/me \
  -b cookies.txt \
  -v

# Logout
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt \
  -c cookies.txt \
  -v
```

### Con Postman

1. **Login**: 
   - POST a `/api/auth/login`
   - La cookie se guarda automáticamente si "Enable cookie jar" está activo

2. **Requests siguientes**:
   - Postman envía automáticamente las cookies guardadas

3. **Logout**:
   - POST a `/api/auth/logout`
   - La cookie se limpia automáticamente

## 📱 Casos de Uso

### ✅ Web App (React, Vue, Angular, etc.)
- **Usar**: Cookies HttpOnly
- **Configuración**: `credentials: 'include'` en todos los fetch
- **Seguridad**: Máxima (inmune a XSS)

### ✅ Mobile App Nativa (React Native, Flutter, etc.)
- **Usar**: Bearer Token
- **Configuración**: Header `Authorization: Bearer <token>`
- **Nota**: Guardar token de forma segura (Keychain, Keystore)

### ✅ Server-to-Server API
- **Usar**: Bearer Token
- **Configuración**: Header `Authorization: Bearer <token>`

### ✅ Aplicación Híbrida
- **Usar**: Ambos (el sistema soporta dual authentication)
- Web usa cookies, móvil usa Bearer tokens

## 🔐 Consideraciones de Seguridad

### Producción HTTPS

```typescript
// En producción con HTTPS
res.cookie('auth_token', token, {
  httpOnly: true,
  sameSite: 'lax',    // o 'strict' para más seguridad
  secure: true,       // ⚠️ Solo HTTPS
  path: '/',
  maxAge: 24 * 60 * 60 * 1000,
});
```

### SameSite Options

- `'lax'` (actual): Protección CSRF + funciona con navegación normal
- `'strict'`: Máxima protección CSRF (la cookie NO se envía en navegación desde otros sitios)
- `'none'`: Sin protección (requiere `secure: true`)

### Subdominios

Si necesitas compartir cookies entre subdominios:

```typescript
res.cookie('auth_token', token, {
  // ... otras opciones
  domain: '.merygarcia.com', // ⚠️ Permite api.merygarcia.com y www.merygarcia.com
});
```

## 🎉 Resultado Final

- ✅ Cookies HttpOnly implementadas
- ✅ Endpoint de logout funcional
- ✅ Compatibilidad dual (Cookie + Bearer Token)
- ✅ CORS configurado correctamente
- ✅ Sin errores de linting
- ✅ Seguridad mejorada contra XSS
- ✅ Mejor UX (sesión persiste tras F5)

## 📚 Referencias

- [OWASP - HttpOnly Cookie](https://owasp.org/www-community/HttpOnly)
- [MDN - SameSite Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [NestJS - Cookies](https://docs.nestjs.com/techniques/cookies)

