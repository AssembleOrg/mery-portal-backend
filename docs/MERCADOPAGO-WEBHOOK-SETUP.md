# Configuración de Webhooks de Mercado Pago

## 🔐 Variables de Entorno Requeridas

Agrega estas variables a tu archivo `.env`:

```env
# Mercado Pago
MP_ACCESS_TOKEN=TEST-1234567890-123456-abcdef1234567890-1234567890  # Access token de tu cuenta
MP_WEBHOOK_SECRET=your-webhook-secret-from-dashboard              # Secret para validar firma
MP_PUBLIC_KEY=TEST-12345678-1234-1234-1234-123456789012          # Public key (para frontend)
```

### ¿Dónde Obtener las Credenciales?

1. **Ingresa a tu Panel de Mercado Pago**
   - Producción: https://www.mercadopago.com.ar/developers/panel
   - Sandbox (pruebas): https://www.mercadopago.com.ar/developers/panel/credentials/test

2. **Navega a "Credenciales"**
   - Production → Para producción (ventas reales)
   - Test → Para desarrollo y pruebas

3. **Copia las credenciales:**
   - `Access Token` → MP_ACCESS_TOKEN
   - `Public Key` → MP_PUBLIC_KEY

---

## 📡 Configurar el Webhook en Mercado Pago

### 1. Accede a la sección de Webhooks

URL: https://www.mercadopago.com.ar/developers/panel/webhooks

### 2. Crea un nuevo webhook

Haz clic en **"Crear webhook"** o **"Nuevo webhook"**

### 3. Configura los parámetros:

#### **URL del Webhook**
```
https://tu-dominio.com/api/webhooks/mercadopago
```

**Ejemplos:**
- Producción: `https://api.mery.com/api/webhooks/mercadopago`
- Staging: `https://staging-api.mery.com/api/webhooks/mercadopago`
- Testing local (con ngrok): `https://abc123.ngrok.io/api/webhooks/mercadopago`

#### **Topics (Eventos a Escuchar)**

Selecciona los siguientes topics:

✅ **payments** (Obligatorio)
- `payment.created` - Nuevo pago creado
- `payment.updated` - Pago actualizado (aprobado, rechazado, etc.)

✅ **merchant_orders** (Recomendado)
- `merchant_order` - Estado de orden actualizado

✅ **chargebacks** (Recomendado)
- `chargebacks` - Contracargo iniciado

⚠️ **refunds** (Opcional)
- `refunds` - Reembolso procesado

#### **Versión de API**
- Selecciona: `v1` (la más reciente)

#### **Mode**
- **Production** → Para producción
- **Sandbox** → Para pruebas

### 4. Guarda el Webhook Secret

Una vez creado el webhook, Mercado Pago te mostrará un **"Secret"**.

⚠️ **IMPORTANTE**: Copia este secret y agrégalo a tu `.env`:
```env
MP_WEBHOOK_SECRET=tu-secret-aquí
```

Este secret se usa para validar que las notificaciones provienen realmente de Mercado Pago.

---

## 🧪 Testing Local con ngrok

### 1. Instala ngrok
```bash
# Opción 1: Descargar desde https://ngrok.com/download
# Opción 2: Con npm
npm install -g ngrok

# Opción 3: Con brew (macOS)
brew install ngrok
```

### 2. Inicia tu servidor local
```bash
pnpm run start:dev
```

### 3. Crea un túnel público
```bash
ngrok http 3000
```

Verás algo como:
```
Forwarding: https://abc123.ngrok.io -> http://localhost:3000
```

### 4. Configura el webhook en Mercado Pago
```
https://abc123.ngrok.io/api/webhooks/mercadopago
```

### 5. Realiza una prueba de pago

Usa las **tarjetas de prueba** de Mercado Pago:
- **Tarjeta aprobada**: `5031 4332 1540 6351`
- **CVV**: 123
- **Vencimiento**: 11/25
- **Nombre**: APRO

Más tarjetas: https://www.mercadopago.com.ar/developers/es/docs/checkout-api/additional-content/test-cards

---

## 🔍 Verificar que Funciona

### 1. Revisa los logs de tu servidor

Deberías ver:
```
[MercadoPagoController] 🔔 Webhook de Mercado Pago recibido
[MercadoPagoService] 📥 Consultando pago 12345678 en Mercado Pago
[MercadoPagoService] ✅ Pago 12345678 obtenido: approved
[MercadoPagoService] 💳 Procesando pago: ...
[MercadoPagoService] 🎯 Otorgando acceso al usuario ...
[MercadoPagoService] ✅ Acceso otorgado: usuario xxx → categoría yyy
[MercadoPagoService] 🎉 Pago 12345678 procesado exitosamente
```

### 2. Verifica en la base de datos

```sql
-- Ver las compras procesadas
SELECT * FROM category_purchases 
WHERE transaction_id = '12345678' 
ORDER BY created_at DESC;
```

### 3. Panel de Webhooks de Mercado Pago

En el panel de Mercado Pago puedes ver:
- ✅ Notificaciones enviadas exitosamente (200 OK)
- ❌ Notificaciones fallidas
- 📊 Estadísticas de entrega

---

## 🔒 Seguridad Implementada

### 1. Validación de Firma HMAC-SHA256
```typescript
// El backend valida que la notificación viene de Mercado Pago
const signature = req.headers['x-signature'];
const isValid = validateSignature(rawBody, signature, MP_WEBHOOK_SECRET);
```

