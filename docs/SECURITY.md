# 🛡️ Guía de Seguridad - Mery Portal Backend

## 📋 Mejoras de Seguridad Implementadas

Para un backend con ~100 usuarios concurrentes diarios, se han implementado las siguientes capas de seguridad:

---

## 1. 🚦 Rate Limiting (Control de Tasa)

### Configuración Global

**3 niveles de protección:**

```typescript
- Short:  10 requests / segundo
- Medium: 100 requests / minuto  
- Long:   500 requests / 15 minutos
```

### Rate Limiting Específico en Endpoints Sensibles

**Login:**
- Máximo 5 intentos por minuto por IP
- Previene ataques de fuerza bruta

**Registro:**
- Máximo 3 registros por minuto por IP
- Previene spam de cuentas

**Verificación de Email:**
- Máximo 2 por hora (ya implementado en lógica)

**Reset de Contraseña:**
- Máximo 2 por hora (ya implementado en lógica)

### Respuesta cuando se excede el límite:

```http
HTTP 429 Too Many Requests
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

---

## 2. 🪖 Helmet.js - Headers de Seguridad HTTP

Protección automática contra las vulnerabilidades web más comunes:

### Headers configurados:

```http
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=15552000; includeSubDomains
X-Download-Options: noopen
X-DNS-Prefetch-Control: off
```

### Configuración especial:

- **CSP (Content Security Policy)**: Deshabilitado en desarrollo para Swagger
- **COEP**: Deshabilitado para permitir embeds de Vimeo
- **CORP**: Configurado como `cross-origin` para recursos de Vimeo

---

## 3. 🌐 CORS Mejorado (Cross-Origin Resource Sharing)

### Configuración Estricta

```typescript
Orígenes permitidos: Configurables por ENV
Métodos: GET, POST, PUT, PATCH, DELETE, OPTIONS
Headers permitidos: Content-Type, Authorization, etc.
Credentials: true
Max Age: 24 horas
```

### Variables de Entorno

```env
# Desarrollo
CORS_ORIGIN="http://localhost:3000"

# Producción (múltiples orígenes)
CORS_ORIGIN="https://tu-dominio.com,https://www.tu-dominio.com"

# Permitir todos (NO recomendado en producción)
CORS_ORIGIN="*"
```

### Logging de Bloqueos

Cuando se bloquea una solicitud CORS, se registra:

```
[Warn] Blocked CORS request from origin: https://malicious-site.com
```

---

## 4. ✅ Validación y Sanitización de Inputs

### Validación Automática con class-validator

**Todas las entradas se validan:**
- Tipos de datos correctos
- Longitudes mínimas/máximas
- Formatos (email, URL, etc.)
- Valores permitidos (enums)

### Protección contra Injection

```typescript
whitelist: true              // Elimina propiedades no decoradas
forbidNonWhitelisted: true   // Error si hay propiedades extras
transform: true              // Transforma a instancias de DTO
```

### En Producción

```typescript
disableErrorMessages: true   // Oculta detalles de errores
validationError: {
  target: false,             // No expone clase
  value: false               // No expone valor enviado
}
```

**Ejemplo de input malicioso bloqueado:**

```json
// Request malicioso
{
  "email": "user@test.com",
  "password": "pass123",
  "__proto__": { "isAdmin": true },  // ❌ Bloqueado
  "constructor": { "prototype": {} }  // ❌ Bloqueado
}
```

---

## 5. 🚨 Detección de Actividad Sospechosa

### Guard de Seguridad Automático

Detecta y bloquea patrones maliciosos en:
- URLs
- Query parameters
- Request body

### Patrones Detectados

**SQL Injection:**
```
' OR 1=1--
UNION SELECT * FROM users
SELECT * FROM passwords
```

**XSS (Cross-Site Scripting):**
```html
<script>alert('xss')</script>
<img src=x onerror="alert('xss')">
javascript:void(0)
```

**Path Traversal:**
```
../../etc/passwd
..\windows\system32
```

**Null Byte Injection:**
```
%00
%0d
%0a
```

### Respuesta ante Actividad Sospechosa

```http
HTTP 403 Forbidden
{
  "statusCode": 403,
  "message": "Actividad sospechosa detectada"
}
```

### Logging

```
[Warn] 🚨 Suspicious activity detected from IP: 192.168.1.100
{
  url: "/api/users?id=1' OR '1'='1",
  method: "GET",
  userAgent: "...",
  pattern: "SQL injection pattern"
}
```

---

## 6. 🗜️ Compresión de Respuestas

Reduce el tamaño de las respuestas hasta un 70%:

```typescript
compression()  // Compresión gzip automática
```

**Beneficios:**
- Menor uso de bandwidth
- Respuestas más rápidas
- Previene ataques de amplificación

---

## 7. 🔐 JWT Security

### Configuración Segura

```typescript
Secret: Variable de entorno
Expiración: 24 horas (configurable)
Algoritmo: HS256
```

### Protección del Token

- Almacenado en `httpOnly` cookies (recomendado)
- Nunca en localStorage (vulnerable a XSS)
- Renovación automática cerca de expiración

### Validación de Token

```typescript
- Token existe y no expiró
- Usuario existe en BD
- Usuario está activo
- Email está verificado
- Usuario no fue eliminado (soft delete)
```

---

## 8. 📊 Logging y Monitoreo

### Niveles de Log

```typescript
Development: error, warn, log, debug, verbose
Production:  error, warn, log
```

### Eventos Registrados

**Seguridad:**
- ✅ Intentos de login fallidos
- ✅ CORS bloqueados
- ✅ Rate limiting excedido
- ✅ Actividad sospechosa
- ✅ Tokens inválidos

**Auditoría:**
- ✅ CRUD operations (con @Auditory)
- ✅ Cambios de rol
- ✅ Eliminaciones
- ✅ IP y User-Agent

**Performance:**
- ✅ Tiempo de respuesta
- ✅ Errores de base de datos
- ✅ Errores de Vimeo

---

## 9. 🔒 Protección de Datos Sensibles

### Nunca Expuestos

**En Respuestas API:**
- ❌ Passwords (hasheados)
- ❌ Reset tokens
- ❌ Email verification tokens
- ❌ vimeoId (para evitar acceso directo)
- ❌ Internal IDs de relaciones

**En Logs:**
- ❌ Passwords
- ❌ Tokens
- ❌ Datos de pago

### Hashing de Contraseñas

```typescript
Algorithm: bcrypt
Salt Rounds: 12
```

**Fortaleza requerida:**
- Mínimo 8 caracteres
- 1 mayúscula
- 1 minúscula
- 1 número

---

## 10. 🌐 Trust Proxy Configuration

Para uso detrás de nginx/load balancer:

```typescript
app.set('trust proxy', 1);
```

**Permite obtener:**
- IP real del cliente
- Protocolo real (HTTP/HTTPS)
- Host original

---

## 📊 Resumen de Protecciones

| Amenaza | Protección | Estado |
|---------|-----------|---------|
| Fuerza bruta | Rate limiting | ✅ |
| DDoS | Rate limiting global | ✅ |
| SQL Injection | Validación + Prisma ORM | ✅ |
| XSS | Helmet + Sanitización | ✅ |
| CSRF | CORS + SameSite cookies | ✅ |
| Clickjacking | X-Frame-Options | ✅ |
| MIME sniffing | X-Content-Type-Options | ✅ |
| Path Traversal | Detección de patrones | ✅ |
| Datos sensibles | Nunca expuestos en API | ✅ |
| Man-in-the-Middle | HTTPS obligatorio (prod) | ⚠️ Configurar |
| Session hijacking | JWT con expiración | ✅ |

---

## 🚀 Configuración Recomendada para Producción

### 1. Variables de Entorno

```env
NODE_ENV=production

