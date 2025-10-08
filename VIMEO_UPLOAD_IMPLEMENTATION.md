# 📹 Implementación Completa: Carga de Videos a Vimeo

## 🎉 Implementación Exitosa

Se ha implementado un sistema completo de carga de videos grandes (hasta 2GB) a Vimeo usando el **protocolo tus** (carga resumible).

---

## ✅ Características Implementadas

### 1. **Carga con Protocolo tus**
- ✅ Soporte para archivos de hasta 2GB
- ✅ Carga resumible (si falla, puede continuar)
- ✅ Progreso en tiempo real (logs del servidor)
- ✅ División automática en chunks
- ✅ Retry automático con estrategia exponencial

### 2. **Validación Robusta**
- ✅ Validación de tipo MIME (video/mp4, video/mpeg, etc.)
- ✅ Validación de extensión (.mp4, .mov, .avi, .mkv, .mpeg)
- ✅ Límite de tamaño: 2GB máximo
- ✅ Validación de slug único
- ✅ Validación de categoría existente

### 3. **Gestión de Archivos Temporales**
- ✅ Almacenamiento en `./tmp/uploads`
- ✅ Nombres de archivo únicos con timestamp
- ✅ Limpieza automática después de upload exitoso
- ✅ Limpieza automática en caso de error

### 4. **Integración Completa**
- ✅ Subida automática a Vimeo
- ✅ Espera inteligente del procesamiento de Vimeo
- ✅ Obtención automática de thumbnail y duración
- ✅ Creación automática del registro en base de datos
- ✅ Endpoint para verificar estado de procesamiento

---

## 🔌 Endpoints Implementados

### POST /videos/upload

**Sube un video a Vimeo y lo registra en la base de datos**

**Acceso**: ADMIN, SUBADMIN  
**Content-Type**: `multipart/form-data`  
**Timeout**: 1 hora (suficiente para archivos de 2GB)

**Body (Form Data)**:
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| file | file | ✅ | Archivo de video (max 2GB) |
| title | string | ✅ | Título del video |
| slug | string | ✅ | Slug único para el video |
| description | string | ❌ | Descripción del video |
| categoryId | string | ✅ | ID de la categoría/curso |
| order | number | ❌ | Orden del video (0 = preview gratis) |
| isPublished | boolean | ❌ | Publicar inmediatamente |

**Respuesta (201)**:
```json
{
  "success": true,
  "data": {
    "id": "clx123...",
    "title": "Técnica Avanzada de Microblading",
    "slug": "tecnica-avanzada-microblading",
    "description": "En este video aprenderás...",
    "thumbnail": "https://i.vimeocdn.com/video/...",
    "duration": 1200,
    "categoryId": "cat_456...",
    "category": {
      "id": "cat_456...",
      "name": "Curso de Cejas",
      "slug": "curso-cejas"
    },
    "isPublished": false,
    "publishedAt": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Respuestas de Error**:
- **400**: Archivo inválido o datos incorrectos
- **404**: Categoría no encontrada
- **409**: Slug duplicado
- **500**: Error en la carga a Vimeo

---

### GET /videos/:id/upload-status

**Verifica el estado de procesamiento del video en Vimeo**

**Acceso**: ADMIN, SUBADMIN

**Respuesta (200)**:
```json
{
  "success": true,
  "data": {
    "status": "processing",
    "message": "El video está siendo procesado por Vimeo. Esto puede tomar varios minutos."
  }
}
```

**Estados posibles**:
- `uploading`: Video se está cargando a Vimeo
- `processing`: Video se está procesando (transcodificación)
- `available`: Video listo para visualización
- `error`: Error en el procesamiento

---

## 🔧 Archivos Modificados/Creados

### Nuevos Archivos

```
src/modules/videos/dto/
├── upload-video.dto.ts      - DTO para carga de video
└── upload-status.dto.ts     - DTO para estado de procesamiento

src/modules/vimeo/
└── vimeo.service.ts         - Métodos uploadLargeVideo() y checkVideoStatus()

src/modules/videos/
├── videos.service.ts        - Métodos uploadVideo() y getUploadStatus()
└── videos.controller.ts     - Endpoints /upload y /:id/upload-status

tmp/uploads/                  - Directorio para archivos temporales (creado automáticamente)
```

### Archivos Modificados

```
src/main.ts                   - Aumentado timeout a 1 hora para uploads grandes
package.json                  - Añadido tus-js-client y @types/multer
```

---

## 💻 Ejemplo de Uso

### Desde curl

```bash
# Upload video
curl -X POST http://localhost:3000/api/videos/upload \
  -H "Authorization: Bearer <admin-token>" \
  -F "file=@/path/to/video.mp4" \
  -F "title=Técnica Avanzada de Microblading" \
  -F "slug=tecnica-avanzada-microblading" \
  -F "description=En este video aprenderás..." \
  -F "categoryId=cat_123..." \
  -F "order=1" \
  -F "isPublished=false"

