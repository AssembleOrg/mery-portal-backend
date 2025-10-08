import { Injectable, ConflictException, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../shared/services';
import { PasswordUtil, DateTimeUtil } from '../../shared/utils';
import { JwtPayload, UserRole } from '../../shared/types';
import { LoginDto, RegisterDto, AuthResponseDto, VerifyEmailDto, ResendVerificationDto, ForgotPasswordDto, ResetPasswordDto, MeResponseDto } from './dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ message: string }> {
    const { email, password, firstName, lastName } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('El usuario ya existe');
    }

    // Validate password strength
    if (!PasswordUtil.validate(password)) {
      throw new ConflictException(
        'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número',
      );
    }

    // Hash password
    const hashedPassword = await PasswordUtil.hash(password);

    // Generate verification token
    const verificationToken = this.generateToken();
    const verificationExpires = DateTimeUtil.now().plus({ hours: 24 }).toJSDate();

    // Create user with USER role only
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: UserRole.USER, // Only USER role can be created through registration
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
        lastVerificationEmailSent: DateTimeUtil.now().toJSDate(),
      },
    });

    // Send verification email
    await this.emailService.sendVerificationEmail(
      email,
      firstName || 'Usuario',
      verificationToken,
    );

    return {
      message: 'Usuario registrado exitosamente. Por favor verifica tu correo electrónico.',
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.generateTokenResponse(user);
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.deletedAt) {
      return null;
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Por favor verifica tu correo electrónico antes de iniciar sesión',
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tu cuenta ha sido desactivada');
    }

    const isPasswordValid = await PasswordUtil.compare(password, user.password);
    if (isPasswordValid) {
      const { password: _, ...result } = user;
      return result;
    }

    return null;
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<{ message: string }> {
    const { token } = verifyEmailDto;

    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: { gte: DateTimeUtil.now().toJSDate() },
        deletedAt: null,
      },
    });

    if (!user) {
      throw new BadRequestException('Token de verificación inválido o expirado');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('El correo electrónico ya ha sido verificado');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    return {
      message: 'Correo electrónico verificado exitosamente. Ya puedes iniciar sesión.',
    };
  }

  async resendVerificationEmail(resendDto: ResendVerificationDto): Promise<{ message: string }> {
    const { email } = resendDto;

    const user = await this.prisma.user.findUnique({
      where: { email, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('El correo electrónico ya ha sido verificado');
    }

    // Check rate limiting: max 2 emails per hour
    if (user.lastVerificationEmailSent) {
      const hourAgo = DateTimeUtil.now().minus({ hours: 1 }).toJSDate();
      const lastSent = new Date(user.lastVerificationEmailSent);
      
      if (lastSent > hourAgo) {
        const minutesLeft = Math.ceil((lastSent.getTime() - hourAgo.getTime()) / (1000 * 60));
        throw new BadRequestException(
          `Por favor espera ${minutesLeft} minutos antes de solicitar otro correo de verificación`,
        );
      }
    }

    // Generate new verification token
    const verificationToken = this.generateToken();
    const verificationExpires = DateTimeUtil.now().plus({ hours: 24 }).toJSDate();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
        lastVerificationEmailSent: DateTimeUtil.now().toJSDate(),
      },
    });

    // Send verification email
    await this.emailService.sendVerificationEmail(
      email,
      user.firstName || 'Usuario',
      verificationToken,
    );

    return {
      message: 'Correo de verificación enviado exitosamente',
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    const { email } = forgotPasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { email, deletedAt: null },
    });

    // Don't reveal if user exists or not
    if (!user) {
      return {
        message: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña',
      };
    }

    if (!user.isEmailVerified) {
      throw new BadRequestException(
        'Por favor verifica tu correo electrónico primero',
      );
    }

    // Check rate limiting: max 2 emails per hour
    if (user.lastPasswordResetEmailSent) {
      const hourAgo = DateTimeUtil.now().minus({ hours: 1 }).toJSDate();
      const lastSent = new Date(user.lastPasswordResetEmailSent);
      
      if (lastSent > hourAgo) {
        const minutesLeft = Math.ceil((lastSent.getTime() - hourAgo.getTime()) / (1000 * 60));
        throw new BadRequestException(
          `Por favor espera ${minutesLeft} minutos antes de solicitar otro correo de restablecimiento`,
        );
      }
    }

    // Generate reset token
    const resetToken = this.generateToken();
    const resetExpires = DateTimeUtil.now().plus({ hours: 1 }).toJSDate();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
        lastPasswordResetEmailSent: DateTimeUtil.now().toJSDate(),
      },
    });

    // Send password reset email
    await this.emailService.sendPasswordResetEmail(
      email,
      user.firstName || 'Usuario',
      resetToken,
    );

    return {
      message: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const { token, newPassword } = resetPasswordDto;

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gte: DateTimeUtil.now().toJSDate() },
        deletedAt: null,
      },
    });

    if (!user) {
      throw new BadRequestException('Token de restablecimiento inválido o expirado');
    }

    // Validate password strength
    if (!PasswordUtil.validate(newPassword)) {
      throw new BadRequestException(
        'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número',
      );
    }

    // Hash new password
    const hashedPassword = await PasswordUtil.hash(newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return {
      message: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión.',
    };
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async getCurrentUser(jwtPayload: JwtPayload): Promise<{ id: string; email: string; role: UserRole }> {
    // Retornar directamente la información del JWT
    // No se hace query a la base de datos para mayor performance
    return {
      id: jwtPayload.sub,
      email: jwtPayload.email,
      role: jwtPayload.role,
    };
  }

  private async generateTokenResponse(user: any): Promise<AuthResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '24h');

    return {
      accessToken,
      expiresIn,
      role: user.role,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }
}
