# Sistema de Precios con Doble Moneda (ARS/USD)

## 📋 Descripción

Cada categoría/curso puede tener **dos precios fijos simultáneos**:
- **priceARS**: Precio en pesos argentinos
- **priceUSD**: Precio en dólares estadounidenses

Esto permite que los usuarios elijan en qué moneda pagar, sin depender de tasas de cambio dinámicas o conversiones automáticas.

---

## 💾 Modelo de Base de Datos

### VideoCategory

```prisma
model VideoCategory {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  description String?
  image       String?
  order       Int      @default(0)
  isActive    Boolean  @default(true)
  
  // 💰 Precios en ambas monedas
  priceARS    Decimal  @db.Decimal(10, 2)  // Precio en pesos argentinos
  priceUSD    Decimal  @db.Decimal(10, 2)  // Precio en dólares
  isFree      Boolean  @default(false)
  
  videos      Video[]
  purchases   CategoryPurchase[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?
  
  @@map("video_categories")
}
```

---

## 📝 Endpoints de API

### Crear Categoría/Curso

**POST** `/api/categories`

**Request Body**:
```json
{
  "name": "Curso de Microblading Avanzado",
  "slug": "curso-microblading-avanzado",
  "description": "Aprende técnicas avanzadas de microblading",
  "image": "https://example.com/image.jpg",
  "order": 0,
  "isActive": true,
  "priceARS": 89999.99,    // ✅ Precio en pesos argentinos (REQUERIDO)
  "priceUSD": 89.99,       // ✅ Precio en dólares (REQUERIDO)
  "isFree": false
}
```

**Response** (201):
```json
{
  "success": true,
  "data": {
    "id": "clx123...",
    "name": "Curso de Microblading Avanzado",
    "slug": "curso-microblading-avanzado",
    "description": "Aprende técnicas avanzadas de microblading",
    "image": "https://example.com/image.jpg",
    "order": 0,
    "isActive": true,
    "priceARS": 89999.99,    // Número (no Decimal)
    "priceUSD": 89.99,       // Número (no Decimal)
    "isFree": false,
    "videoCount": 0,
    "createdAt": "2025-10-07T...",
    "updatedAt": "2025-10-07T..."
  }
}
```

---

### Listar Categorías

**GET** `/api/categories`

**Response** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "clx123...",
      "name": "Curso de Microblading Avanzado",
      "slug": "curso-microblading-avanzado",
      "priceARS": 89999.99,    // ✅ Siempre presente
      "priceUSD": 89.99,       // ✅ Siempre presente
      "isFree": false,
      "hasAccess": false,      // Solo si está autenticado
      "isPurchased": false,    // Solo si está autenticado
      "videoCount": 12,
      "createdAt": "2025-10-07T...",
      "updatedAt": "2025-10-07T..."
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

---

### Actualizar Categoría

**PATCH** `/api/categories/:id`

**Request Body** (todos los campos son opcionales):
```json
{
  "name": "Curso de Microblading Avanzado - Actualizado",
  "priceARS": 99999.99,    // Actualizar precio en pesos
  "priceUSD": 99.99        // Actualizar precio en dólares
}
```

---

## 🛒 Flujo de Compra

### Paso 1: Usuario Visualiza Cursos

```javascript
// Frontend muestra ambos precios
fetch('/api/categories')
  .then(res => res.json())
  .then(data => {
    data.data.forEach(course => {
      console.log(`Curso: ${course.name}`);
      console.log(`Precio ARS: $${course.priceARS}`);
      console.log(`Precio USD: $${course.priceUSD}`);
    });
  });
```

### Paso 2: Usuario Selecciona Moneda

El frontend permite al usuario elegir en qué moneda desea pagar:

```javascript
// Ejemplo UI
<div class="pricing">
  <button onClick={() => handlePurchase(course.id, 'ARS', course.priceARS)}>
    Comprar por ${course.priceARS} ARS
  </button>
  <button onClick={() => handlePurchase(course.id, 'USD', course.priceUSD)}>
    Comprar por ${course.priceUSD} USD
  </button>
</div>
```

### Paso 3: Procesar Compra

Al procesar el pago, se guarda qué moneda usó el usuario:

```typescript
// En el backend (cuando implementes el endpoint de compra)
await prisma.categoryPurchase.create({
  data: {
    userId: user.id,
    categoryId: category.id,
    amount: currency === 'ARS' ? category.priceARS : category.priceUSD,
    currency: currency, // 'ARS' o 'USD'
    paymentMethod: 'mercadopago', // o lo que uses
    paymentStatus: 'completed',
  },
});
```

---

## 💡 Ventajas del Sistema de Doble Moneda

### ✅ **Precios Fijos**
- No dependes de APIs de conversión de moneda
- No hay sorpresas con fluctuaciones de tipo de cambio
- Puedes ajustar precios según cada mercado

### ✅ **Control Total**
```javascript
// Puedes tener estrategias de pricing diferentes:
{
  priceARS: 99999,  // ~$100 USD al tipo de cambio oficial
  priceUSD: 89.99   // Precio competitivo para mercado internacional
}
```

### ✅ **Mejor UX**
- Los usuarios ven precios en su moneda local
- Evitas confusión con conversiones
- Mayor transparencia en el precio final

