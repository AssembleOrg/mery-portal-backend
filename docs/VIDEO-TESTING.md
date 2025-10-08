# 🧪 Testing del Sistema de Videos

## Prerrequisitos

1. Servidor corriendo: `pnpm run start:dev`
2. Base de datos sincronizada
3. Credenciales de Vimeo configuradas
4. Tokens JWT:
   - `ADMIN_TOKEN` - Token de admin@mery.com
   - `USER_TOKEN` - Token de user@mery.com

## 🔑 Obtener Tokens

```bash
# Login como Admin
ADMIN_LOGIN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@mery.com",
    "password": "admin123"
  }')

ADMIN_TOKEN=$(echo $ADMIN_LOGIN | jq -r '.data.accessToken')
echo "Admin Token: $ADMIN_TOKEN"

# Login como Usuario
USER_LOGIN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@mery.com",
    "password": "user123"
  }')

USER_TOKEN=$(echo $USER_LOGIN | jq -r '.data.accessToken')
echo "User Token: $USER_TOKEN"
```

## 1️⃣ Admin: Crear Categoría

```bash
# Nota: Primero necesitas crear el módulo de categorías
# Por ahora, vamos a crear una manualmente en la BD

# Usando Prisma Studio:
npx prisma studio

# O usando SQL directo:
psql $DATABASE_URL -c "
INSERT INTO video_categories (id, name, slug, description, \"order\", \"isActive\", \"createdAt\", \"updatedAt\")
VALUES (
  gen_random_uuid()::text,
  'Técnicas de Cejas',
  'cejas',
  'Aprende todas las técnicas para cejas perfectas',
  1,
  true,
  NOW(),
  NOW()
);
"

# Obtener el ID de la categoría creada
CATEGORY_ID="clx..." # Copiar el ID generado
```

## 2️⃣ Admin: Crear Video con Precio

```bash
curl -X POST http://localhost:3000/api/videos \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Curso Completo de Microblading\",
    \"slug\": \"curso-microblading\",
    \"description\": \"Aprende todas las técnicas profesionales de microblading. Incluye teoría y práctica paso a paso.\",
    \"vimeoId\": \"123456789\",
    \"price\": 49.99,
    \"currency\": \"USD\",
    \"isFree\": false,
    \"categoryId\": \"$CATEGORY_ID\",
    \"order\": 1,
    \"metaTitle\": \"Curso de Microblading | Mery Garcia\",
    \"metaDescription\": \"Aprende microblading profesional\"
  }"

# Guardar el ID del video
VIDEO_ID="clx..." # Copiar del response
```

## 3️⃣ Usuario Normal: Intentar Crear Video (Debe Fallar)

```bash
curl -X POST http://localhost:3000/api/videos \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Intento de Usuario",
    "slug": "intento",
    "vimeoId": "999",
    "price": 10,
    "categoryId": "xxx"
  }'

# Debe retornar: 403 Forbidden
```

## 4️⃣ Público: Ver Lista de Videos (Sin Token)

```bash
curl -X GET "http://localhost:3000/api/videos"

# Respuesta incluye:
# - Lista de videos
# - Precios visibles
# - hasAccess: false (no autenticado)
# - vimeoId NO visible (por seguridad)
```

## 5️⃣ Usuario: Ver Videos (Con Token)

```bash
curl -X GET "http://localhost:3000/api/videos" \
  -H "Authorization: Bearer $USER_TOKEN"

# Respuesta incluye:
# - hasAccess: true/false (según si compró cada video)
# - isPurchased: true/false
```

## 6️⃣ Usuario: Intentar Ver Video Sin Comprar (Debe Fallar)

```bash
curl -X GET "http://localhost:3000/api/videos/$VIDEO_ID/stream" \
  -H "Authorization: Bearer $USER_TOKEN"

# Debe retornar: 403 Forbidden
# "Debes comprar este video para acceder al contenido"
```

## 7️⃣ Admin: Actualizar Precio del Video

```bash
curl -X PATCH "http://localhost:3000/api/videos/$VIDEO_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 39.99,
    "title": "Curso de Microblading - OFERTA"
  }'

# Verificar cambios
curl -X GET "http://localhost:3000/api/videos/$VIDEO_ID"
```

## 8️⃣ Usuario: Intentar Actualizar Video (Debe Fallar)

```bash
curl -X PATCH "http://localhost:3000/api/videos/$VIDEO_ID" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 0.01
  }'

# Debe retornar: 403 Forbidden
```

## 9️⃣ Simular Compra (Directo en BD)

