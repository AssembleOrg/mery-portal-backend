# Refactor: Precios a Nivel de Categoría/Curso

## 📋 Resumen de Cambios

Se movió toda la lógica de precios desde videos individuales a categorías, ya que cada categoría representa un **curso completo** (bundle de videos) que se compra como conjunto.

---

## ✅ Cambios Realizados

### 1. **Schema de Prisma** (`prisma/schema.prisma`)

#### VideoCategory (antes):
```prisma
model VideoCategory {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  // ... otros campos
  videos      Video[]
}
```

#### VideoCategory (después):
```prisma
model VideoCategory {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  // ... otros campos
  
  // 🆕 Pricing a nivel de curso
  price       Decimal  @db.Decimal(10, 2)
  currency    String   @default("USD")
  isFree      Boolean  @default(false)
  
  videos      Video[]
  purchases   CategoryPurchase[]  // 🆕
}
```

#### Video (antes):
```prisma
model Video {
  // ... campos
  price           Decimal       @db.Decimal(10, 2)
  currency        String        @default("USD")
  isFree          Boolean       @default(false)
  purchases       VideoPurchase[]
}
```

#### Video (después):
```prisma
model Video {
  // ... campos
  // ❌ Eliminados: price, currency, isFree, purchases
  
  // Solo mantiene relación con categoría
  categoryId      String
  category        VideoCategory @relation(...)
}
```

#### VideoPurchase → CategoryPurchase:
```prisma
// ANTES: VideoPurchase (compras por video individual)
model VideoPurchase {
  userId          String
  videoId         String
  video           Video @relation(...)
  // ...
  @@unique([userId, videoId])
}

// DESPUÉS: CategoryPurchase (compras por curso/categoría)
model CategoryPurchase {
  userId          String
  categoryId      String
  category        VideoCategory @relation(...)
  // ...
  @@unique([userId, categoryId])
}
```

---

### 2. **DTOs Actualizados**

#### CreateCategoryDto
```typescript
export class CreateCategoryDto {
  name: string;
  slug: string;
  description?: string;
  image?: string;
  order?: number = 0;
  isActive?: boolean = true;
  
  // 🆕 Campos de precio
  price: number;           // Requerido
  currency?: string = 'USD';
  isFree?: boolean = false;
}
```

#### CategoryResponseDto
```typescript
export class CategoryResponseDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  order: number;
  isActive: boolean;
  
  // 🆕 Campos de precio
  price: number;
  currency: string;
  isFree: boolean;
  
  // 🆕 Info de acceso (si está autenticado)
  videoCount?: number;
  hasAccess?: boolean;      // Si el usuario compró el curso
  isPurchased?: boolean;    // Alias de hasAccess
  
  createdAt: Date;
  updatedAt: Date;
}
```

#### CreateVideoDto
```typescript
export class CreateVideoDto {
  title: string;
  slug: string;
  description?: string;
  vimeoId: string;
  
  // ❌ Eliminados: price, currency, isFree
  
  categoryId: string;  // 🎯 El video pertenece a un curso
  order?: number = 0;
  metaTitle?: string;
  metaDescription?: string;
}
```

#### VideoResponseDto
```typescript
export class VideoResponseDto {
  id: string;
  title: string;
  slug: string;
  description?: string;
  thumbnail?: string;
  duration?: number;
  
  // ❌ Eliminados: price, currency, isFree, hasAccess, isPurchased
  
  categoryId: string;
  category?: CategoryNestedDto;  // Info del curso al que pertenece
  isPublished: boolean;
  publishedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 3. **Servicios Actualizados**

#### CategoriesService
```typescript
// 🆕 Nuevo método
private async checkUserAccess(userId: string, categoryId: string): Promise<boolean> {
  // Verifica si el curso es gratuito
  const category = await this.prisma.videoCategory.findUnique({
    where: { id: categoryId },
    select: { isFree: true },
  });

  if (category?.isFree) {
    return true;
  }

  // Verifica si el usuario compró el curso
  const purchase = await this.prisma.categoryPurchase.findUnique({
    where: {
      userId_categoryId: { userId, categoryId },
    },
  });

  return purchase !== null && purchase.isActive && (!purchase.expiresAt || purchase.expiresAt > new Date());
}

