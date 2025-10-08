# 🛒 Implementación del Sistema de Carrito de Compras

## 📋 Resumen

Se ha implementado un sistema completo de carrito de compras que permite a los usuarios:
- ✅ Agregar múltiples cursos/categorías al carrito
- ✅ Ver el carrito con totales en ARS y USD
- ✅ Eliminar items individuales del carrito
- ✅ Vaciar el carrito completo
- ✅ Obtener resumen para checkout
- ✅ Protección contra cambios de precio (snapshot)
- ✅ Validación automática de cursos ya comprados

---

## 🗄️ Cambios en la Base de Datos

### Nuevas Tablas

#### Cart
- `id`: ID único del carrito
- `userId`: ID del usuario (relación 1:1)
- `createdAt`: Fecha de creación
- `updatedAt`: Última actualización

#### CartItem
- `id`: ID único del item
- `cartId`: ID del carrito
- `categoryId`: ID de la categoría/curso
- `priceARS`: Precio en ARS (snapshot)
- `priceUSD`: Precio en USD (snapshot)
- `addedAt`: Fecha de agregado

**⚠️ Constraint único**: Un usuario no puede tener el mismo curso duplicado en el carrito.

### Migración Aplicada

```bash
✅ prisma/migrations/20251008194148_add_cart_system/migration.sql
```

---

## 📦 Archivos Creados

### 1. Módulo Cart
```
src/modules/cart/
├── cart.module.ts         - Módulo de NestJS
├── cart.service.ts        - Lógica de negocio
├── cart.controller.ts     - Endpoints REST
├── index.ts               - Barrel export
└── dto/
    ├── add-to-cart.dto.ts      - DTO para agregar al carrito
    ├── cart-response.dto.ts    - DTO de respuesta
    └── index.ts                - Barrel export
```

### 2. Documentación
```
docs/
├── VIMEO-UPLOAD.md          - Guía completa de carga de videos (1GB)
└── HTTPONLY-COOKIES.md      - Autenticación con cookies (ya existente)

API_DOCUMENTATION.md         - Actualizado con endpoints de carrito
```

---

## 🔌 Endpoints del Carrito

### GET /cart
Obtiene el carrito del usuario actual (crea uno si no existe)

**Respuesta**:
```json
{
  "id": "cart_123",
  "userId": "user_456",
  "items": [...],
  "itemCount": 2,
  "totalARS": 169999.98,
  "totalUSD": 169.98
}
```

### POST /cart/add
Agrega un curso al carrito

**Body**:
```json
{
  "categoryId": "cat_123"
}
```

**Validaciones**:
- ✅ Verifica que la categoría exista y esté activa
- ✅ Verifica que el usuario no haya comprado el curso
- ✅ Verifica que el curso no esté ya en el carrito

### DELETE /cart/items/:itemId
Elimina un item específico del carrito

### DELETE /cart
Vacía el carrito completo

### GET /cart/summary
Obtiene un resumen simplificado para checkout

---

## 🔒 Características de Seguridad

### 1. Snapshot de Precios
Cuando un curso se agrega al carrito, se guarda el precio actual:
```typescript
priceARS: category.priceARS,  // Precio al momento de agregar
priceUSD: category.priceUSD,  // Precio al momento de agregar
```

**Beneficio**: Si el admin cambia el precio del curso, los usuarios que ya lo tienen en el carrito no son afectados.

### 2. Validación de Compras Previas
El sistema verifica si el usuario ya compró el curso:
```typescript
const existingPurchase = await this.prisma.categoryPurchase.findUnique({
  where: { userId_categoryId: { userId, categoryId } },
});

if (existingPurchase) {
  throw new ConflictException('Ya compraste este curso');
}
```

### 3. Validación de Duplicados
No se puede agregar el mismo curso dos veces al carrito:
```typescript
@@unique([cartId, categoryId])
```

---

## 💻 Ejemplo de Uso en Frontend

### React/Next.js

