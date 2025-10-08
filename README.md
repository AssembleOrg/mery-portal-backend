# Mery Portal Backend

Backend API para el portal de videos Mery, construido con NestJS siguiendo principios de Clean Architecture.

## 🚀 Características

- **Clean Architecture** con separación de responsabilidades
- **Autenticación JWT** con roles (Admin, Subadmin, User)
- **Verificación de Email** con Brevo (SendinBlue)
- **Restablecimiento de Contraseña** con tokens seguros
- **Sistema de Videos** con Vimeo Pro + control de acceso
- **Base de datos PostgreSQL** con Prisma ORM
- **Auditoría completa** con logs de cambios CRUD
- **Documentación Swagger** protegida en producción
- **Paginación** estandarizada para todos los endpoints
- **Soft Deletes** con timestamps en GMT-3
- **Validación** robusta con class-validator
- **Manejo de errores** en español
- **Templates de Email** elegantes y responsive

### 🛡️ Seguridad Avanzada
- **Rate Limiting Global** (10/seg, 100/min, 500/15min)
- **Rate Limiting Específico** en login/register
- **Helmet.js** para headers de seguridad HTTP
- **CORS estricto** con whitelist configurable
- **Detección de Actividad Sospechosa** (SQL injection, XSS, Path traversal)
- **Validación y Sanitización** automática de inputs
- **Compresión** de respuestas
- **Logging** de eventos de seguridad
- **Trust Proxy** para IPs reales detrás de load balancer

## 📋 Requisitos

- Node.js 18+
- PostgreSQL 13+
- pnpm (recomendado)

## 🛠️ Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd mery-portal
```

2. **Instalar dependencias**
```bash
pnpm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
```

Editar el archivo `.env` con tus configuraciones:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/mery_portal?schema=public"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="24h"

# Application
PORT=3000
NODE_ENV="development"

# Swagger
SWAGGER_ENABLED=true
SWAGGER_PASSWORD="admin123"

# CORS
CORS_ORIGIN="http://localhost:3000"
```

4. **Configurar la base de datos**
```bash
# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev

# (Opcional) Seed de datos iniciales
npx prisma db seed
```

5. **Ejecutar la aplicación**
```bash
# Desarrollo
pnpm run start:dev

# Producción
pnpm run build
pnpm run start:prod
```

## 📚 Documentación API

Una vez que la aplicación esté ejecutándose, puedes acceder a la documentación Swagger en:

- **Desarrollo**: http://localhost:3000/api/docs
- **Producción**: http://localhost:3000/api/docs (requiere autenticación básica)

## 🏗️ Arquitectura

```
src/
├── common/                 # Elementos comunes
│   ├── exceptions/        # Excepciones personalizadas
│   └── filters/          # Filtros globales
├── modules/              # Módulos de la aplicación
│   ├── auth/            # Autenticación y autorización
│   ├── users/           # Gestión de usuarios
│   └── audit/           # Sistema de auditoría
├── shared/              # Elementos compartidos
│   ├── decorators/      # Decoradores personalizados
│   ├── guards/          # Guards de autenticación
│   ├── interceptors/    # Interceptores
│   ├── types/           # Tipos TypeScript
│   ├── utils/           # Utilidades
│   └── services/        # Servicios compartidos
└── main.ts              # Punto de entrada
```

## 🔐 Autenticación

### Roles disponibles:
- **ADMIN**: Acceso completo al sistema
- **SUBADMIN**: Acceso limitado a gestión de usuarios
- **USER**: Acceso básico (solo puede registrarse este rol)

### Endpoints de autenticación:
- `POST /api/auth/register` - Registro (solo rol USER, envía email de verificación)
- `POST /api/auth/verify-email` - Verificar correo electrónico
- `POST /api/auth/resend-verification` - Reenviar email de verificación
- `POST /api/auth/login` - Inicio de sesión (requiere email verificado)
- `POST /api/auth/forgot-password` - Solicitar restablecimiento de contraseña
- `POST /api/auth/reset-password` - Restablecer contraseña

📧 **Ver documentación completa:** [docs/EMAIL-VERIFICATION.md](docs/EMAIL-VERIFICATION.md)

## 📊 Paginación

Todos los endpoints de listado soportan paginación con el siguiente formato:

```typescript
interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
```

### Parámetros de consulta:
- `page`: Número de página (default: 1)
- `limit`: Elementos por página (default: 10, max: 100)
- `search`: Búsqueda por texto
- `sortBy`: Campo de ordenamiento (default: createdAt)
- `sortOrder`: Orden (asc/desc, default: desc)

## 🔍 Auditoría

El sistema registra automáticamente todos los cambios CRUD usando el decorador `@Auditory`:

```typescript
@Auditory({ action: 'CREATE', entity: 'User' })
async create(@Body() createUserDto: CreateUserDto) {
  // ...
}
```

## 🛡️ Seguridad

- **JWT** para autenticación
- **Roles** para autorización
- **Validación** de entrada con class-validator
- **CORS** configurado
- **Swagger protegido** en producción
- **Soft deletes** para preservar datos

## 🧪 Testing

```bash
# Tests unitarios
pnpm run test

# Tests e2e
pnpm run test:e2e

# Coverage
pnpm run test:cov
```

## 📝 Scripts disponibles

```bash
pnpm run start          # Iniciar aplicación
pnpm run start:dev      # Iniciar en modo desarrollo
pnpm run start:debug    # Iniciar en modo debug
pnpm run start:prod     # Iniciar en modo producción
pnpm run build          # Compilar aplicación
pnpm run test           # Ejecutar tests
pnpm run test:e2e       # Ejecutar tests e2e
pnpm run test:cov       # Ejecutar tests con coverage
pnpm run lint           # Ejecutar linter
pnpm run format         # Formatear código
```

## 🌍 Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DATABASE_URL` | URL de conexión a PostgreSQL | - |
| `JWT_SECRET` | Clave secreta para JWT | - |
| `JWT_EXPIRES_IN` | Tiempo de expiración del JWT | 24h |
| `PORT` | Puerto de la aplicación | 3000 |
| `NODE_ENV` | Entorno de ejecución | development |
| `SWAGGER_ENABLED` | Habilitar Swagger | true |
| `SWAGGER_PASSWORD` | Contraseña para Swagger en producción | admin123 |
| `CORS_ORIGIN` | Origen permitido para CORS | http://localhost:3000 |
| `BREVO_API_KEY` | API Key de Brevo para envío de emails | - |
| `EMAIL_FROM` | Email remitente | noreply@merygarcia.com |
| `FRONTEND_URL` | URL del frontend para links en emails | http://localhost:3000 |

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.