---

## 🔧 Implementación en el Frontend

### React/Next.js Example

```typescript
interface Category {
  id: string;
  name: string;
  slug: string;
  priceARS: number;
  priceUSD: number;
  isFree: boolean;
  hasAccess?: boolean;
}

function CourseCard({ course }: { course: Category }) {
  const [selectedCurrency, setSelectedCurrency] = useState<'ARS' | 'USD'>('ARS');
  
  const price = selectedCurrency === 'ARS' ? course.priceARS : course.priceUSD;
  
  if (course.isFree) {
    return (
      <div>
        <h3>{course.name}</h3>
        <p>¡Curso GRATUITO!</p>
        <button>Acceder al Curso</button>
      </div>
    );
  }
  
  if (course.hasAccess) {
    return (
      <div>
        <h3>{course.name}</h3>
        <p>Ya tienes acceso a este curso</p>
        <button>Ir al Curso</button>
      </div>
    );
  }
  
  return (
    <div>
      <h3>{course.name}</h3>
      
      {/* Currency Selector */}
      <div>
        <button 
          onClick={() => setSelectedCurrency('ARS')}
          className={selectedCurrency === 'ARS' ? 'active' : ''}
        >
          ARS
        </button>
        <button 
          onClick={() => setSelectedCurrency('USD')}
          className={selectedCurrency === 'USD' ? 'active' : ''}
        >
          USD
        </button>
      </div>
      
      {/* Price Display */}
      <div className="price">
        {selectedCurrency === 'ARS' ? '$' : 'USD '}
        {price.toLocaleString()}
      </div>
      
      {/* Purchase Button */}
      <button onClick={() => handlePurchase(course.id, selectedCurrency, price)}>
        Comprar por {selectedCurrency} {price}
      </button>
    </div>
  );
}
```

---

## 📊 Ejemplos de Pricing Estratégico

### Curso Básico
```json
{
  "name": "Curso Básico de Cejas",
  "priceARS": 29999.99,  // ~$30 USD
  "priceUSD": 29.99
}
```

### Curso Intermedio
```json
{
  "name": "Curso Intermedio de Microblading",
  "priceARS": 59999.99,  // ~$60 USD
  "priceUSD": 49.99      // Precio promocional internacional
}
```

### Curso Avanzado
```json
{
  "name": "Curso Avanzado Completo",
  "priceARS": 149999.99, // ~$150 USD
  "priceUSD": 129.99     // Precio competitivo
}
```

### Curso Gratuito
```json
{
  "name": "Introducción Gratuita",
  "priceARS": 0,
  "priceUSD": 0,
  "isFree": true
}
```

---

## 🔄 Migración de Datos Existentes

Si ya tienes datos con el modelo anterior (`price` y `currency`), aquí está cómo migrar:

```sql
-- Si tenías un solo campo price con currency
-- Migrar datos existentes (ejemplo)

UPDATE video_categories
SET 
  priceARS = CASE 
    WHEN currency = 'ARS' THEN price
    ELSE price * 1000  -- Conversión estimada (ajustar según tu caso)
  END,
  priceUSD = CASE 
    WHEN currency = 'USD' THEN price
    ELSE price / 1000  -- Conversión estimada (ajustar según tu caso)
  END;

-- Eliminar columna vieja
ALTER TABLE video_categories DROP COLUMN currency;
```

---

## ⚠️ Consideraciones Importantes

### 1. **Ambos Precios son Obligatorios**
- Siempre debes proporcionar `priceARS` y `priceUSD`
- Incluso si un curso es gratuito, los campos existen (pero pueden ser 0)

### 2. **Validación de Precios**
```typescript
// En tu frontend, valida:
if (priceARS < 0 || priceUSD < 0) {
  throw new Error('Los precios no pueden ser negativos');
}

if (priceARS === 0 && priceUSD === 0 && !isFree) {
  throw new Error('Si los precios son 0, el curso debe ser gratuito');
}
```

### 3. **Cursos Gratuitos**
```typescript
// Para cursos gratuitos:
{
  priceARS: 0,
  priceUSD: 0,
  isFree: true  // ✅ Importante marcar como gratuito
}
```

---

## 🎯 Próximos Pasos

### Para el Backend:
- ✅ Schema actualizado
- ✅ DTOs actualizados
- ✅ Servicios actualizados
- ⏳ Implementar endpoint de compra/pago
- ⏳ Integrar con pasarela de pago (MercadoPago, Stripe, etc.)

### Para el Frontend:
- ⏳ Mostrar ambos precios en las tarjetas de curso
- ⏳ Implementar selector de moneda
- ⏳ Integrar con flujo de checkout
- ⏳ Manejar diferentes pasarelas según moneda
  - ARS → MercadoPago
  - USD → Stripe/PayPal

---

## 📚 Recursos Útiles

### Pasarelas de Pago por Moneda

**Para ARS (Pesos Argentinos)**:
- MercadoPago (recomendado para Argentina)
- TodoPago

**Para USD (Dólares)**:
- Stripe
- PayPal
- Payoneer

---

**Fecha de Implementación**: Octubre 2025  
**Versión**: 2.1