```typescript
import { useState, useEffect } from 'react';
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  withCredentials: true, // Para cookies HttpOnly
});

// Hook personalizado para el carrito
function useCart() {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCart = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/cart');
      setCart(data.data);
    } catch (error) {
      console.error('Error fetching cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (categoryId: string) => {
    try {
      const { data } = await api.post('/cart/add', { categoryId });
      setCart(data.data);
      return true;
    } catch (error) {
      if (error.response?.status === 409) {
        alert('Este curso ya está en tu carrito o ya lo compraste');
      }
      return false;
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      const { data } = await api.delete(`/cart/items/${itemId}`);
      setCart(data.data);
    } catch (error) {
      console.error('Error removing from cart:', error);
    }
  };

  const clearCart = async () => {
    try {
      await api.delete('/cart');
      setCart({ ...cart, items: [], itemCount: 0, totalARS: 0, totalUSD: 0 });
    } catch (error) {
      console.error('Error clearing cart:', error);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  return { cart, loading, addToCart, removeFromCart, clearCart, fetchCart };
}

// Componente de ejemplo
function CartPage() {
  const { cart, loading, removeFromCart, clearCart } = useCart();

  if (loading) return <div>Cargando...</div>;
  if (!cart || cart.itemCount === 0) return <div>Tu carrito está vacío</div>;

  return (
    <div>
      <h1>Mi Carrito ({cart.itemCount} cursos)</h1>
      
      {cart.items.map(item => (
        <div key={item.id}>
          <h3>{item.category.name}</h3>
          <p>ARS ${item.priceARS} / USD ${item.priceUSD}</p>
          <button onClick={() => removeFromCart(item.id)}>Eliminar</button>
        </div>
      ))}

      <div>
        <h2>Total</h2>
        <p>ARS: ${cart.totalARS}</p>
        <p>USD: ${cart.totalUSD}</p>
      </div>

      <button onClick={clearCart}>Vaciar Carrito</button>
      <button onClick={handleCheckout}>Proceder al Pago</button>
    </div>
  );
}

// Botón para agregar al carrito
function AddToCartButton({ categoryId, categoryName }) {
  const { addToCart } = useCart();
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    setAdding(true);
    const success = await addToCart(categoryId);
    if (success) {
      alert(`${categoryName} agregado al carrito!`);
    }
    setAdding(false);
  };

  return (
    <button onClick={handleAdd} disabled={adding}>
      {adding ? 'Agregando...' : 'Agregar al Carrito'}
    </button>
  );
}
```

---

## 🔄 Flujo Completo de Compra

### 1. Navegación y Selección
```typescript
// Usuario navega los cursos disponibles
const { courses } = await api.get('/categories');

// Agrega cursos al carrito
for (const course of selectedCourses) {
  await api.post('/cart/add', { categoryId: course.id });
}
```

### 2. Revisión del Carrito
```typescript
// Usuario ve su carrito
const { data: cart } = await api.get('/cart');
console.log(`${cart.itemCount} cursos - Total: ARS ${cart.totalARS}`);
```

### 3. Checkout
```typescript
// Obtener resumen para checkout
const { data: summary } = await api.get('/cart/summary');

// Procesar pago con gateway (Mercado Pago, PayPal, etc.)
const payment = await processPayment({
  amount: summary.totalARS, // o totalUSD según moneda
  currency: 'ARS',
  description: `${summary.itemCount} cursos`,
});
```

### 4. Confirmar Compra
```typescript
// Después del pago exitoso, crear las compras
for (const item of summary.items) {
  await api.post('/category-purchases', {
    categoryId: item.categoryId,
    amount: item.priceARS,
    currency: 'ARS',
    transactionId: payment.id,
    paymentStatus: 'completed',
  });
}

// Vaciar el carrito
await api.delete('/cart');
```

### 5. Acceso al Contenido
```typescript
// Ahora el usuario tiene acceso
const { data: course } = await api.get(`/categories/${courseId}`);
console.log(course.hasAccess); // true
console.log(course.isPurchased); // true

// Puede ver los videos
const { data: videos } = await api.get(`/videos?categoryId=${courseId}`);
```

---

## 🎥 Carga de Videos a Vimeo

### Respuesta a tu Pregunta

