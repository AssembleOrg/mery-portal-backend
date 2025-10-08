import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from '../../../shared/types';
import { PrismaService } from '../../../shared/services';

/**
 * Custom JWT extractor that checks both cookie and Authorization header
 * This provides dual support for cookie-based and Bearer token authentication
 */
const cookieAndHeaderExtractor = (req: Request): string | null => {
  // 1. Try to extract from cookie first (preferred method for web apps)
  if (req && req.cookies && req.cookies['auth_token']) {
    return req.cookies['auth_token'];
  }

  // 2. Fallback to Authorization header (for mobile apps, API clients, etc.)
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: cookieAndHeaderExtractor,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Usuario no válido o inactivo');
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role as any,
    };
  }
}
