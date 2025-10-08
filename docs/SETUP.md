# 🚀 Guía de Configuración Rápida

## Paso 1: Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Database (ya configurada)
DATABASE_URL="tu-url-actual-de-railway"

# JWT
JWT_SECRET="cambia-esto-por-un-secreto-seguro"
JWT_EXPIRES_IN="24h"

# Application
PORT=3000
NODE_ENV="development"

# Swagger
SWAGGER_ENABLED=true
SWAGGER_PASSWORD="admin123"

# CORS
CORS_ORIGIN="http://localhost:3000"

# Brevo (Email Service) - IMPORTANTE: Configurar antes de usar
BREVO_API_KEY="tu-api-key-de-brevo"
EMAIL_FROM="noreply@merygarcia.com"
FRONTEND_URL="http://localhost:3000"
```

## Paso 2: Obtener API Key de Brevo

1. **Crear cuenta gratuita**: https://app.brevo.com/account/register
   - Plan gratuito: 300 emails/día

2. **Obtener API Key**:
   - Una vez logueado, ve a: **Settings** (⚙️) → **SMTP & API** → **API Keys**
   - Click en **Generate a new API key**
   - Dale un nombre: "Mery Portal API"
   - Copia la clave y pégala en `.env` como `BREVO_API_KEY`

3. **Verificar email remitente**:
   - Ve a: **Settings** → **Senders & IP**
   - Agrega tu email (puede ser Gmail inicialmente para testing)
   - Verifica el email siguiendo las instrucciones

## Paso 3: Base de Datos ya Sincronizada ✅

La base de datos ya ha sido actualizada con los nuevos campos de verificación de email.

**Campos agregados a la tabla `users`:**
- `isEmailVerified` - Boolean (default: false)
- `emailVerificationToken` - String (nullable)
- `emailVerificationExpires` - DateTime (nullable)
- `lastVerificationEmailSent` - DateTime (nullable)
- `passwordResetToken` - String (nullable)
- `passwordResetExpires` - DateTime (nullable)
- `lastPasswordResetEmailSent` - DateTime (nullable)

## Paso 4: Probar el Sistema

### Opción A: Usando el servidor de desarrollo

```bash
pnpm run start:dev
```

La aplicación estará disponible en: http://localhost:3000

### Opción B: Usando Swagger

1. Accede a: http://localhost:3000/api/docs
2. Verás todos los nuevos endpoints de autenticación

## 🧪 Test Rápido

### 1. Registrar un nuevo usuario

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tu-email@example.com",
    "password": "Password123",
    "firstName": "Tu Nombre",
    "lastName": "Tu Apellido"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente. Por favor verifica tu correo electrónico.",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**📧 Recibirás un email con:**
- Diseño elegante (negro, blanco, rosa)
- Botón para verificar email
- Token válido por 24 horas

### 2. Verificar email

Copia el token del email recibido y ejecuta:

```bash
curl -X POST http://localhost:3000/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token": "EL_TOKEN_DEL_EMAIL"}'
```

### 3. Iniciar sesión

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tu-email@example.com",
    "password": "Password123"
  }'
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "24h",
    "role": "USER",
    "email": "tu-email@example.com",
    "firstName": "Tu Nombre",
    "lastName": "Tu Apellido"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🔧 Usuarios de Prueba (Pre-verificados)

Si ejecutaste el seed, estos usuarios ya están verificados:

```bash
pnpm run db:seed
```

- **Admin**: admin@mery.com / admin123
- **Subadmin**: subadmin@mery.com / subadmin123
- **User**: user@mery.com / user123

## 📋 Checklist de Configuración

- [ ] Archivo `.env` creado con todas las variables
- [ ] Cuenta de Brevo creada
- [ ] API Key de Brevo configurada
- [ ] Email remitente verificado en Brevo
- [ ] Aplicación corriendo (`pnpm run start:dev`)
- [ ] Swagger accesible (http://localhost:3000/api/docs)
- [ ] Registro de usuario probado
- [ ] Email de verificación recibido
- [ ] Login exitoso después de verificar

## 🎨 Personalización de Emails

Los templates de email están en:
```
src/modules/email/email.service.ts
```

Puedes personalizar:
- Colores
- Textos
- Logo (actualmente texto "MERY GARCIA")
- Estilo

## 🚨 Troubleshooting

### No recibo emails

1. **Verificar logs del servidor**: Busca mensajes de `EmailService`
2. **Revisar Brevo dashboard**: Settings → Logs → Check failed deliveries
3. **Verificar spam**: Los emails pueden llegar a spam inicialmente
4. **API Key**: Asegúrate que la API Key sea correcta

### Error "Por favor espera X minutos"

- Es el rate limiting (2 emails/hora)
- Espera el tiempo indicado
- O para testing: limpia los campos de fecha en la base de datos

### Token inválido o expirado

- Verificación: válido 24 horas
- Reset password: válido 1 hora
- Solicita un nuevo token si expiró

## 📚 Documentación Completa

- **Verificación de Email**: [EMAIL-VERIFICATION.md](./EMAIL-VERIFICATION.md)
- **README Principal**: [../README.md](../README.md)
- **Swagger**: http://localhost:3000/api/docs (cuando el servidor esté corriendo)

## 🎉 ¡Listo!

Si todos los pasos anteriores funcionaron, tu sistema de verificación de email y restablecimiento de contraseña está completamente operativo.

### Próximos Pasos Sugeridos

1. Personalizar los templates de email con tu logo
2. Configurar un dominio personalizado en Brevo
3. Probar el flujo de restablecimiento de contraseña
4. Implementar el frontend para consumir estos endpoints