**¿Es posible cargar videos de 1GB mediante request API?**
✅ **SÍ**, Vimeo tiene soporte completo para esto.

**¿Es recomendable?**
✅ **SÍ**, especialmente usando el protocolo **tus** (carga resumible).

**¿Hay mejores alternativas?**
❌ **NO** para tu caso de uso. Vimeo es perfecto para:
- Videos de 1GB en HD
- Streaming adaptativo automático
- CDN global
- Seguridad y privacidad
- No necesitas infraestructura de video

### Método Recomendado

**tus Upload Protocol**:
- ✅ Soporta archivos hasta 5GB
- ✅ Carga resumible (si se cae, continúa)
- ✅ División automática en chunks
- ✅ Progreso en tiempo real
- ✅ Manejo de errores robusto

### Documentación Completa

📄 **`docs/VIMEO-UPLOAD.md`** contiene:
- Código completo de implementación
- Ejemplo con tus upload
- Progreso en tiempo real
- Manejo de errores
- Comparación de métodos
- Costos de planes de Vimeo
- Mejores prácticas

### Instalación

```bash
pnpm add @vimeo/vimeo tus-js-client @nestjs/platform-express
pnpm add -D @types/multer
```

### Ejemplo Rápido

```typescript
// Subir video de 1GB con progreso
const vimeoId = await vimeoService.uploadLargeVideo(
  '/path/to/video.mp4',
  'Título del Video',
  'Descripción',
  (bytesUploaded, bytesTotal) => {
    const progress = (bytesUploaded / bytesTotal) * 100;
    console.log(`Progreso: ${progress.toFixed(2)}%`);
  }
);

// Crear video en tu DB
await videosService.create({
  title: 'Título del Video',
  slug: 'titulo-del-video',
  vimeoId,
  categoryId: 'cat_123',
});
```

---

## ✅ Testing

### Probar el Carrito

```bash
# 1. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' \
  -c cookies.txt

# 2. Obtener carrito
curl http://localhost:3000/api/cart \
  -b cookies.txt

# 3. Agregar curso al carrito
curl -X POST http://localhost:3000/api/cart/add \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"categoryId":"cat_123"}'

# 4. Ver resumen
curl http://localhost:3000/api/cart/summary \
  -b cookies.txt

# 5. Vaciar carrito
curl -X DELETE http://localhost:3000/api/cart \
  -b cookies.txt
```

---

## 📊 Beneficios del Sistema

### Para Usuarios
- ✅ Pueden comparar múltiples cursos antes de comprar
- ✅ Compra única de múltiples cursos (mejor UX)
- ✅ Los precios no cambian mientras deciden
- ✅ Pueden guardar su selección para después

### Para el Negocio
- ✅ Aumenta el ticket promedio (compras múltiples)
- ✅ Reduce fricción en el proceso de compra
- ✅ Protección contra cambios de precio
- ✅ Datos de intención de compra (analytics)

### Para Desarrollo
- ✅ Código limpio y modular
- ✅ Validaciones robustas
- ✅ Fácil de extender (descuentos, cupones, etc.)
- ✅ Compatible con cualquier gateway de pago

---

## 🚀 Próximos Pasos Sugeridos

### 1. Sistema de Cupones/Descuentos
```typescript
// Futuro
{
  "couponCode": "PROMO50",
  "discount": 50, // 50%
  "discountedTotalARS": 84999.99
}
```

### 2. Guardar Carritos Abandonados
```typescript
// Analytics de carritos no completados
// Email marketing automático
```

### 3. Recomendaciones
```typescript
// "Los que compraron esto también compraron..."
// "Curso recomendado para ti"
```

### 4. Límite de Tiempo
```typescript
// Items en el carrito expiran después de X días
expiresAt: Date
```

---

## 📚 Referencias

- **API Documentation**: `/API_DOCUMENTATION.md`
- **Cookies HttpOnly**: `/docs/HTTPONLY-COOKIES.md`
- **Vimeo Upload**: `/docs/VIMEO-UPLOAD.md`
- **Swagger UI**: `http://localhost:3000/api/docs`

---

**¡Sistema de Carrito Completamente Implementado!** 🎉

