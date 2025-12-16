import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as ApiResponseDoc, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import * as express from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, AuthResponseDto, VerifyEmailDto, ResendVerificationDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto, MeResponseDto } from './dto';
import { Public, CurrentUser } from '../../shared/decorators';
import { AuthThrottlerGuard, JwtAuthGuard } from '../../shared/guards';

@ApiTags('Autenticación')
@Controller('auth')
@UseGuards(AuthThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @Throttle({ short: { ttl: 60000, limit: 3 } }) // Max 3 registrations per minute per IP
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  @ApiResponseDoc({
    status: 201,
    description: 'Usuario registrado exitosamente. Se envió un correo de verificación.',
  })
  @ApiResponseDoc({
    status: 409,
    description: 'El usuario ya existe',
  })
  async register(@Body() registerDto: RegisterDto): Promise<{ message: string }> {
    return this.authService.register(registerDto);
  }

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar correo electrónico' })
  @ApiResponseDoc({
    status: 200,
    description: 'Correo electrónico verificado exitosamente',
  })
  @ApiResponseDoc({
    status: 400,
    description: 'Token inválido o expirado',
  })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto): Promise<{ message: string }> {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Post('resend-verification')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reenviar correo de verificación' })
  @ApiResponseDoc({
    status: 200,
    description: 'Correo de verificación enviado exitosamente',
  })
  @ApiResponseDoc({
    status: 400,
    description: 'Error al enviar correo (límite de tasa alcanzado o correo ya verificado)',
  })
  @ApiResponseDoc({
    status: 404,
    description: 'Usuario no encontrado',
  })
  async resendVerification(@Body() resendDto: ResendVerificationDto): Promise<{ message: string }> {
    return this.authService.resendVerificationEmail(resendDto);
  }

  @Post('login')
  @Public()
  @Throttle({ short: { ttl: 60000, limit: 5 } }) // Max 5 login attempts per minute per IP
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponseDoc({
    status: 200,
    description: 'Inicio de sesión exitoso. El token también se envía en cookie HttpOnly.',
    type: AuthResponseDto,
  })
  @ApiResponseDoc({
    status: 401,
    description: 'Credenciales inválidas o correo no verificado',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: express.Response,
  ): Promise<AuthResponseDto> {
    const authResponse = await this.authService.login(loginDto);

    // Set HttpOnly cookie for better security
    res.cookie('auth_token', authResponse.accessToken, {
      httpOnly: true, // No accessible via JavaScript (XSS protection)
      sameSite: 'lax', // CSRF protection + survives normal navigation
      path: '/',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours (matches JWT expiration)
      secure: process.env.NODE_ENV === 'production', // Only HTTPS in production
    });

    return authResponse;
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar sesión y limpiar cookies httpOnly' })
  @ApiResponseDoc({
    status: 200,
    description: 'Sesión cerrada exitosamente. Todas las cookies de autenticación han sido eliminadas.',
  })
  async logout(@Res({ passthrough: true }) res: express.Response): Promise<{ message: string; success: boolean }> {
    // Array of possible cookie names to clear
    const cookieNames = ['auth_token', 'access_token', 'token', 'jwt', 'session'];
    
    // Cookie options for clearing
    const cookieOptions = [
      { httpOnly: true, sameSite: 'lax' as const, path: '/' },
      { httpOnly: true, sameSite: 'strict' as const, path: '/' },
      { httpOnly: true, sameSite: 'none' as const, path: '/', secure: true },
    ];

    // Clear all possible cookie combinations
    cookieNames.forEach(cookieName => {
      cookieOptions.forEach(options => {
        res.clearCookie(cookieName, options);
      });
    });

    return { 
      success: true,
      message: 'Sesión cerrada exitosamente. Cookies eliminadas.' 
    };
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar restablecimiento de contraseña' })
  @ApiResponseDoc({
    status: 200,
    description: 'Si el correo existe, se enviaron instrucciones',
  })
  @ApiResponseDoc({
    status: 400,
    description: 'Error (límite de tasa alcanzado)',
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.authService.forgotPassword(forgotPasswordDto); 
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restablecer contraseña' })
  @ApiResponseDoc({
    status: 200,
    description: 'Contraseña restablecida exitosamente',
  })
  @ApiResponseDoc({
    status: 400,
    description: 'Token inválido o expirado',
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambiar contraseña del usuario autenticado' })
  @ApiResponseDoc({
    status: 200,
    description: 'Contraseña cambiada exitosamente',
  })
  @ApiResponseDoc({
    status: 400,
    description: 'La nueva contraseña no cumple con los requisitos o es igual a la actual',
  })
  @ApiResponseDoc({
    status: 401,
    description: 'La contraseña actual es incorrecta o token inválido',
  })
  @ApiResponseDoc({
    status: 404,
    description: 'Usuario no encontrado',
  })
  async changePassword(
    @CurrentUser() user: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.changePassword(user.sub, changePasswordDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener información del usuario actual desde el JWT' })
  @ApiResponseDoc({
    status: 200,
    description: 'Información del usuario obtenida desde el token JWT',
  })
  @ApiResponseDoc({
    status: 401,
    description: 'Token inválido o sesión expirada',
  })
  async getCurrentUser(@CurrentUser() user: any) {
    return this.authService.getCurrentUser(user);
  }
}