// Todos los métodos ahora convierten Decimal a number
// y verifican acceso del usuario si está autenticado
```

#### VideosService
```typescript
// Cambio principal: verifica acceso a CATEGORÍA en lugar de VIDEO
async getStreamingUrl(videoId: string, userId: string) {
  const video = await this.prisma.video.findUnique({...});
  
  // 🔄 ANTES: Verificaba si el video era gratuito o si el usuario lo compró
  // 🆕 AHORA: Verifica si el usuario tiene acceso a la CATEGORÍA del video
  const hasAccess = await this.checkUserAccess(userId, video.categoryId);
  
  if (!hasAccess) {
    throw new ForbiddenException('Debes comprar este curso para acceder al contenido');
  }
  
  // ... resto del código
}

private async checkUserAccess(userId: string, categoryId: string): Promise<boolean> {
  // Verifica acceso a nivel de categoría/curso
}
```

---

## 🎯 Impacto en el Frontend

### Cambios en la API

#### 1. **Categorías ahora incluyen precio**

**GET `/api/categories`** y **GET `/api/categories/:id`**:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "Curso de Cejas",
    "slug": "curso-cejas",
    "price": 99.99,        // 🆕
    "currency": "ARS",      // 🆕
    "isFree": false,        // 🆕
    "hasAccess": true,      // 🆕 Si el usuario compró el curso
    "isPurchased": true,    // 🆕
    "videoCount": 10
  }
}
```

#### 2. **Videos ya NO incluyen precio**

**GET `/api/videos`** y **GET `/api/videos/:id`**:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "title": "Video 1",
    // ❌ YA NO: price, currency, isFree, hasAccess, isPurchased
    "category": {
      "id": "...",
      "name": "Curso de Cejas",
      "slug": "curso-cejas"
    }
  }
}
```

#### 3. **Crear Video ya NO requiere precio**

**POST `/api/videos`**:
```json
{
  "title": "Nuevo Video",
  "slug": "nuevo-video",
  "vimeoId": "123456789",
  "categoryId": "category-id"
  // ❌ YA NO: price, currency, isFree
}
```

#### 4. **Crear Categoría ahora REQUIERE precio**

**POST `/api/categories`**:
```json
{
  "name": "Nuevo Curso",
  "slug": "nuevo-curso",
  "price": 99.99,        // ✅ REQUERIDO
  "currency": "ARS",      // Opcional (default: USD)
  "isFree": false         // Opcional (default: false)
}
```

---

## 🔄 Flujo de Compra Actualizado

### ANTES (Videos Individuales):
```
Usuario → Compra Video Individual → VideoPurchase
                                   → hasAccess a ESE video
```

### AHORA (Cursos/Categorías):
```
Usuario → Compra Curso/Categoría → CategoryPurchase
                                  → hasAccess a TODOS los videos del curso
```

---

## 📚 Acceso a Contenido

### Verificación de Acceso

**ANTES**: Para ver un video, se verificaba:
1. ¿Es el video gratuito? → Acceso permitido
2. ¿El usuario compró este video? → Acceso permitido

**AHORA**: Para ver un video, se verifica:
1. ¿Es el CURSO gratuito? → Acceso permitido a todos los videos del curso
2. ¿El usuario compró el CURSO? → Acceso permitido a todos los videos del curso

### Endpoint de Streaming

**GET `/api/videos/:id/stream`** ahora verifica:
- ✅ Acceso a la categoría/curso (no al video individual)
- Si el usuario tiene acceso al curso, puede ver TODOS los videos del curso

---

## 🗄️ Migración de Base de Datos

### Pasos para Aplicar los Cambios

#### Opción 1: Reset de Base de Datos (Desarrollo - Pierde Datos)

```bash
# Reset completo de la BD
npx prisma migrate reset

