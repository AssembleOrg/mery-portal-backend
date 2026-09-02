import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as SibApiV3Sdk from '@sendinblue/client';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../shared/services';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private apiInstance: SibApiV3Sdk.TransactionalEmailsApi;
  private campaignInProgress = false;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    this.apiInstance.setApiKey(
      SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
      this.configService.get<string>('BREVO_API_KEY', ''),
    );
  }

  /**
   * Devuelve una vista previa o ejecuta el envío de la campaña a clientes.
   * El límite está acotado para que un error de configuración no genere un
   * envío masivo accidental. El envío es secuencial para respetar la API de
   * Brevo y poder informar destinatarios exitosos y fallidos.
   */
  async sendFormacionesCampaignToClients(params: {
    limit: number;
    confirm: boolean;
    requestedBy: string;
    recipients?: Array<{ email: string; name: string }>;
  }): Promise<{
    dryRun: boolean;
    requestedBy: string;
    total: number;
    recipients: Array<{ id: string; email: string; name: string }>;
    sent: number;
    failed: Array<{ email: string; error: string }>;
  }> {
    const recipients = params.recipients
      ? Array.from(
          params.recipients
            .map((recipient, index) => {
              const normalized = {
                id: `csv-${index}-${recipient.email}`,
                email: recipient.email.trim().toLowerCase(),
                name: recipient.name.trim() || 'Hola',
              };
              return [normalized.email, normalized] as const;
            })
            .filter(([email]) => email),
        ).values(),
        ).slice(0, 150)
      : (
          await this.prisma.user.findMany({
            where: {
              role: UserRole.USER,
              isActive: true,
              isEmailVerified: true,
              deletedAt: null,
            },
            orderBy: { createdAt: 'asc' },
            take: Math.min(params.limit, 150),
            select: { id: true, email: true, firstName: true, lastName: true },
          })
        ).map((client) => ({
          id: client.id,
          email: client.email,
          name: [client.firstName, client.lastName].filter(Boolean).join(' ') || 'Hola',
        }));

    if (!params.confirm) {
      return {
        dryRun: true,
        requestedBy: params.requestedBy,
        total: recipients.length,
        recipients,
        sent: 0,
        failed: [],
      };
    }

    if (this.campaignInProgress) {
      throw new ConflictException('Ya hay una campaña en proceso de envío');
    }

    this.campaignInProgress = true;
    let sent = 0;
    const failed: Array<{ email: string; error: string }> = [];

    try {
      for (const recipient of recipients) {
        try {
          await this.sendFormacionesCampaignEmail(recipient.email, recipient.name);
          sent += 1;
        } catch (error) {
          failed.push({
            email: recipient.email,
            error: error instanceof Error ? error.message : 'Error desconocido',
          });
        }
      }

      this.logger.log(
        `Formaciones campaign requested by ${params.requestedBy}: ${sent}/${recipients.length} sent`,
      );

      return {
        dryRun: false,
        requestedBy: params.requestedBy,
        total: recipients.length,
        recipients,
        sent,
        failed,
      };
    } finally {
      this.campaignInProgress = false;
    }
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
      email: this.configService.get<string>(
        'EMAIL_FROM',
        'noreply@merygarcia.com',
      ),
    };
    sendSmtpEmail.to = [{ email, name }];
    sendSmtpEmail.subject = 'Verifica tu correo electrónico - Mery Garcia';
    sendSmtpEmail.htmlContent = this.getVerificationEmailTemplate(
      name,
      verificationUrl,
    );

    try {
      await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      this.logger.log(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${email}:`,
        error,
      );
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
      email: this.configService.get<string>(
        'EMAIL_FROM',
        'noreply@merygarcia.com',
      ),
    };
    sendSmtpEmail.to = [{ email, name }];
    sendSmtpEmail.subject = 'Restablece tu contraseña - Mery Garcia';
    sendSmtpEmail.htmlContent = this.getPasswordResetEmailTemplate(
      name,
      resetUrl,
    );

    try {
      await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}:`,
        error,
      );
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
      email: this.configService.get<string>(
        'EMAIL_FROM',
        'noreply@merygarcia.com',
      ),
    };
    sendSmtpEmail.to = [{ email, name }];
    sendSmtpEmail.subject = 'Bienvenida - Tu contraseña temporal - Mery Garcia';
    sendSmtpEmail.htmlContent = this.getTemporaryPasswordEmailTemplate(
      name,
      email,
      temporaryPassword,
      loginUrl,
    );

    try {
      await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      this.logger.log(`Temporary password email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send temporary password email to ${email}:`,
        error,
      );
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
      email: this.configService.get<string>(
        'EMAIL_FROM',
        'noreply@merygarcia.com',
      ),
    };
    sendSmtpEmail.to = [{ email, name }];
    sendSmtpEmail.subject = 'Tu contraseña ha sido cambiada - Mery Garcia';
    sendSmtpEmail.htmlContent = this.getPasswordChangedEmailTemplate(
      name,
      loginUrl,
      supportUrl,
    );

    try {
      await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      this.logger.log(`Password changed notification sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password changed notification to ${email}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Confirmación + invitación formal a un evento (ej: Master Class de Autostyling).
   * Se dispara cuando un admin acepta una respuesta de formulario.
   */
  async sendEventInvitationEmail(
    email: string,
    name: string,
    opts: {
      eventTitle: string;
      horario?: string | null;
      eventDetails?: string | null;
    },
  ): Promise<void> {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.sender = {
      name: 'Mery Garcia - Autostyling',
      email: this.configService.get<string>(
        'EMAIL_FROM',
        'noreply@merygarcia.com',
      ),
    };
    sendSmtpEmail.to = [{ email, name }];
    sendSmtpEmail.subject = `Es oficial: tu lugar en ${opts.eventTitle} está reservado`;
    sendSmtpEmail.htmlContent = this.getEventInvitationTemplate(name, opts);

    try {
      await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      this.logger.log(`Event invitation email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send event invitation email to ${email}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Campaña de marketing #FormacionesMG (40% OFF + técnica de Refill).
   * Un destinatario por llamada (Brevo transactional). Para la prueba de
   * aprobación se envía a un solo mail; el broadcast a la lista de clientas
   * es una segunda etapa (requiere opt-in/unsubscribe).
   */
  async sendFormacionesCampaignEmail(
    email: string,
    name: string,
  ): Promise<void> {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.sender = {
      name: 'Mery Garcia - Cosmetic Tattoo',
      email: this.configService.get<string>(
        'EMAIL_FROM',
        'noreply@merygarcia.com',
      ),
    };
    sendSmtpEmail.to = [{ email, name }];
    sendSmtpEmail.subject =
      'LAST CALL 🔥 #MGCELEBRATION 💣 40% OFF + Formaciones 100% renovadas 🚀';
    sendSmtpEmail.htmlContent = this.getFormacionesCampaignTemplate(name);

    try {
      await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      this.logger.log(`Formaciones campaign email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send formaciones campaign email to ${email}:`,
        error,
      );
      throw error;
    }
  }

  private static readonly LOGO_URL =
    'https://mery-garcia.nyc3.cdn.digitaloceanspaces.com/merygarcia_brow_artist_gris_transparente_centrado_clean.png';

  // Imágenes de la campaña, alojadas en el CDN. Se distribuyen a lo largo del mail.
  private static readonly CAMPAIGN_IMAGES: ReadonlyArray<string> = [
    'https://mery-garcia.nyc3.cdn.digitaloceanspaces.com/home-1.webp',
    'https://mery-garcia.nyc3.cdn.digitaloceanspaces.com/home-8.webp',
    'https://mery-garcia.nyc3.cdn.digitaloceanspaces.com/WhatsApp%20Image%202026-09-01%20at%203.54.05%20PM.jpeg',
    'https://mery-garcia.nyc3.cdn.digitaloceanspaces.com/WhatsApp%20Image%202026-09-01%20at%203.54.04%20PM.jpeg',
    'https://mery-garcia.nyc3.cdn.digitaloceanspaces.com/WhatsApp%20Image%202026-09-01%20at%203.59.20%20PM.jpeg',
    'https://mery-garcia.nyc3.cdn.digitaloceanspaces.com/WhatsApp%20Image%202026-09-01%20at%203.59.19%20PM.jpeg',
  ];

  // Programas (PDF) de cada formación, alojados en el CDN. Se listan como links.
  private static readonly CAMPAIGN_PDFS: ReadonlyArray<{
    label: string;
    url: string;
  }> = [
    {
      label: 'Estilismo de Cejas',
      url: 'https://mery-garcia.nyc3.cdn.digitaloceanspaces.com/pdf-formaciones/Estilismo%20CON%20precios%20(Mayo%202026).pdf',
    },
    {
      label: 'Microblading',
      url: 'https://mery-garcia.nyc3.cdn.digitaloceanspaces.com/pdf-formaciones/Microblading%20CON%20precios%20(Mayo%202026).pdf.pdf',
    },
    {
      label: 'Nanoblading',
      url: 'https://mery-garcia.nyc3.cdn.digitaloceanspaces.com/pdf-formaciones/Programa%20Nanoblading%20con%20precios%20(Mayo%202026)-2.pdf',
    },
    {
      label: 'Lipblush',
      url: 'https://mery-garcia.nyc3.cdn.digitaloceanspaces.com/pdf-formaciones/Programa%20Lipblush%20(mayo%202026).pdf',
    },
    {
      label: 'Información de cursada',
      url: 'https://mery-garcia.nyc3.cdn.digitaloceanspaces.com/pdf-formaciones/Informacio%CC%81n%20de%20cursada%20sin%20valores%20(Mayo%202026).pdf',
    },
  ];

  /** Dirección completa del local para que el pin de Maps caiga exacto. */
  private static readonly VENUE_FULL_ADDRESS =
    'Av. Cabildo 1985, C1428AAB Cdad. Autónoma de Buenos Aires';

  private mapsUrl(address: string): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Renderiza el bloque de detalles (eventDetails multilínea).
   * Detecta la línea de dirección (prefijo 📍) y la vuelve clickeable a Google Maps
   * con un enlace "Cómo llegar →". El resto de líneas se muestran como texto.
   */
  private renderEventDetails(eventDetails: string): string {
    const lines = eventDetails
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const parts = lines.map((line) => {
      const isAddress = line.startsWith('📍');
      if (!isAddress) {
        return `<div style="color:#3a2c2e; font-size:15px; line-height:1.9;">${this.escapeHtml(line)}</div>`;
      }

      // Texto de la dirección sin el emoji/prefijo.
      let address = line.replace(/^📍\s*/, '').trim();
      // Normalizamos a la dirección completa cuando es el local de la masterclass,
      // para que el pin de Maps sea preciso.
      if (/cabildo\s*1985/i.test(address)) {
        address = EmailService.VENUE_FULL_ADDRESS;
      }

      return `
                          <div style="color:#3a2c2e; font-size:15px; line-height:1.9;">📍 ${this.escapeHtml(address)}</div>
                          <a href="${this.mapsUrl(address)}" target="_blank" style="display:inline-block; margin-top:6px; color:#4a1220; font-size:12px; letter-spacing:1.5px; text-transform:uppercase; text-decoration:none; font-family:'Helvetica Neue', Arial, sans-serif; border-bottom:1px solid #d8bcc1; padding-bottom:2px;">Cómo llegar &rarr;</a>`;
    });

    return parts.join('');
  }

  private getEventInvitationTemplate(
    name: string,
    opts: {
      eventTitle: string;
      horario?: string | null;
      eventDetails?: string | null;
    },
  ): string {
    const rows: string[] = [];

    if (opts.horario) {
      rows.push(`
                      <tr>
                        <td style="padding:14px 0; border-bottom:1px solid #efe2e4;">
                          <div style="color:#a98a8f; font-size:11px; letter-spacing:2.5px; text-transform:uppercase; margin-bottom:6px; font-family:'Helvetica Neue', Arial, sans-serif;">Horario</div>
                          <div style="color:#4a1220; font-size:19px; font-weight:500; letter-spacing:0.3px;">${opts.horario}</div>
                        </td>
                      </tr>`);
    }

    if (opts.eventDetails) {
      rows.push(`
                      <tr>
                        <td style="padding:14px 0;">
                          <div style="color:#a98a8f; font-size:11px; letter-spacing:2.5px; text-transform:uppercase; margin-bottom:6px; font-family:'Helvetica Neue', Arial, sans-serif;">Detalles</div>
                          ${this.renderEventDetails(opts.eventDetails)}
                        </td>
                      </tr>`);
    }

    const detailsCard = rows.length
      ? `
                <tr>
                  <td style="padding:8px 56px 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eadfe1; border-bottom:1px solid #eadfe1;">
                      ${rows.join('')}
                    </table>
                  </td>
                </tr>`
      : '';

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${opts.eventTitle}</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f4ecec; font-family:Georgia, 'Times New Roman', serif;">
        <!-- Preheader (hidden) -->
        <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:#f4ecec;">Tu lugar está reservado. Lo que sigue lo preparamos con muchísimo cuidado para vos.</div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4ecec; padding:40px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff;">

                <!-- Logo -->
                <tr>
                  <td style="padding:48px 40px 0; text-align:center;">
                    <img src="${EmailService.LOGO_URL}" width="150" alt="Mery García" style="display:block; margin:0 auto; width:150px; max-width:60%; height:auto; border:0;">
                  </td>
                </tr>

                <!-- Hero -->
                <tr>
                  <td style="padding:40px 48px 0; text-align:center;">
                    <div style="color:#a98a8f; font-size:11px; letter-spacing:4px; text-transform:uppercase; font-family:'Helvetica Neue', Arial, sans-serif; margin-bottom:18px;">Reserva confirmada</div>
                    <h1 style="margin:0; color:#4a1220; font-size:34px; line-height:1.25; font-weight:normal; font-family:Georgia, serif;">Tu lugar<br>está reservado</h1>
                  </td>
                </tr>

                <!-- Body copy -->
                <tr>
                  <td style="padding:30px 56px 0;">
                    <p style="margin:0 0 20px; color:#3a2c2e; font-size:16px; line-height:1.8; font-family:Georgia, serif;">
                      ${name || 'Hola'}, es un placer confirmártelo: ¡Tu lugar ya está reservado!
                    </p>
                    <p style="margin:0 0 20px; color:#5a4a4d; font-size:16px; line-height:1.8; font-family:Georgia, serif;">
                      A partir de ahora, todo lo que sigue lo estamos preparando con muchísimo cuidado para que sea una experiencia a tu altura.
                    </p>
                    <p style="margin:0; color:#5a4a4d; font-size:16px; line-height:1.8; font-family:Georgia, serif;">
                      Guardá esta fecha. ¡Te esperamos!
                    </p>
                  </td>
                </tr>

                ${detailsCard}

                <!-- Closing -->
                <tr>
                  <td style="padding:34px 56px 0;">
                    <p style="margin:0 0 24px; color:#5a4a4d; font-size:15px; line-height:1.8; font-family:Georgia, serif;">
                      Te pedimos llegar unos minutos antes para acreditarte con calma. Si necesitás contarnos algo, respondé este mismo correo y te acompañamos.
                    </p>
                    <p style="margin:0; color:#3a2c2e; font-size:16px; line-height:1.8; font-family:Georgia, serif;">
                      Nos vemos muy pronto,<br>
                      <span style="color:#4a1220; font-style:italic;">Mery García &amp; equipo</span>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:56px 40px 48px; text-align:center;">
                    <p style="margin:0; color:#c0a9ad; font-size:11px; line-height:1.8; font-family:'Helvetica Neue', Arial, sans-serif; letter-spacing:0.3px;">
                      Recibís este correo porque completaste el formulario de reserva.<br>
                      © ${new Date().getFullYear()} Mery García · Todos los derechos reservados.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getVerificationEmailTemplate(
    name: string,
    verificationUrl: string,
  ): string {
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

  private getPasswordResetEmailTemplate(
    name: string,
    resetUrl: string,
  ): string {
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

  /**
   * Bloque de imagen para la campaña. Si la URL está vacía (foto aún no
   * subida), renderiza un placeholder rotulado en vez de un <img> roto, para
   * que el borrador se pueda revisar antes de tener las fotos definitivas.
   */
  /**
   * Par de imágenes lado a lado (email-safe con tabla). Si se pasa fixedHeight,
   * ambas se recortan (object-fit: cover) a esa altura para que queden parejas
   * aunque tengan proporciones distintas.
   */
  private imagePair(urlA: string, urlB: string, fixedHeight?: number): string {
    const imgStyle = fixedHeight
      ? `display:block; width:100%; max-width:235px; height:${fixedHeight}px; object-fit:cover; border-radius:10px; border:0;`
      : `display:block; width:100%; max-width:235px; height:auto; border-radius:10px; border:0;`;
    const cell = (url: string) => `
        <td width="50%" valign="top" style="padding:0 5px;">
          <img src="${url}" alt="Mery García" width="235"${fixedHeight ? ` height="${fixedHeight}"` : ''} style="${imgStyle}">
        </td>`;
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>${cell(urlA)}${cell(urlB)}</tr>
      </table>`;
  }

  /** Lista de programas (PDF) como filas de link con ícono. */
  private pdfList(): string {
    const rows = EmailService.CAMPAIGN_PDFS.map(
      (pdf) => `
        <tr>
          <td style="padding:0;">
            <a href="${pdf.url}" target="_blank" style="display:block; padding:16px 20px; margin-bottom:10px; background-color:#4a4a4a; border:1px solid rgba(255,255,255,0.2); border-radius:8px; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none; font-family:'Helvetica Neue', Arial, sans-serif;">
              📄&nbsp;&nbsp;${this.escapeHtml(pdf.label)}
              <span style="float:right; color:#f9bbc4; font-weight:400;">Ver programa &rarr;</span>
            </a>
          </td>
        </tr>`,
    ).join('');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
  }

  private getFormacionesCampaignTemplate(name: string): string {
    const formacionesUrl = 'https://merygarcia.com.ar';

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>#MGCELEBRATION · 40% OFF</title>
      </head>
      <body style="margin:0; padding:0; background-color:#3a3a3a; font-family:'Helvetica Neue', Arial, sans-serif;">
        <!-- Preheader (hidden) -->
        <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:#3a3a3a;">Nuestras Formaciones se renovaron: 2 módulos, meetings en vivo y la técnica de Refill. Y por tiempo limitado, 40% OFF.</div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#3a3a3a; padding:40px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#545454; border:1px solid rgba(255,255,255,0.35);">

                <!-- Logo -->
                <tr>
                  <td style="padding:48px 40px 0; text-align:center;">
                    <img src="https://mery-garcia.nyc3.cdn.digitaloceanspaces.com/mery-blanco-logo.png" width="150" alt="Mery García" style="display:block; margin:0 auto; width:150px; max-width:60%; height:auto; border:0;">
                  </td>
                </tr>

                <!-- Hero -->
                <tr>
                  <td style="padding:36px 48px 0; text-align:center;">
                    <div style="color:#f9bbc4; font-size:11px; letter-spacing:4px; text-transform:uppercase; margin-bottom:16px;">#FormacionesMG</div>
                    <div style="color:#ffffff; font-size:64px; line-height:1; font-weight:800; letter-spacing:-1px;">40% OFF</div>
                    <div style="color:#ffffff; font-size:18px; margin-top:10px;">en todas las formaciones</div>
                    <div style="display:inline-block; margin-top:18px; background-color:#f9bbc4; color:#2b2b2b; font-size:12px; letter-spacing:1.5px; text-transform:uppercase; padding:8px 16px; border-radius:20px; font-weight:700;">Tiempo limitado Del 1 al 5 de Septiembre</div>
                  </td>
                </tr>

                <!-- CTA principal -->
                <tr>
                  <td style="padding:28px 48px 0; text-align:center;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                      <tr>
                        <td align="center" style="background-color:#f9bbc4; border-radius:6px;">
                          <a href="${formacionesUrl}" target="_blank" style="display:inline-block; padding:15px 44px; color:#2b2b2b; font-size:15px; letter-spacing:1px; text-transform:uppercase; text-decoration:none; font-weight:700;">Ver formaciones</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Imágenes 1-2 -->
                <tr>
                  <td style="padding:36px 51px 0;">
                    ${this.imagePair(EmailService.CAMPAIGN_IMAGES[0], EmailService.CAMPAIGN_IMAGES[1], 280)}
                  </td>
                </tr>

                <!-- Bullets (texto exacto mail1) -->
                <tr>
                  <td style="padding:30px 56px 0; color:#ffffff; font-size:15px; line-height:1.75;">
                    <p style="margin:0 0 16px;">Nuestra carrera cuenta con 2 módulos: <strong>Estilismo de Cejas</strong>: Mód. I y <strong>Microblading</strong>: Mód. II (los mismos son correlativos).</p>
                    <p style="margin:0 0 16px;">Cada Formación incluye el acceso a <strong>2 Meetings Online</strong>, que conforman nuestro cronograma de cursada, en las que podrás ver servicios en vivo, presentar tus prácticas y resolver todas tus dudas con nuestra #BrowBoss Mery García 🔥</p>
                    <p style="margin:0;">Además, nos complace anunciar que la técnica de <strong>Refill</strong> estará disponible para que puedan acceder y perfeccionarse todas nuestras colegas ESTILISTAS DE CEJAS tanto en nuestras Formaciones como fuera del programa principal, con la exclusiva técnica creada por nuestra #BrowBoss Mery García 💣</p>
                  </td>
                </tr>

                <!-- Puente (copy #MGCELEBRATION) -->
                <tr>
                  <td style="padding:30px 56px 0; text-align:center;">
                    <p style="margin:0 0 20px; color:#f9bbc4; font-size:19px; line-height:1.5; font-weight:700;">¿Lista para sumarte a nuestro Universo? 🚀</p>
                    <p style="margin:0 0 20px; color:#ffffff; font-size:17px; line-height:1.55; font-weight:700;"><span style="display:inline-block; background-color:#f9bbc4; color:#2b2b2b; font-size:15px; letter-spacing:0.5px; padding:4px 12px; border-radius:4px;">Del 1/9 al 5/9</span><br><span style="display:inline-block; margin-top:10px;">TODAS nuestras formaciones tienen <strong>40% OFF</strong> y <strong>2 cuotas sin interés</strong></span></p>
                    <p style="margin:0 0 16px; color:#e6e6e6; font-size:15px; line-height:1.75;">para seguir creciendo y llevando tu trabajo a otro nivel.</p>
                    <p style="margin:0 0 16px; color:#e6e6e6; font-size:15px; line-height:1.75;"><strong style="color:#ffffff;">GREAT NEWS!</strong> Las formaciones incluyen una <strong style="color:#ffffff;">Mentoria personalizada online free (1 hora) con nuestros Brow Boss</strong> por cada curso, exámenes teóricos para fijar conceptos y un chat de consulta con MG (por tiempo limitado).</p>
                    <p style="margin:0 0 16px; color:#e6e6e6; font-size:15px; line-height:1.75;">En los siguientes enlaces podrás conocer nuestra propuesta pedagógica, contenidos de cada formación y valores de mentorías adicionales y espacios de presencialidad ONE TO ONE 🔥</p>
                    <p style="margin:0; color:#f9bbc4; font-size:15px; line-height:1.6; font-weight:600;">Conocé todas nuestras propuestas para seguir llenando la Galaxia de cejas #ByMeryGarcia ✨</p>
                  </td>
                </tr>

                <!-- Imágenes 3-4 -->
                <tr>
                  <td style="padding:30px 51px 0;">
                    ${this.imagePair(EmailService.CAMPAIGN_IMAGES[2], EmailService.CAMPAIGN_IMAGES[3])}
                  </td>
                </tr>

                <!-- Detalle Refill (texto exacto mail3) -->
                <tr>
                  <td style="padding:30px 56px 0; color:#ffffff; font-size:15px; line-height:1.75;">
                    <p style="margin:0 0 16px;">Quienes hayan cursado/comprado #FormacionesMG a partir del 01/07/2023 en adelante, tendrán acceso directo a los contenidos actualizados (no es necesario volver a comprar), CON LA TÉCNICA DE REFILL INCLUIDA (SIN CARGO) 🔥</p>
                    <p style="margin:0;">También, quienes cuenten con experiencia previa en Estilismo de Cejas (profesiones de cejas y maquilladoras) PUEDEN ADQUIRIR SOLO LA TÉCNICA DE REFILL (Práctica de diseño, paso a paso y video de teoría) ✨</p>
                  </td>
                </tr>

                <!-- Imágenes 5-6 -->
                <tr>
                  <td style="padding:30px 51px 0;">
                    ${this.imagePair(EmailService.CAMPAIGN_IMAGES[4], EmailService.CAMPAIGN_IMAGES[5], 280)}
                  </td>
                </tr>

                <!-- Asesora académica -->
                <tr>
                  <td style="padding:44px 56px 0; text-align:center;">
                    <p style="margin:0; color:#f9bbc4; font-size:15px; font-weight:700; line-height:1.6;">Para más detalles, podés contactarte con una asesora académica ❤️</p>
                  </td>
                </tr>

                <!-- CTA final JOIN US -->
                <tr>
                  <td style="padding:36px 56px 0; text-align:center;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                      <tr>
                        <td align="center" style="background-color:#f9bbc4; border-radius:6px;">
                          <a href="${formacionesUrl}" target="_blank" style="display:inline-block; padding:18px 56px; color:#2b2b2b; font-size:24px; letter-spacing:2px; text-transform:uppercase; text-decoration:none; font-weight:800;">JOIN US!</a>
                        </td>
                      </tr>
                    </table>
                    <div style="margin-top:18px;">
                      <a href="${formacionesUrl}" target="_blank" style="color:#f9bbc4; font-size:13px; text-decoration:none; border-bottom:1px solid rgba(249,187,196,0.5); padding-bottom:2px;">+ Información en nuestra web 🙎</a>
                    </div>
                  </td>
                </tr>

                <!-- Programas (PDF) -->
                <tr>
                  <td style="padding:44px 56px 8px;">
                    <div style="color:#f9bbc4; font-size:11px; letter-spacing:2.5px; text-transform:uppercase; text-align:center; margin-bottom:20px; font-family:'Helvetica Neue', Arial, sans-serif;">Descargá los programas</div>
                    ${this.pdfList()}
                  </td>
                </tr>

                <!-- Cierre -->
                <tr>
                  <td style="padding:52px 40px 52px; text-align:center; background-color:#2b2b2b;">
                    <div style="color:#ffffff; font-size:26px; line-height:1.3; font-weight:700; font-family:Georgia, serif;">WE CAN'T WAIT<br>TO SEE YOU ⚡</div>
                    <p style="margin:28px 0 0; color:#a8a8a8; font-size:11px; line-height:1.8; letter-spacing:0.3px;">
                      © ${new Date().getFullYear()} Mery García · Todos los derechos reservados.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }
}