```bash
# Por ahora, simulamos la compra insertando en BD
# Más adelante integrarás con tu procesador de pagos

psql $DATABASE_URL -c "
INSERT INTO video_purchases (
  id, \"userId\", \"videoId\", amount, currency, \"paymentStatus\", \"isActive\", \"createdAt\", \"updatedAt\"
)
VALUES (
  gen_random_uuid()::text,
  '$USER_ID',  -- ID del usuario (obtener de JWT o BD)
  '$VIDEO_ID',
  39.99,
  'USD',
  'completed',
  true,
  NOW(),
  NOW()
);
"
```

## 🔟 Usuario: Ver Video Después de Comprar

```bash
curl -X GET "http://localhost:3000/api/videos/$VIDEO_ID/stream" \
  -H "Authorization: Bearer $USER_TOKEN"

# Ahora debe retornar:
# {
#   "streamUrl": "https://player.vimeo.com/video/...",
#   "expiresIn": 3600
# }
```

## 1️⃣1️⃣ Usuario: Registrar Progreso

```bash
curl -X POST "http://localhost:3000/api/videos/$VIDEO_ID/progress" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "watchedSeconds": 900,
    "completed": false
  }'
```

## 1️⃣2️⃣ Usuario: Ver Progreso

```bash
curl -X GET "http://localhost:3000/api/videos/$VIDEO_ID/progress" \
  -H "Authorization: Bearer $USER_TOKEN"

# Respuesta:
# {
#   "watchedSeconds": 900,
#   "progress": 50,
#   "completed": false,
#   "lastWatchedAt": "2024-01-01T12:00:00Z"
# }
```

## 1️⃣3️⃣ Admin: Hacer Video Gratuito

```bash
curl -X PATCH "http://localhost:3000/api/videos/$VIDEO_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isFree": true,
    "price": 0
  }'

# Ahora CUALQUIER usuario autenticado puede verlo sin comprar
```

## 1️⃣4️⃣ Admin: Publicar/Despublicar Video

```bash
# Publicar
curl -X PATCH "http://localhost:3000/api/videos/$VIDEO_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isPublished": true,
    "publishedAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'"
  }'

# Despublicar
curl -X PATCH "http://localhost:3000/api/videos/$VIDEO_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isPublished": false
  }'
```

## 1️⃣5️⃣ Admin: Cambiar Categoría

```bash
curl -X PATCH "http://localhost:3000/api/videos/$VIDEO_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"categoryId\": \"$NEW_CATEGORY_ID\"
  }"
```

## 1️⃣6️⃣ Admin: Actualizar Video de Vimeo

```bash
# Si cambias el video en Vimeo, actualiza el vimeoId
# Esto automáticamente actualiza thumbnail, duration, vimeoUrl

curl -X PATCH "http://localhost:3000/api/videos/$VIDEO_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vimeoId": "987654321"
  }'
```

## 1️⃣7️⃣ Admin: Eliminar Video (Soft Delete)

```bash
curl -X DELETE "http://localhost:3000/api/videos/$VIDEO_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Respuesta: 204 No Content

# El video ya no aparecerá en listados
# Pero sigue en BD con deletedAt != null
```

## 1️⃣8️⃣ Filtros y Búsqueda

```bash
# Buscar por texto
curl "http://localhost:3000/api/videos?search=microblading"

# Filtrar por categoría
curl "http://localhost:3000/api/videos?categoryId=$CATEGORY_ID"

# Filtrar solo gratuitos
curl "http://localhost:3000/api/videos?isFree=true"

# Filtrar solo publicados
curl "http://localhost:3000/api/videos?isPublished=true"

# Ordenar por precio
curl "http://localhost:3000/api/videos?sortBy=price&sortOrder=desc"

# Paginación
curl "http://localhost:3000/api/videos?page=2&limit=5"

# Combinar filtros
curl "http://localhost:3000/api/videos?categoryId=$CATEGORY_ID&isPublished=true&sortBy=price&sortOrder=asc"
```

## 🎯 Checklist de Testing

- [ ] Admin puede crear video con precio
- [ ] Admin puede editar precio
- [ ] Admin puede editar título y descripción
- [ ] Admin puede publicar/despublicar
- [ ] Admin puede cambiar categoría
- [ ] Admin puede hacer video gratuito
- [ ] Admin puede eliminar video
- [ ] Usuario NO puede crear video
- [ ] Usuario NO puede editar video
- [ ] Usuario NO puede eliminar video
- [ ] Usuario puede ver lista de videos
- [ ] Usuario puede ver detalles de video
- [ ] Usuario NO puede ver video sin comprar
- [ ] Usuario puede ver video después de comprar
- [ ] Usuario puede registrar progreso
- [ ] Usuario puede ver su progreso
- [ ] Videos gratuitos son accesibles sin comprar
- [ ] Filtros y búsqueda funcionan
- [ ] vimeoId nunca se expone en APIs públicas

## ✅ Todo Funciona!

Si todos los tests pasan, tu sistema de videos con precios editables solo por admin está completamente funcional.
