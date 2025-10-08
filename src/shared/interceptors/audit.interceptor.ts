import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_KEY, AuditOptions } from '../decorators';
import { AuditContext, AuditData } from '../types';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    @Inject(forwardRef(() => 'AuditService'))
    private auditService: any,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditOptions = this.reflector.get<AuditOptions>(
      AUDIT_KEY,
      context.getHandler(),
    );

    if (!auditOptions) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const auditContext: AuditContext = {
      userId: request.user?.sub,
      ipAddress: request.ip || request.connection.remoteAddress,
      userAgent: request.get('User-Agent'),
    };

    return next.handle().pipe(
      tap(async (data) => {
        try {
          const auditData: AuditData = {
            action: auditOptions.action,
            entity: auditOptions.entity,
            entityId: auditOptions.entityId || data?.id || 'unknown',
            newValues: data,
          };

          if (this.auditService) {
            await this.auditService.log(auditData, auditContext);
          }
        } catch (error) {
          console.error('Error logging audit:', error);
        }
      }),
    );
  }
}