# Verificar estado
curl http://localhost:3000/api/videos/<video-id>/upload-status \
  -H "Authorization: Bearer <admin-token>"
```

### Desde JavaScript/TypeScript

```typescript
// Upload video
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('title', 'Técnica Avanzada de Microblading');
formData.append('slug', 'tecnica-avanzada-microblading');
formData.append('description', 'En este video aprenderás...');
formData.append('categoryId', 'cat_123...');
formData.append('order', '1');
formData.append('isPublished', 'false');

const response = await fetch('http://localhost:3000/api/videos/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData,
});

const video = await response.json();
console.log('Video subido:', video.data.id);

// Verificar estado cada 10 segundos
const checkStatus = async () => {
  const statusResponse = await fetch(
    `http://localhost:3000/api/videos/${video.data.id}/upload-status`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  
  const status = await statusResponse.json();
  console.log('Estado:', status.data.status);
  
  if (status.data.status === 'available') {
    console.log('✅ Video listo para visualización!');
  } else if (status.data.status !== 'error') {
    // Verificar de nuevo en 10 segundos
    setTimeout(checkStatus, 10000);
  }
};

checkStatus();
```

### Desde React (con progreso)

```typescript
import { useState } from 'react';
import axios from 'axios';

function VideoUploader() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processing, setProcessing] = useState(false);

  const handleUpload = async (file: File, metadata: any) => {
    const formData = new FormData();
    formData.append('file', file);
    Object.keys(metadata).forEach(key => {
      formData.append(key, metadata[key]);
    });

    try {
      // Upload video con progreso
      const response = await axios.post('/api/videos/upload', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 100)
          );
          setUploadProgress(percentCompleted);
        },
      });

      const video = response.data.data;
      console.log('Video creado:', video.id);

      // Esperar procesamiento de Vimeo
      setProcessing(true);
      await waitForProcessing(video.id);
      
      alert('✅ Video listo!');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al subir el video');
    }
  };

  const waitForProcessing = async (videoId: string) => {
    while (true) {
      const { data } = await axios.get(`/api/videos/${videoId}/upload-status`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (data.data.status === 'available') {
        return;
      }

      if (data.data.status === 'error') {
        throw new Error('Error procesando video');
      }

      // Esperar 10 segundos antes de verificar de nuevo
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  };

  return (
    <div>
      <input type="file" accept="video/*" onChange={handleFileChange} />
      {uploadProgress > 0 && (
        <div>
          <p>Subiendo: {uploadProgress}%</p>
          <progress value={uploadProgress} max="100" />
        </div>
      )}
      {processing && <p>Procesando video en Vimeo...</p>}
    </div>
  );
}
```

---

## ⚙️ Configuración

### Variables de Entorno Necesarias

```bash
# .env
VIMEO_CLIENT_ID=your_client_id
VIMEO_CLIENT_SECRET=your_client_secret
VIMEO_ACCESS_TOKEN=your_access_token
```

### Timeout del Servidor

El timeout se configuró en **1 hora** (3600 segundos) en `main.ts`:

```typescript
expressApp.setTimeout(3600000); // 1 hour for large uploads
```

Esto es suficiente para archivos de 2GB incluso con conexiones lentas.

### Directorio Temporal

Los archivos se guardan temporalmente en `./tmp/uploads` y se limpian automáticamente:
- ✅ Después de upload exitoso a Vimeo
- ✅ Después de error (para no llenar el disco)

**Importante**: Asegúrate de que `./tmp/uploads` esté en `.gitignore`.

---

## 📊 Flujo Completo

```
1. Usuario sube archivo (1GB)
   ↓
2. Backend recibe y guarda en ./tmp/uploads
   ↓
3. Validaciones (tipo, tamaño, extensión)
   ↓
4. Inicia carga a Vimeo con tus protocol
   ↓
5. Progreso en tiempo real (logs del servidor)
   ↓
6. Vimeo confirma recepción completa
   ↓
7. Backend espera inicio del procesamiento (max 5 min)
   ↓
8. Obtiene información del video (thumbnail, duración)
   ↓
9. Crea registro en base de datos
   ↓
10. Limpia archivo temporal
   ↓
11. Retorna VideoResponseDto al cliente
   ↓
12. Cliente puede verificar estado con /upload-status
```

---

## 🔒 Seguridad

### Validaciones Implementadas

1. **Autenticación**: Solo ADMIN y SUBADMIN pueden subir
2. **Tipo de archivo**: Solo formatos de video permitidos
3. **Tamaño**: Máximo 2GB por archivo
4. **Extensión**: Lista blanca de extensiones (.mp4, .mov, etc.)
5. **Slug único**: No permite duplicados
6. **Privacidad en Vimeo**: Videos privados por defecto

### Formatos Aceptados

- ✅ `.mp4` - MP4 (recomendado)
- ✅ `.mov` - QuickTime
- ✅ `.avi` - AVI
- ✅ `.mkv` - Matroska
- ✅ `.mpeg` - MPEG

---

## 🚀 Ventajas de Esta Implementación

### 1. **Protocolo tus**
- Carga resumible (puede continuar si falla)
- División automática en chunks
- Retry automático
- Perfecto para archivos grandes (1GB+)

### 2. **Backend-Based**
- No expone credenciales de Vimeo al cliente
- Control total del proceso
- Validación centralizada
- Auditoría completa

### 3. **Automatización**
- Obtiene thumbnail automáticamente
- Obtiene duración automáticamente
- Limpieza automática de archivos temporales
- Creación automática en base de datos

### 4. **Manejo de Errores**
- Try-catch robusto
- Limpieza en caso de error
- Mensajes de error descriptivos
- Logs detallados

---

## 📝 Logs del Servidor

Durante la carga verás logs como estos:

```
[VideosService] Iniciando carga de video a Vimeo: Técnica Avanzada de Microblading
[VideosService] Archivo: ./tmp/uploads/video-1234567890.mp4 (1024.50 MB)
[VimeoService] Iniciando carga de video: Técnica Avanzada de Microblading
[VimeoService] Tamaño del archivo: 1024.50 MB
[VimeoService] Video creado en Vimeo. ID: 987654321
[VimeoService] URL de carga: https://...
[VimeoService] Progreso: 10.00% (104857600/1048576000 bytes)
[VimeoService] Progreso: 20.00% (209715200/1048576000 bytes)
...
[VimeoService] Progreso: 100.00% (1048576000/1048576000 bytes)
[VimeoService] ✅ Video subido exitosamente. Vimeo ID: 987654321
[VideosService] Video subido a Vimeo exitosamente. ID: 987654321
[VideosService] Esperando a que Vimeo procese el video...
[VideosService] Verificando estado del video... (1/30)
[VideosService] ✅ Video disponible en Vimeo
[VideosService] Archivo temporal eliminado: ./tmp/uploads/video-1234567890.mp4
[VideosService] ✅ Video creado en base de datos. ID: clx123...
```

---

## 🎯 Próximos Pasos Opcionales

### 1. **WebSocket para Progreso en Tiempo Real**
Implementar WebSocket para mostrar el progreso en el frontend en tiempo real.

### 2. **Cola de Procesamiento**
Usar Bull Queue o similar para manejar múltiples uploads simultáneos.

### 3. **Resumable Upload desde Cliente**
Permitir que el cliente suba directamente a Vimeo usando tokens temporales.

### 4. **Thumbnails Personalizados**
Permitir al admin subir un thumbnail personalizado.

### 5. **Metadatos Adicionales**
Tags, categorías de Vimeo, configuración de privacidad avanzada.

---

## 🆘 Troubleshooting

### Error: "Timeout"
**Causa**: El archivo es muy grande o la conexión es lenta  
**Solución**: Aumentar el timeout en `main.ts`

### Error: "File not found"
**Causa**: El directorio `./tmp/uploads` no existe  
**Solución**: Se crea automáticamente, verificar permisos

### Error: "Vimeo credentials not configured"
**Causa**: Faltan variables de entorno  
**Solución**: Configurar VIMEO_CLIENT_ID, VIMEO_CLIENT_SECRET, VIMEO_ACCESS_TOKEN

### Video se carga pero no se procesa
**Causa**: Vimeo está procesando, puede tomar tiempo  
**Solución**: Usar el endpoint `/upload-status` para verificar

---

## 📚 Referencias

- **Vimeo API Documentation**: https://developer.vimeo.com/api/upload/videos
- **tus Protocol**: https://tus.io/
- **Multer Documentation**: https://github.com/expressjs/multer
- **NestJS File Upload**: https://docs.nestjs.com/techniques/file-upload

---

**✅ Sistema de Carga de Videos Completamente Implementado y Funcional!** 🎉

