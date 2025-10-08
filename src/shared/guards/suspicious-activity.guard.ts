import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Guard to detect and block suspicious activity patterns
 */
@Injectable()
export class SuspiciousActivityGuard implements CanActivate {
  private readonly logger = new Logger(SuspiciousActivityGuard.name);
  private readonly suspiciousPatterns = [
    /(\bor\b|\band\b).*=.*/, // SQL injection patterns
    /<script|javascript:|onerror=/i, // XSS patterns
    /\.\.\/|\.\.\\/, // Path traversal
    /%00|%0d|%0a/, // Null byte injection
    /union.*select|select.*from/i, // SQL union attacks
  ];

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // Check URL, query params, and body for suspicious patterns
    const suspicious = this.detectSuspiciousActivity(request);
    
    if (suspicious) {
      const ip = request.ip || request.connection?.remoteAddress;
      const userAgent = request.get('user-agent');
      
      this.logger.warn(`🚨 Suspicious activity detected from IP: ${ip}`, {
        url: request.url,
        method: request.method,
        userAgent,
        pattern: suspicious,
      });
      
      throw new ForbiddenException('Actividad sospechosa detectada');
    }
    
    return true;
  }

  private detectSuspiciousActivity(request: any): string | null {
    // Check URL
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(request.url)) {
        return `URL pattern: ${pattern}`;
      }
    }

    // Check query parameters
    const queryString = JSON.stringify(request.query || {});
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(queryString)) {
        return `Query pattern: ${pattern}`;
      }
    }

    // Check body (excluding safe fields like base64 images)
    if (request.body) {
      const bodyCopy = this.sanitizeBodyForCheck(request.body);
      const bodyString = JSON.stringify(bodyCopy);
      
      for (const pattern of this.suspiciousPatterns) {
        if (pattern.test(bodyString)) {
          return `Body pattern: ${pattern}`;
        }
      }
    }

    return null;
  }

  /**
   * Remove safe fields that may contain false positives (like base64 images)
   */
  private sanitizeBodyForCheck(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };
    
    // Skip base64 image fields (they can contain patterns that look suspicious)
    if (sanitized.image && typeof sanitized.image === 'string' && 
        sanitized.image.startsWith('data:image/')) {
      delete sanitized.image;
    }

    return sanitized;
  }
}