# Esto hará:
# 1. Eliminar todas las tablas
# 2. Recrear el schema desde cero
# 3. Ejecutar seeds si existen
```

#### Opción 2: Migración Manual (Producción - Preserva Datos)

Si tienes datos existentes que quieres preservar, necesitas una migración personalizada:

1. **Crear tabla nueva**:
```sql
CREATE TABLE "category_purchases" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT DEFAULT 'USD',
  -- ... otros campos
  CONSTRAINT "category_purchases_userId_categoryId_key" UNIQUE ("userId", "categoryId")
);
```

2. **Agregar campos a categorías**:
```sql
ALTER TABLE "video_categories"
ADD COLUMN "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN "isFree" BOOLEAN NOT NULL DEFAULT false;
```

3. **Migrar datos** (si necesario):
```sql
-- Ejemplo: Si quieres migrar compras de videos a categorías
INSERT INTO "category_purchases" (id, "userId", "categoryId", amount, currency, ...)
SELECT 
  gen_random_uuid(),
  vp."userId",
  v."categoryId",
  vp.amount,
  vp.currency,
  ...
FROM "video_purchases" vp
JOIN "videos" v ON vp."videoId" = v.id
GROUP BY vp."userId", v."categoryId";
```

4. **Eliminar campos viejos**:
```sql
ALTER TABLE "videos"
DROP COLUMN "price",
DROP COLUMN "currency",
DROP COLUMN "isFree";

DROP TABLE "video_purchases";
```

---

## 📝 Actualización del Seed

Si tienes un archivo de seed (`prisma/seed.ts`), actualízalo:

```typescript
// ANTES
await prisma.video.create({
  data: {
    title: "Video 1",
    price: 29.99,
    currency: "USD",
    isFree: false,
    // ...
  },
});

// AHORA
await prisma.videoCategory.create({
  data: {
    name: "Curso de Cejas",
    slug: "curso-cejas",
    price: 99.99,
    currency: "ARS",
    isFree: false,
    videos: {
      create: [
        {
          title: "Video 1",
          slug: "video-1",
          vimeoId: "123456",
          // NO incluir price, currency, isFree
        },
        {
          title: "Video 2",
          slug: "video-2",
          vimeoId: "123457",
        },
      ],
    },
  },
});
```

---

## ✅ Verificación

### Checklist de Cambios Completados

- ✅ Schema de Prisma actualizado
- ✅ DTOs actualizados (Category y Video)
- ✅ CategoriesService actualizado con conversión Decimal y verificación de acceso
- ✅ VideosService actualizado para verificar acceso a categorías
- ✅ Controladores actualizados para pasar userId
- ✅ Cliente de Prisma regenerado

### Checklist Pendiente para el Usuario

- ⏳ Aplicar migración de base de datos (`npx prisma migrate reset` o migración manual)
- ⏳ Actualizar seed si existe
- ⏳ Actualizar frontend para:
  - Mostrar precios en categorías en lugar de videos
  - Comprar categorías en lugar de videos individuales
  - Verificar acceso a cursos en lugar de videos individuales
- ⏳ Actualizar documentación API (`API_DOCUMENTATION.md`)

---

## 🎓 Modelo de Negocio Final

```
Curso/Categoría ($99.99)
 ├── Video 1 (Incluido)
 ├── Video 2 (Incluido)
 ├── Video 3 (Incluido)
 └── Video N (Incluido)

Usuario compra → CURSO COMPLETO
Usuario tiene acceso → TODOS LOS VIDEOS del curso
```

**Ventajas**:
- ✅ Modelo más simple y claro
- ✅ Venta de paquetes completos
- ✅ Mejor experiencia de usuario
- ✅ Facilita gestión de accesos
- ✅ Alineado con el modelo de cursos online

---

**Fecha de Refactor**: Octubre 2025  
**Versión**: 2.0