# CORS - Solo tu dominio
CORS_ORIGIN=https://tu-dominio.com

# JWT - Clave fuerte
JWT_SECRET=usar-clave-aleatoria-de-64-caracteres-minimo
JWT_EXPIRES_IN=1h

# Swagger - Desactivar o proteger
SWAGGER_ENABLED=false
SWAGGER_PASSWORD=contraseña-muy-segura

# Database - Usar pool de conexiones
DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=10

# Trust Proxy - Si usas nginx
TRUST_PROXY=1
```

### 2. HTTPS Obligatorio

```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Strong SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

### 3. Firewall Configuration

```bash
# ufw (Ubuntu/Debian)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP (redirect)
sudo ufw allow 443/tcp    # HTTPS
sudo ufw enable

# fail2ban para bloquear IPs maliciosas
sudo apt install fail2ban
```

### 4. Database Security

```sql
-- Usuario con permisos limitados
CREATE USER mery_app WITH PASSWORD 'strong_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mery_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mery_app;

-- NO dar permisos de DROP o ALTER en producción
```

### 5. Backups Automáticos

```bash
# Cron job para backup diario
0 2 * * * pg_dump $DATABASE_URL | gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz
```

### 6. Monitoring

Herramientas recomendadas:
- **Sentry**: Error tracking
- **Datadog**: Monitoring y alertas
- **Grafana**: Visualización de métricas
- **PM2**: Process management

```bash
# Instalar PM2
npm install -g pm2

# Ejecutar con PM2
pm2 start dist/main.js --name mery-portal
pm2 startup
pm2 save
```

---

## 🧪 Testing de Seguridad

### 1. Test de Rate Limiting

```bash
# Debería bloquear después de 5 intentos
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
  sleep 1
done
```

### 2. Test de SQL Injection

```bash
# Debería retornar 403 Forbidden
curl "http://localhost:3000/api/users?id=1' OR '1'='1"
```

### 3. Test de XSS

```bash
# Debería retornar 403 Forbidden
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123","firstName":"<script>alert(1)</script>"}'
```

### 4. Test de CORS

```bash
# Desde origen no permitido - debería fallar
curl -X GET http://localhost:3000/api/videos \
  -H "Origin: https://malicious-site.com"
```

---

## 📚 Recursos Adicionales

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NestJS Security Best Practices](https://docs.nestjs.com/security/helmet)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Node.js Security Checklist](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)

---

## ✅ Checklist de Seguridad para Producción

- [ ] HTTPS configurado
- [ ] Variables de entorno seguras
- [ ] JWT_SECRET aleatorio y fuerte
- [ ] CORS configurado correctamente
- [ ] Swagger desactivado o protegido
- [ ] Database con usuario limitado
- [ ] Backups automáticos configurados
- [ ] Firewall activo
- [ ] Monitoring instalado
- [ ] Logs configurados
- [ ] Rate limiting verificado
- [ ] Tests de seguridad pasados
- [ ] PM2 o similar para process management
- [ ] Actualizaciones automáticas de seguridad

---

## 🆘 En Caso de Incidente

1. **Detectar**: Revisar logs para identificar el ataque
2. **Bloquear**: Agregar IP a blacklist en firewall
3. **Analizar**: Determinar vector de ataque
4. **Parchear**: Aplicar fix si es necesario
5. **Documentar**: Registrar incidente y respuesta
6. **Notificar**: Informar a usuarios si sus datos fueron comprometidos

---

## 📞 Contacto

Para reportar vulnerabilidades de seguridad, contactar a: security@merygarcia.com
