# Sistema de Logging

## 📝 Descripción

El proyecto utiliza el **Logger nativo de NestJS** para registrar todas las peticiones HTTP entrantes y sus respuestas. No se requieren librerías adicionales.

## 🎯 Características

### LoggingInterceptor

El `LoggingInterceptor` registra automáticamente:

- ✅ **Método HTTP** (GET, POST, PUT, DELETE, etc.)
- ✅ **URL** del endpoint
- ✅ **IP** del cliente
- ✅ **User-Agent** del navegador/cliente
- ✅ **Código de estado** HTTP (200, 404, 500, etc.)
- ✅ **Tiempo de respuesta** en milisegundos
- ✅ **Errores** con detalles del mensaje

### Formato de Logs

#### Request Entrante
```
[Nest] INFO  [HTTP] ➜ GET /api/categories - IP: ::1 - UserAgent: curl/7.81.0
```

#### Respuesta Exitosa
```
[Nest] INFO  [HTTP] ✓ GET /api/categories 200 - 45ms
```

#### Respuesta con Error
```
[Nest] ERROR [HTTP] ✗ POST /api/auth/login 401 - 123ms - Error: Credenciales inválidas
```

## 🚀 Implementación

### 1. Interceptor (src/shared/interceptors/logging.interceptor.ts)

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || 'Unknown';
    const startTime = Date.now();

    // Log del request entrante
    this.logger.log(
      `➜ ${method} ${url} - IP: ${ip} - UserAgent: ${userAgent}`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const { statusCode } = response;
          const responseTime = Date.now() - startTime;
          
          // Log de la respuesta exitosa
          this.logger.log(
            `✓ ${method} ${url} ${statusCode} - ${responseTime}ms`,
          );
        },
        error: (error) => {
          const responseTime = Date.now() - startTime;
          const statusCode = error.status || 500;
          
          // Log del error
          this.logger.error(
            `✗ ${method} ${url} ${statusCode} - ${responseTime}ms - Error: ${error.message}`,
          );
        },
      }),
    );
  }
}
```

### 2. Registro Global (src/app.module.ts)

```typescript
{
  provide: APP_INTERCEPTOR,
  useClass: LoggingInterceptor,
}
```

## 📊 Ejemplo de Logs en Producción

```bash
[Nest] 12345  - 10/07/2025, 8:45:23 PM   INFO  [HTTP] ➜ GET /api/categories - IP: 192.168.1.100 - UserAgent: Mozilla/5.0
[Nest] 12345  - 10/07/2025, 8:45:23 PM   INFO  [HTTP] ✓ GET /api/categories 200 - 34ms
[Nest] 12345  - 10/07/2025, 8:45:25 PM   INFO  [HTTP] ➜ POST /api/auth/login - IP: 192.168.1.100 - UserAgent: Mozilla/5.0
[Nest] 12345  - 10/07/2025, 8:45:25 PM   INFO  [HTTP] ✓ POST /api/auth/login 200 - 567ms
[Nest] 12345  - 10/07/2025, 8:45:30 PM   INFO  [HTTP] ➜ GET /api/videos/stream-url/abc123 - IP: 192.168.1.100 - UserAgent: Mozilla/5.0
[Nest] 12345  - 10/07/2025, 8:45:30 PM   ERROR [HTTP] ✗ GET /api/videos/stream-url/abc123 401 - 12ms - Error: No tienes acceso a este video
```

## 🔧 Configuración de Niveles de Log

En `main.ts`, puedes configurar qué niveles de log mostrar:

```typescript
const app = await NestFactory.create(AppModule, {
  logger: ['error', 'warn', 'log', 'debug', 'verbose'],
});
```

### Niveles Disponibles

| Nivel | Descripción | Cuándo usar |
|-------|-------------|-------------|
| `error` | Errores críticos | Siempre activo |
| `warn` | Advertencias | Siempre activo |
| `log` | Información general | Desarrollo y Producción |
| `debug` | Debug detallado | Solo desarrollo |
| `verbose` | Máximo detalle | Solo debugging |

### Configuración Recomendada

#### Desarrollo
```typescript
logger: ['error', 'warn', 'log', 'debug', 'verbose']
```

#### Producción
```typescript
logger: ['error', 'warn', 'log']
```

## 📈 Análisis y Monitoreo

### 1. Ver logs en tiempo real

```bash
# Modo desarrollo
npm run start:dev

# Modo producción
npm run start:prod | tee logs/app.log
```

### 2. Filtrar logs

```bash
# Solo errores
npm run start:prod 2>&1 | grep ERROR

# Solo requests HTTP
npm run start:prod 2>&1 | grep HTTP

# Solo requests lentos (>1000ms)
npm run start:prod 2>&1 | grep -E "[0-9]{4,}ms"
```

### 3. Guardar logs en archivo

```bash
# Guardar todos los logs
npm run start:prod > logs/app.log 2>&1

# Guardar solo errores
npm run start:prod 2> logs/errors.log
```

## 🔍 Integración con Herramientas Externas

Si necesitas logging más avanzado, puedes integrar:

### 1. **Winston** (Logging avanzado)

```bash
pnpm add nest-winston winston
```

### 2. **Pino** (Logging de alto rendimiento)

```bash
pnpm add nestjs-pino pino-http
```

### 3. **LogRocket** / **Sentry** (APM y Error Tracking)

Para monitoreo en producción.

### 4. **ELK Stack** (Elasticsearch, Logstash, Kibana)

Para análisis de logs a gran escala.

## 🎨 Personalización

### Agregar información adicional

Puedes extender el interceptor para loggear información adicional:

```typescript
// Agregar información del usuario autenticado
const user = request.user;
if (user) {
  this.logger.log(`User: ${user.email} (${user.role})`);
}

// Agregar información del body (sin datos sensibles)
if (method === 'POST' || method === 'PUT') {
  const safeBody = this.sanitizeBody(request.body);
  this.logger.debug(`Body: ${JSON.stringify(safeBody)}`);
}
```

### Excluir ciertos endpoints

```typescript
const excludedPaths = ['/health', '/metrics'];
if (excludedPaths.some(path => url.includes(path))) {
  return next.handle(); // No loggear
}
```

## 📋 Buenas Prácticas

1. ✅ **No loggear información sensible**: contraseñas, tokens, datos personales
2. ✅ **Usar niveles apropiados**: ERROR para errores, INFO para requests normales
3. ✅ **Incluir contexto suficiente**: IP, User-Agent, tiempo de respuesta
4. ✅ **Rotar logs en producción**: Usar herramientas como `logrotate`
5. ✅ **Monitorear logs regularmente**: Detectar patrones de errores
6. ✅ **Agregar timestamps**: NestJS los incluye automáticamente

## 🚨 Seguridad

### No loggear datos sensibles

```typescript
// ❌ MAL
this.logger.log(`Password: ${password}`);

// ✅ BIEN
this.logger.log(`Login attempt for user: ${email}`);
```

### Sanitizar información

```typescript
private sanitizeBody(body: any): any {
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey'];
  const sanitized = { ...body };
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  });
  
  return sanitized;
}
```

## 📝 Resumen

- ✅ Sistema de logging integrado con NestJS (sin librerías adicionales)
- ✅ Logs automáticos de todas las peticiones HTTP
- ✅ Información detallada: método, URL, IP, tiempo de respuesta
- ✅ Fácil de extender y personalizar
- ✅ Listo para producción

---

**Última actualización**: Octubre 2025

