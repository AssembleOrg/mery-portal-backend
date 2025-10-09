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
}
