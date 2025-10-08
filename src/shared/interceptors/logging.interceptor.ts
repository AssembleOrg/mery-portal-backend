import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  // Rutas que no se loggearán (para evitar spam en logs)
  private readonly excludedPaths = ['/health', '/metrics', '/favicon.ico'];

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || 'Unknown';
    const startTime = Date.now();

    // Verificar si la ruta está excluida
    const shouldSkip = this.excludedPaths.some((path) => url.includes(path));
    if (shouldSkip) {
      return next.handle();
    }

    // Obtener información del usuario si está autenticado
    const user = (request as any).user;
    const userInfo = user ? ` - User: ${user.email} (${user.role})` : '';

    // Log del request entrante
    this.logger.log(
      `➜ ${method} ${url} - IP: ${ip}${userInfo}`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const { statusCode } = response;
          const responseTime = Date.now() - startTime;
          
          // Determinar el color/emoji según el código de estado
          const logMessage = `✓ ${method} ${url} ${statusCode} - ${responseTime}ms`;
          
          // Log de la respuesta exitosa
          if (statusCode >= 200 && statusCode < 300) {
            this.logger.log(logMessage);
          } else if (statusCode >= 300 && statusCode < 400) {
            this.logger.log(logMessage);
          } else {
            this.logger.warn(logMessage);
          }

          // Alert si la respuesta es muy lenta (>5s)
          if (responseTime > 5000) {
            this.logger.warn(
              `⚠️  SLOW REQUEST: ${method} ${url} took ${responseTime}ms`,
            );
          }
        },
        error: (error) => {
          const responseTime = Date.now() - startTime;
          const statusCode = error.status || 500;
          
          // Log del error
          this.logger.error(
            `✗ ${method} ${url} ${statusCode} - ${responseTime}ms - Error: ${error.message}`,
          );

          // Log adicional para errores críticos (500+)
          if (statusCode >= 500) {
            this.logger.error(`Stack trace: ${error.stack}`);
          }
        },
      }),
    );
  }
}

