import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) {
      // For public routes, try to authenticate if token exists
      // but don't fail if there's no token or if it's invalid
      try {
        const result = await super.canActivate(context);
        const request = context.switchToHttp().getRequest();
        this.logger.debug(`✅ Public route - Auth successful. User: ${request.user?.email}, Role: ${request.user?.role}`);
        return true;
      } catch (error) {
        // Token doesn't exist or is invalid, that's ok for public routes
        // request.user will be undefined
        this.logger.debug(`ℹ️ Public route - No valid token found (OK for public routes)`);
        return true;
      }
    }
    
    // For protected routes, enforce authentication
    return super.canActivate(context) as Promise<boolean>;
  }
}