### 2. Verificación Doble
```typescript
// Después de recibir la notificación, consultamos la API de MP
const payment = await mercadopago.getPaymentDetails(paymentId);
// Solo confiamos en los datos que vienen de la API oficial
```

### 3. Idempotencia
```typescript
// Evitamos procesar la misma notificación dos veces
if (isNotificationProcessed(notificationId)) {
  return; // Ya procesada, ignorar
}
```

### 4. Raw Body Parser
```typescript
// El webhook recibe el body sin parsear para validar la firma
app.use('/api/webhooks/mercadopago', express.raw({ type: 'application/json' }));
```

### 5. Rate Limiting
El endpoint está protegido por:
- ThrottlerGuard (límite de requests)
- SuspiciousActivityGuard (detección de ataques)

---

## 📦 Metadata Requerida en el Pago

Cuando crees un pago desde el frontend, debes incluir esta metadata:

```javascript
const payment = {
  transaction_amount: 280000,
  description: 'Curso de Microblading',
  payment_method_id: 'visa',
  payer: {
    email: 'usuario@example.com',
  },
  metadata: {
    user_id: 'clx123...', // ID del usuario en tu DB
    category_ids: '["clx456...", "clx789..."]', // IDs de categorías compradas (JSON string)
  },
  external_reference: 'ORDER-123', // Opcional: tu referencia interna
};
```

⚠️ **Importante**: 
- `user_id`: Debe ser el ID del usuario autenticado
- `category_ids`: Array de IDs de categorías (como string JSON)
- Sin esta metadata, el webhook no sabrá a qué usuario otorgar acceso

---

## 🛠️ Troubleshooting

### ❌ "Firma de webhook inválida"

**Causa**: El `MP_WEBHOOK_SECRET` no coincide con el configurado en Mercado Pago

**Solución**:
1. Ve al panel de webhooks en Mercado Pago
2. Copia el "Secret" exactamente como aparece
3. Actualiza tu `.env`
4. Reinicia el servidor

### ❌ "Usuario xxx no encontrado"

**Causa**: El `user_id` en la metadata no existe en tu base de datos

**Solución**:
- Verifica que el `user_id` sea correcto en el frontend
- Verifica que el usuario exista antes de crear el pago

### ❌ Webhook no se recibe

**Causas posibles**:
1. **Firewall bloqueando**: Asegúrate de que tu servidor acepte conexiones de Mercado Pago
2. **URL incorrecta**: Verifica que la URL termine en `/api/webhooks/mercadopago`
3. **HTTPS no configurado**: En producción, Mercado Pago requiere HTTPS
4. **ngrok expirado**: En desarrollo, el túnel de ngrok se vence cada 2 horas

**Solución**:
- Verifica la URL en el panel de webhooks
- Revisa los logs del servidor
- Usa el simulador de webhooks de Mercado Pago para probar

### ❌ Notificación duplicada

**No es problema**: El sistema tiene idempotencia implementada
- La primera notificación se procesa normalmente
- Las siguientes con el mismo ID se ignoran
- Verás en logs: `⏭️ Notificación xxx ya procesada, ignorando`

---

## 📊 Flujo Completo

```
1. Usuario completa compra en frontend
   ↓
2. Frontend envía pago a Mercado Pago (con metadata)
   ↓
3. Mercado Pago procesa el pago
   ↓
4. Mercado Pago envía notificación a tu webhook
   ↓
5. Backend valida firma HMAC
   ↓
6. Backend consulta detalles del pago a API de MP
   ↓
7. Backend verifica status = "approved"
   ↓
8. Backend extrae metadata (user_id, category_ids)
   ↓
9. Backend crea registros en category_purchases
   ↓
10. Usuario tiene acceso a los cursos ✅
```

---

## 📚 Recursos Adicionales

- [Documentación oficial de Webhooks](https://www.mercadopago.com.ar/developers/es/docs/checkout-api/additional-content/your-integrations/notifications/webhooks)
- [Simulador de Webhooks](https://www.mercadopago.com.ar/developers/panel/webhooks/simulator)
- [Tarjetas de prueba](https://www.mercadopago.com.ar/developers/es/docs/checkout-api/additional-content/test-cards)
- [Panel de desarrolladores](https://www.mercadopago.com.ar/developers/panel)

---

## ⚙️ Configuración de Producción

### 1. SSL/HTTPS Obligatorio
Mercado Pago **requiere** HTTPS en producción.

### 2. Webhook Secret en Variables de Entorno
**NUNCA** commitees el secret al repositorio.

### 3. Rate Limiting
El sistema ya tiene rate limiting configurado, pero puedes ajustarlo en `app.module.ts`.

### 4. Monitoring
Considera usar herramientas como:
- Sentry (errores)
- DataDog / New Relic (performance)
- CloudWatch / Railway logs (logs)

### 5. Backups
Asegúrate de tener backups de la base de datos antes de ir a producción.

---

## ✅ Checklist de Deployment

- [ ] Variables de entorno configuradas (`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_PUBLIC_KEY`)
- [ ] Webhook registrado en panel de Mercado Pago (URL de producción)
- [ ] HTTPS configurado y funcionando
- [ ] Probado con tarjetas de prueba en sandbox
- [ ] Probado un pago real en producción
- [ ] Logs configurados y monitoreados
- [ ] Backup de base de datos configurado
- [ ] Rate limiting ajustado según necesidad
- [ ] Equipo notificado de cómo funciona el sistema

---

**🎉 ¡Listo! Tu sistema de webhooks de Mercado Pago está configurado y listo para recibir pagos.**

