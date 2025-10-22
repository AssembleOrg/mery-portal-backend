import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as SibApiV3Sdk from '@sendinblue/client';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private apiInstance: SibApiV3Sdk.TransactionalEmailsApi;

  constructor(private configService: ConfigService) {
    this.apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    this.apiInstance.setApiKey(
      SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
      this.configService.get<string>('BREVO_API_KEY', ''),
    );
  }

  async sendVerificationEmail(
    email: string,
    name: string, 
    verificationToken: string,
  ): Promise<void> {
    const verificationUrl = `${this.configService.get<string>('FRONTEND_URL')}/es/verify-email?token=${verificationToken}`;

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.sender = {
      name: 'Mery Garcia - Cosmetic Tattoo',
      email: this.configService.get<string>('EMAIL_FROM', 'noreply@merygarcia.com'),
    };
    sendSmtpEmail.to = [{ email, name }];
    sendSmtpEmail.subject = 'Verifica tu correo electrónico - Mery Garcia';
    sendSmtpEmail.htmlContent = this.getVerificationEmailTemplate(name, verificationUrl);

    try {
      await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      this.logger.log(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}:`, error);
      throw error;
    }
  }

  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string,
  ): Promise<void> {
    const resetUrl = `${this.configService.get<string>('FRONTEND_URL')}/es/reset-password?token=${resetToken}`;

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.sender = {
      name: 'Mery Garcia - Cosmetic Tattoo',
      email: this.configService.get<string>('EMAIL_FROM', 'noreply@merygarcia.com'),
    };
    sendSmtpEmail.to = [{ email, name }];
    sendSmtpEmail.subject = 'Restablece tu contraseña - Mery Garcia';
    sendSmtpEmail.htmlContent = this.getPasswordResetEmailTemplate(name, resetUrl);

    try {
      await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}:`, error);
      throw error;
    }
  }

  async sendTemporaryPasswordEmail(
    email: string,
    name: string,
    temporaryPassword: string,
  ): Promise<void> {
    const loginUrl = `${this.configService.get<string>('FRONTEND_URL')}/es/login`;

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.sender = {
      name: 'Mery Garcia - Cosmetic Tattoo',
      email: this.configService.get<string>('EMAIL_FROM', 'noreply@merygarcia.com'),
    };
    sendSmtpEmail.to = [{ email, name }];
    sendSmtpEmail.subject = 'Bienvenida - Tu contraseña temporal - Mery Garcia';
    sendSmtpEmail.htmlContent = this.getTemporaryPasswordEmailTemplate(name, email, temporaryPassword, loginUrl);

    try {
      await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      this.logger.log(`Temporary password email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send temporary password email to ${email}:`, error);
      throw error;
    }
  }

  async sendPasswordChangedNotification(
    email: string,
    name: string,
  ): Promise<void> {
    const loginUrl = `${this.configService.get<string>('FRONTEND_URL')}/es/login`;
    const supportUrl = `${this.configService.get<string>('FRONTEND_URL')}/es/contact`;

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.sender = {
      name: 'Mery Garcia - Cosmetic Tattoo',
      email: this.configService.get<string>('EMAIL_FROM', 'noreply@merygarcia.com'),
    };
    sendSmtpEmail.to = [{ email, name }];
    sendSmtpEmail.subject = 'Tu contraseña ha sido cambiada - Mery Garcia';
    sendSmtpEmail.htmlContent = this.getPasswordChangedEmailTemplate(name, loginUrl, supportUrl);

    try {
      await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      this.logger.log(`Password changed notification sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password changed notification to ${email}:`, error);
      throw error;
    }
  }

  private getVerificationEmailTemplate(name: string, verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifica tu correo</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Arial', sans-serif;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
          }
          .header {
            background-color: #000000;
            padding: 40px 20px;
            text-align: center;
          }
          .logo {
            color: #ffffff;
            font-size: 24px;
            font-weight: 300;
            letter-spacing: 8px;
            margin: 0;
          }
          .subtitle {
            color: #ffffff;
            font-size: 12px;
            letter-spacing: 3px;
            margin: 5px 0 0 0;
          }
          .content {
            padding: 40px 40px;
            color: #333333;
          }
          .greeting {
            font-size: 18px;
            color: #000000;
            margin-bottom: 20px;
          }
          .message {
            line-height: 1.6;
            color: #666666;
            margin-bottom: 30px;
          }
          .button-container {
            text-align: center;
            margin: 40px 0;
          }
          .button {
            display: inline-block;
            padding: 15px 40px;
            background-color: #ffb6c1;
            color: #ffffff;
            text-decoration: none;
            border-radius: 25px;
            font-size: 16px;
            letter-spacing: 1px;
          }
          .footer {
            background-color: #f9f9f9;
            padding: 30px 40px;
            text-align: center;
            color: #999999;
            font-size: 12px;
            line-height: 1.6;
          }
          .divider {
            height: 1px;
            background-color: #e0e0e0;
            margin: 30px 40px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="logo">MERY GARCIA</h1>
            <p class="subtitle">COSMETIC TATTOO</p>
          </div>
          
          <div class="content">
            <p class="greeting">Hola ${name || 'Usuario'},</p>
            
            <p class="message">
              ¡Bienvenida/o a Mery Garcia - Cosmetic Tattoo! Estamos emocionados de tenerte con nosotros.
              <br><br>
              Para completar tu registro y poder acceder a todos nuestros servicios, necesitamos que verifiques tu dirección de correo electrónico.
            </p>
            
            <div class="button-container">
              <a href="${verificationUrl}" class="button">VERIFICAR MI CORREO</a>
            </div>
            
            <p class="message">
              Este enlace expirará en 24 horas por razones de seguridad.
              <br><br>
              Si no creaste esta cuenta, puedes ignorar este mensaje.
            </p>
          </div>
          
          <div class="divider"></div>
          
          <div class="footer">
            <p>
              Si el botón no funciona, copia y pega este enlace en tu navegador:
              <br>
              <a href="${verificationUrl}" style="color: #ffb6c1;">${verificationUrl}</a>
            </p>
            <p style="margin-top: 20px;">
              © ${new Date().getFullYear()} Mery Garcia - Cosmetic Tattoo. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getPasswordResetEmailTemplate(name: string, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Restablece tu contraseña</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Arial', sans-serif;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
          }
          .header {
            background-color: #000000;
            padding: 40px 20px;
            text-align: center;
          }
          .logo {
            color: #ffffff;
            font-size: 24px;
            font-weight: 300;
            letter-spacing: 8px;
            margin: 0;
          }
          .subtitle {
            color: #ffffff;
            font-size: 12px;
            letter-spacing: 3px;
            margin: 5px 0 0 0;
          }
          .content {
            padding: 40px 40px;
            color: #333333;
          }
          .greeting {
            font-size: 18px;
            color: #000000;
            margin-bottom: 20px;
          }
          .message {
            line-height: 1.6;
            color: #666666;
            margin-bottom: 30px;
          }
          .button-container {
            text-align: center;
            margin: 40px 0;
          }
          .button {
            display: inline-block;
            padding: 15px 40px;
            background-color: #ffb6c1;
            color: #ffffff;
            text-decoration: none;
            border-radius: 25px;
            font-size: 16px;
            letter-spacing: 1px;
          }
          .footer {
            background-color: #f9f9f9;
            padding: 30px 40px;
            text-align: center;
            color: #999999;
            font-size: 12px;
            line-height: 1.6;
          }
          .divider {
            height: 1px;
            background-color: #e0e0e0;
            margin: 30px 40px;
          }
          .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            color: #856404;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="logo">MERY GARCIA</h1>
            <p class="subtitle">COSMETIC TATTOO</p>
          </div>
          
          <div class="content">
            <p class="greeting">Hola ${name || 'Usuario'},</p>
            
            <p class="message">
              Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.
              <br><br>
              Haz clic en el botón de abajo para crear una nueva contraseña:
            </p>
            
            <div class="button-container">
              <a href="${resetUrl}" class="button">RESTABLECER CONTRASEÑA</a>
            </div>
            
            <div class="warning">
              <strong>⚠️ Importante:</strong> Este enlace expirará en 1 hora por razones de seguridad.
            </div>
            
            <p class="message">
              Si no solicitaste restablecer tu contraseña, puedes ignorar este correo. Tu cuenta permanecerá segura.
            </p>
          </div>
          
          <div class="divider"></div>
          
          <div class="footer">
            <p>
              Si el botón no funciona, copia y pega este enlace en tu navegador:
              <br>
              <a href="${resetUrl}" style="color: #ffb6c1;">${resetUrl}</a>
            </p>
            <p style="margin-top: 20px;">
              © ${new Date().getFullYear()} Mery Garcia - Cosmetic Tattoo. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getTemporaryPasswordEmailTemplate(
    name: string,
    email: string,
    temporaryPassword: string,
    loginUrl: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tu contraseña temporal</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Arial', sans-serif;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
          }
          .header {
            background-color: #000000;
            padding: 40px 20px;
            text-align: center;
          }
          .logo {
            color: #ffffff;
            font-size: 24px;
            font-weight: 300;
            letter-spacing: 8px;
            margin: 0;
          }
          .subtitle {
            color: #ffffff;
            font-size: 12px;
            letter-spacing: 3px;
            margin: 5px 0 0 0;
          }
          .content {
            padding: 40px 40px;
            color: #333333;
          }
          .greeting {
            font-size: 18px;
            color: #000000;
            margin-bottom: 20px;
          }
          .message {
            line-height: 1.6;
            color: #666666;
            margin-bottom: 30px;
          }
          .credentials-box {
            background-color: #f9f9f9;
            border: 2px solid #ffb6c1;
            border-radius: 10px;
            padding: 25px;
            margin: 30px 0;
          }
          .credentials-label {
            font-weight: bold;
            color: #000000;
            margin-bottom: 5px;
          }
          .credentials-value {
            font-family: 'Courier New', monospace;
            font-size: 16px;
            color: #333333;
            background-color: #ffffff;
            padding: 10px 15px;
            border-radius: 5px;
            margin: 5px 0 15px 0;
            border: 1px solid #e0e0e0;
          }
          .button-container {
            text-align: center;
            margin: 40px 0;
          }
          .button {
            display: inline-block;
            padding: 15px 40px;
            background-color: #ffb6c1;
            color: #ffffff;
            text-decoration: none;
            border-radius: 25px;
            font-size: 16px;
            letter-spacing: 1px;
          }
          .footer {
            background-color: #f9f9f9;
            padding: 30px 40px;
            text-align: center;
            color: #999999;
            font-size: 12px;
            line-height: 1.6;
          }
          .divider {
            height: 1px;
            background-color: #e0e0e0;
            margin: 30px 40px;
          }
          .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            color: #856404;
            font-size: 14px;
          }
          .important-box {
            background-color: #ffe6f0;
            border-left: 4px solid #ffb6c1;
            padding: 15px;
            margin: 20px 0;
            color: #333333;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="logo">MERY GARCIA</h1>
            <p class="subtitle">COSMETIC TATTOO</p>
          </div>
          
          <div class="content">
            <p class="greeting">¡Bienvenida ${name || 'a nuestra plataforma'}!</p>
            
            <p class="message">
              Hemos migrado tu cuenta a nuestro nuevo sistema. A continuación encontrarás tus credenciales de acceso temporales:
            </p>
            
            <div class="credentials-box">
              <div class="credentials-label">📧 Email:</div>
              <div class="credentials-value">${email}</div>
              
              <div class="credentials-label">🔑 Contraseña temporal:</div>
              <div class="credentials-value">${temporaryPassword}</div>
            </div>
            
            <div class="important-box">
              <strong>💡 Importante:</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Esta es una contraseña temporal generada automáticamente</li>
                <li><strong>Te recomendamos cambiarla</strong> por una de tu preferencia después de iniciar sesión</li>
                <li>Tu cuenta ya está verificada y lista para usar</li>
              </ul>
            </div>
            
            <div class="button-container">
              <a href="${loginUrl}" class="button">INICIAR SESIÓN</a>
            </div>
            
            <div class="warning">
              <strong>🔒 Seguridad:</strong> No compartas esta contraseña con nadie. Si no solicitaste esta migración, contacta con soporte inmediatamente.
            </div>
          </div>
          
          <div class="divider"></div>
          
          <div class="footer">
            <p>
              Si el botón no funciona, copia y pega este enlace en tu navegador:
              <br>
              <a href="${loginUrl}" style="color: #ffb6c1;">${loginUrl}</a>
            </p>
            <p style="margin-top: 20px;">
              © ${new Date().getFullYear()} Mery Garcia - Cosmetic Tattoo. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getPasswordChangedEmailTemplate(
    name: string,
    loginUrl: string,
    supportUrl: string,
  ): string {
    const currentDate = new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Contraseña cambiada</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Arial', sans-serif;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
          }
          .header {
            background-color: #000000;
            padding: 40px 20px;
            text-align: center;
          }
          .logo {
            color: #ffffff;
            font-size: 24px;
            font-weight: 300;
            letter-spacing: 8px;
            margin: 0;
          }
          .subtitle {
            color: #ffffff;
            font-size: 12px;
            letter-spacing: 3px;
            margin: 5px 0 0 0;
          }
          .content {
            padding: 40px 40px;
            color: #333333;
          }
          .greeting {
            font-size: 18px;
            color: #000000;
            margin-bottom: 20px;
          }
          .message {
            line-height: 1.6;
            color: #666666;
            margin-bottom: 30px;
          }
          .success-box {
            background-color: #d4edda;
            border-left: 4px solid #28a745;
            padding: 20px;
            margin: 30px 0;
            border-radius: 5px;
          }
          .success-icon {
            font-size: 32px;
            text-align: center;
            margin-bottom: 10px;
          }
          .success-title {
            font-weight: bold;
            color: #155724;
            margin-bottom: 10px;
            text-align: center;
          }
          .success-message {
            color: #155724;
            text-align: center;
            font-size: 14px;
          }
          .info-box {
            background-color: #f9f9f9;
            border: 1px solid #e0e0e0;
            border-radius: 10px;
            padding: 20px;
            margin: 30px 0;
          }
          .info-label {
            font-weight: bold;
            color: #666666;
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 5px;
          }
          .info-value {
            color: #333333;
            font-size: 14px;
            margin-bottom: 15px;
          }
          .button-container {
            text-align: center;
            margin: 40px 0;
          }
          .button {
            display: inline-block;
            padding: 15px 40px;
            background-color: #ffb6c1;
            color: #ffffff;
            text-decoration: none;
            border-radius: 25px;
            font-size: 16px;
            letter-spacing: 1px;
          }
          .footer {
            background-color: #f9f9f9;
            padding: 30px 40px;
            text-align: center;
            color: #999999;
            font-size: 12px;
            line-height: 1.6;
          }
          .divider {
            height: 1px;
            background-color: #e0e0e0;
            margin: 30px 40px;
          }
          .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            color: #856404;
            font-size: 14px;
          }
          .security-tips {
            background-color: #e7f3ff;
            border-left: 4px solid #2196F3;
            padding: 15px;
            margin: 20px 0;
          }
          .security-tips ul {
            margin: 10px 0;
            padding-left: 20px;
          }
          .security-tips li {
            margin: 5px 0;
            color: #0d47a1;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="logo">MERY GARCIA</h1>
            <p class="subtitle">COSMETIC TATTOO</p>
          </div>
          
          <div class="content">
            <p class="greeting">Hola ${name || 'Usuario'},</p>
            
            <div class="success-box">
              <div class="success-icon">✅</div>
              <div class="success-title">Contraseña Cambiada Exitosamente</div>
              <div class="success-message">Tu contraseña ha sido actualizada correctamente</div>
            </div>
            
            <p class="message">
              Te informamos que la contraseña de tu cuenta ha sido cambiada exitosamente.
            </p>
            
            <div class="info-box">
              <div class="info-label">📅 Fecha y hora del cambio:</div>
              <div class="info-value">${currentDate}</div>
              
              <div class="info-label">📧 Cuenta afectada:</div>
              <div class="info-value">${name || 'Tu cuenta'}</div>
            </div>
            
            <p class="message">
              Si realizaste este cambio, puedes ignorar este mensaje. Tu cuenta está segura y puedes iniciar sesión con tu nueva contraseña.
            </p>
            
            <div class="button-container">
              <a href="${loginUrl}" class="button">INICIAR SESIÓN</a>
            </div>
            
            <div class="warning">
              <strong>⚠️ ¿No fuiste tú?</strong><br><br>
              Si NO realizaste este cambio, tu cuenta podría estar comprometida. Por favor:
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Cambia tu contraseña inmediatamente</li>
                <li>Contacta con nuestro equipo de soporte</li>
                <li>Revisa la actividad reciente en tu cuenta</li>
              </ul>
            </div>
            
            <div class="security-tips">
              <strong>🔒 Consejos de seguridad:</strong>
              <ul>
                <li>No compartas tu contraseña con nadie</li>
                <li>Usa una contraseña única y fuerte</li>
                <li>Actualiza tu contraseña regularmente</li>
                <li>Mantén tu cuenta segura</li>
              </ul>
            </div>
          </div>
          
          <div class="divider"></div>
          
          <div class="footer">
            <p>
              Si tienes alguna pregunta o necesitas ayuda, contáctanos:
              <br>
              <a href="${supportUrl}" style="color: #ffb6c1;">Centro de Soporte</a>
            </p>
            <p style="margin-top: 20px;">
              Este es un correo automático de seguridad. Si no solicitaste este cambio, por favor contacta con soporte inmediatamente.
            </p>
            <p style="margin-top: 20px;">
              © ${new Date().getFullYear()} Mery Garcia - Cosmetic Tattoo. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
