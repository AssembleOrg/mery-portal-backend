# 📹 Carga de Videos a Vimeo

## 📊 Resumen de tu Situación

- **Tamaño de videos**: ~1GB cada uno
- **Calidad**: HD
- **Pregunta**: ¿Es posible subir videos mediante request API? ¿Es recomendable? ¿Hay alternativas?

---

## ✅ SÍ, es Posible y es la Mejor Opción

La API de Vimeo está diseñada específicamente para manejar videos grandes mediante **carga por partes (tus upload)** y es **altamente recomendable** para tu caso de uso.

---

## 🎯 Métodos de Carga a Vimeo

### 1. **Tus Upload (Recomendado para 1GB)** ⭐

El método **tus** es un protocolo estándar para carga de archivos grandes que:
- ✅ Soporta archivos de hasta **5GB en planes pagos** de Vimeo
- ✅ Permite **reanudar** si se interrumpe la conexión
- ✅ Divide el archivo en **chunks** automáticamente
- ✅ Progreso en tiempo real
- ✅ Es **el método oficial recomendado** por Vimeo

#### Ejemplo de Implementación (Node.js)

\`\`\`typescript
// vimeo.service.ts - Método para subir video grande
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Vimeo } from '@vimeo/vimeo';
import * as fs from 'fs';
import * as tus from 'tus-js-client';

@Injectable()
export class VimeoService {
  private readonly logger = new Logger(VimeoService.name);
  private client: Vimeo;

  constructor(private configService: ConfigService) {
    const clientId = this.configService.get<string>('VIMEO_CLIENT_ID');
    const clientSecret = this.configService.get<string>('VIMEO_CLIENT_SECRET');
    const accessToken = this.configService.get<string>('VIMEO_ACCESS_TOKEN');

    this.client = new Vimeo(clientId, clientSecret, accessToken);
  }

  /**
   * Upload large video using tus protocol
   * Perfect for 1GB+ videos
   */
  async uploadLargeVideo(
    filePath: string,
    name: string,
    description?: string,
    onProgress?: (bytesUploaded: number, bytesTotal: number) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.logger.log(\`Iniciando carga de video: \${name}\`);

      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      // Paso 1: Crear el video en Vimeo
      this.client.request(
        {
          method: 'POST',
          path: '/me/videos',
          query: {
            upload: {
              approach: 'tus',
              size: fileSize,
            },
            name,
            description,
            privacy: {
              view: 'disable', // Privado por defecto
              embed: 'whitelist',
            },
          },
        },
        (error, body, statusCode) => {
          if (error) {
            this.logger.error('Error creando video en Vimeo:', error);
            return reject(error);
          }

          const uploadLink = body.upload.upload_link;
          const videoUri = body.uri; // /videos/123456789
          const vimeoId = videoUri.split('/').pop();

          this.logger.log(\`Video creado en Vimeo. ID: \${vimeoId}\`);
          this.logger.log(\`Subiendo archivo (\${(fileSize / 1024 / 1024).toFixed(2)} MB)...\`);

          // Paso 2: Subir el archivo usando tus
          const file = fs.createReadStream(filePath);

          const upload = new tus.Upload(file, {
            endpoint: uploadLink,
            retryDelays: [0, 3000, 5000, 10000, 20000],
            metadata: {
              filename: name,
              filetype: 'video/mp4',
            },
            uploadSize: fileSize,
            onError: (error) => {
              this.logger.error('Error durante la carga:', error);
              reject(error);
            },
            onProgress: (bytesUploaded, bytesTotal) => {
              const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
              this.logger.log(\`Progreso: \${percentage}% (\${bytesUploaded}/\${bytesTotal} bytes)\`);
              
              if (onProgress) {
                onProgress(bytesUploaded, bytesTotal);
              }
            },
            onSuccess: () => {
              this.logger.log(\`✅ Video subido exitosamente. Vimeo ID: \${vimeoId}\`);
              resolve(vimeoId);
            },
          });

          // Iniciar la carga
          upload.start();
        },
      );
    });
  }

  /**
   * Check video processing status
   */
  async checkVideoStatus(vimeoId: string): Promise<{
    status: 'uploading' | 'processing' | 'available' | 'error';
    progress?: number;
  }> {
    try {
      const response = await this.makeRequest('GET', \`/videos/\${vimeoId}\`);
      const video = response.body;

      if (video.upload?.status === 'in_progress') {
        return { status: 'uploading' };
      }

      if (video.transcode?.status === 'in_progress') {
        return { status: 'processing' };
      }

      if (video.transcode?.status === 'complete') {
        return { status: 'available' };
      }

      return { status: 'error' };
    } catch (error) {
      this.logger.error(\`Error verificando estado del video \${vimeoId}:\`, error);
      throw error;
    }
  }

  private async makeRequest(method: string, path: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.request(
        {
          method,
          path,
          query: params,
        },
        (error, body, statusCode, headers) => {
          if (error) {
            reject(error);
          } else {
            resolve({ body, statusCode, headers });
          }
        },
      );
    });
  }
}
\`\`\`

#### Endpoint en el Controller

\`\`\`typescript
// videos.controller.ts
import { Controller, Post, UseInterceptors, UploadedFile, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

@Post('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUBADMIN)
@UseInterceptors(
  FileInterceptor('video', {
    storage: diskStorage({
      destination: './tmp/uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, \`video-\${uniqueSuffix}.mp4\`);
      },
    }),
    limits: {
      fileSize: 2 * 1024 * 1024 * 1024, // 2GB max
    },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith('video/')) {
        return cb(new BadRequestException('Solo se permiten archivos de video'), false);
      }
      cb(null, true);
    },
  }),
)
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      video: {
        type: 'string',
        format: 'binary',
      },
      title: { type: 'string' },
      description: { type: 'string' },
      categoryId: { type: 'string' },
    },
  },
})
async uploadVideo(
  @UploadedFile() file: Express.Multer.File,
  @Body() body: { title: string; description?: string; categoryId: string },
) {
  try {
    // Subir a Vimeo
    const vimeoId = await this.vimeoService.uploadLargeVideo(
      file.path,
      body.title,
      body.description,
      (bytesUploaded, bytesTotal) => {
        // Aquí podrías enviar progreso por WebSocket
        console.log(\`Progreso: \${(bytesUploaded / bytesTotal * 100).toFixed(2)}%\`);
      },
    );

    // Esperar a que Vimeo procese el video
    await this.waitForVideoProcessing(vimeoId);

    // Crear video en la base de datos
    const video = await this.videosService.create({
      title: body.title,
      slug: slugify(body.title),
      description: body.description,
      vimeoId,
      categoryId: body.categoryId,
    });

    // Limpiar archivo temporal
    fs.unlinkSync(file.path);

    return video;
  } catch (error) {
    // Limpiar archivo temporal en caso de error
    if (file && file.path) {
      fs.unlinkSync(file.path);
    }
    throw error;
  }
}

private async waitForVideoProcessing(vimeoId: string): Promise<void> {
  const maxAttempts = 60; // 10 minutos max
  let attempts = 0;

  while (attempts < maxAttempts) {
    const status = await this.vimeoService.checkVideoStatus(vimeoId);
    
    if (status.status === 'available') {
      return;
    }
    
    if (status.status === 'error') {
      throw new Error('Error procesando el video en Vimeo');
    }

    // Esperar 10 segundos antes de verificar de nuevo
    await new Promise(resolve => setTimeout(resolve, 10000));
    attempts++;
  }

  throw new Error('Timeout esperando que Vimeo procese el video');
}
\`\`\`

---

### 2. **Carga Directa (Para videos pequeños < 200MB)**

\`\`\`typescript
async uploadSmallVideo(filePath: string, name: string): Promise<string> {
  return new Promise((resolve, reject) => {
    this.client.upload(
      filePath,
      {
        name,
        description: '',
        privacy: {
          view: 'disable',
          embed: 'whitelist',
        },
      },
      (uri) => {
        const vimeoId = uri.split('/').pop();
        this.logger.log(\`Video subido exitosamente: \${vimeoId}\`);
        resolve(vimeoId);
      },
      (bytesUploaded, bytesTotal) => {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        this.logger.log(\`Progreso: \${percentage}%\`);
      },
      (error) => {
        this.logger.error('Error subiendo video:', error);
        reject(error);
      },
    );
  });
}
\`\`\`

---

## 📦 Dependencias Necesarias

\`\`\`bash
# Instalar paquetes
pnpm add @vimeo/vimeo tus-js-client @nestjs/platform-express

# Tipos para TypeScript
pnpm add -D @types/multer
\`\`\`

---

## 🏗️ Alternativas y Consideraciones

### Opción 1: **Carga desde el Backend** (Recomendado para tu caso)

#### ✅ Ventajas:
- Control total del proceso
- Validación y seguridad centralizadas
- No expones credenciales de Vimeo al cliente
- Puedes procesar el video antes de subirlo (conversión, thumbnails, etc.)
- Mejor para administradores subiendo contenido

#### ⚠️ Desventajas:
- Consume ancho de banda del servidor (subir + descargar)
- El servidor necesita espacio temporal para el archivo
- Límites de timeout en algunos hostings

#### 💡 Implementación:
\`\`\`
Usuario → Backend (multer) → Vimeo
         ↓
    Valida, procesa, 
    actualiza DB
\`\`\`

---

### Opción 2: **Carga Directa desde el Cliente**

Vimeo también permite que el cliente suba directamente usando un **upload token temporal**.

#### ✅ Ventajas:
- No consume ancho de banda del servidor
- Más rápido para el usuario
- Escalable (no limita por capacidad del servidor)

#### ⚠️ Desventajas:
- Más complejo de implementar
- Necesitas generar tokens temporales en el backend
- Menos control sobre el proceso

#### 💡 Implementación:
\`\`\`typescript
// Backend genera token
@Post('upload-token')
async generateUploadToken(@Body() body: { name: string; size: number }) {
  const response = await this.vimeoService.createUploadToken(body.name, body.size);
  return {
    uploadLink: response.upload.upload_link,
    videoUri: response.uri,
  };
}

// Frontend sube directamente a Vimeo
const upload = new tus.Upload(file, {
  endpoint: uploadLink,
  onSuccess: () => {
    // Notificar al backend que terminó
    fetch('/api/videos/complete-upload', {
      method: 'POST',
      body: JSON.stringify({ videoUri, categoryId }),
    });
  },
});
\`\`\`

---

## 🎬 Proceso Completo Recomendado

Para videos de 1GB en tu plataforma de cursos:

### 1. **Upload desde Administración**
\`\`\`
Admin Panel → Upload (1GB) → Backend → Vimeo (tus)
                                 ↓
                          Crear Video en DB
                                 ↓
                          Esperar procesamiento
                                 ↓
                          Video disponible
\`\`\`

### 2. **Con Progreso en Tiempo Real (WebSocket)**

\`\`\`typescript
// Emitir progreso por WebSocket
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway()
export class UploadGateway {
  @WebSocketServer()
  server: Server;

  emitProgress(userId: string, progress: number) {
    this.server.to(\`user-\${userId}\`).emit('upload-progress', { progress });
  }
}

// En el servicio de upload
onProgress: (bytesUploaded, bytesTotal) => {
  const progress = (bytesUploaded / bytesTotal) * 100;
  this.uploadGateway.emitProgress(userId, progress);
},
\`\`\`

---

## 🚀 Recomendaciones para Videos de 1GB

### ✅ Lo que SÍ debes hacer:

1. **Usar tus Upload** (no carga simple)
2. **Almacenamiento temporal**: Usa `/tmp` o cloud storage temporal
3. **Limits de Multer**: Configura bien los límites
   \`\`\`typescript
   limits: {
     fileSize: 2 * 1024 * 1024 * 1024, // 2GB
   }
   \`\`\`
4. **Timeout de servidor**: Aumenta el timeout para requests largos
   \`\`\`typescript
   // main.ts
   const server = app.getHttpAdapter().getInstance();
   server.setTimeout(3600000); // 1 hora
   \`\`\`
5. **Progreso visible**: Implementa indicador de progreso para el admin
6. **Validación**: Verifica formato, tamaño, codec antes de subir
7. **Limpieza**: Elimina archivos temporales después de subir
8. **Retry logic**: El protocolo tus maneja reintento automático
9. **Plan de Vimeo**: Asegúrate de tener un plan que soporte videos grandes
   - **Vimeo Plus**: Hasta 5GB por semana
   - **Vimeo Pro**: Hasta 20GB por semana
   - **Vimeo Business**: Hasta 7TB por año

### ⚠️ Lo que NO debes hacer:

1. ❌ No uses carga simple para archivos > 200MB
2. ❌ No almacenes videos en tu servidor (usa Vimeo)
3. ❌ No expongas tu access token de Vimeo al frontend
4. ❌ No olvides limpiar archivos temporales
5. ❌ No implementes tu propio sistema de video streaming

---

## 📊 Comparación de Métodos

| Método | Max Size | Resumable | Velocidad | Complejidad | Recomendado para |
|--------|----------|-----------|-----------|-------------|------------------|
| Simple Upload | 200MB | ❌ | 🟢 Rápida | 🟢 Baja | < 200MB |
| Tus Upload | 5GB+ | ✅ | 🟡 Media | 🟡 Media | **1GB (tu caso)** |
| Direct Client Upload | 5GB+ | ✅ | 🟢 Rápida | 🔴 Alta | Necesitas escalar |

---

## 🔐 Seguridad

\`\`\`typescript
// Validación del archivo
@UseInterceptors(
  FileInterceptor('video', {
    fileFilter: (req, file, cb) => {
      // 1. Verificar MIME type
      if (!file.mimetype.startsWith('video/')) {
        return cb(new BadRequestException('Solo archivos de video'), false);
      }

      // 2. Verificar extensión
      const allowedExtensions = ['.mp4', '.mov', '.avi', '.mkv'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        return cb(new BadRequestException('Formato de video no permitido'), false);
      }

      cb(null, true);
    },
  }),
)
\`\`\`

---

## 💰 Costos de Vimeo

- **Vimeo Plus**: $7/mes - 5GB/semana, 250GB storage
- **Vimeo Pro**: $20/mes - 20GB/semana, 1TB storage
- **Vimeo Business**: $50/mes - 7TB/año, 5TB storage
- **Vimeo Premium**: $75/mes - 7TB/año, unlimited storage

Para un sitio de cursos con videos de 1GB, **Vimeo Pro** es suficiente para comenzar.

---

## ✅ Respuesta Final

### ¿Es posible cargar videos de 1GB por API? **SÍ**
### ¿Es recomendable? **SÍ, usando tus upload**
### ¿Hay mejores alternativas? **No para tu caso de uso**

**Recomendación final**: 
- Implementa carga desde el backend usando **tus upload**
- Para 1GB de video en HD es el método perfecto
- Vimeo maneja todo el streaming, transcodificación y CDN
- Tu solo subes una vez y Vimeo se encarga del resto

---

## 📚 Referencias

- [Vimeo Upload API](https://developer.vimeo.com/api/upload/videos)
- [tus Protocol](https://tus.io/)
- [@vimeo/vimeo NPM](https://www.npmjs.com/package/@vimeo/vimeo)
- [tus-js-client](https://github.com/tus/tus-js-client)

