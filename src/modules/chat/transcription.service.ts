import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Transcripción de notas de voz vía Groq (Whisper, API compatible con OpenAI).
 * No persiste el audio: recibe el archivo, lo manda a Groq y devuelve el texto.
 * Requiere GROQ_API_KEY. Modelo configurable con GROQ_STT_MODEL.
 */
@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private readonly url =
    'https://api.groq.com/openai/v1/audio/transcriptions';
  private readonly maxSize = 25 * 1024 * 1024;

  constructor(private readonly config: ConfigService) {}

  async transcribe(file: Express.Multer.File): Promise<string> {
    const apiKey = this.config.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Falta GROQ_API_KEY en el entorno',
      );
    }
    if (!file || file.size === 0) {
      throw new BadRequestException('El audio está vacío');
    }
    if (file.size > this.maxSize) {
      throw new BadRequestException('El audio excede 25MB');
    }

    const model =
      this.config.get<string>('GROQ_STT_MODEL') ?? 'whisper-large-v3';

    const form = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], {
      type: file.mimetype || 'audio/webm',
    });
    form.append('file', blob, file.originalname || 'audio.webm');
    form.append('model', model);
    form.append('language', 'es');
    form.append('response_format', 'text');

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 60_000);
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        this.logger.error(
          `Groq STT error ${res.status}: ${txt.slice(0, 300)}`,
        );
        throw new ServiceUnavailableException(
          `Error de transcripción (${res.status})`,
        );
      }
      return (await res.text()).trim();
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.error('Groq STT fallo', err as Error);
      throw new ServiceUnavailableException('No se pudo transcribir el audio');
    } finally {
      clearTimeout(timeout);
    }
  }
}
