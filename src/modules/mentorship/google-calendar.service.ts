import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CalendarEventInput {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  attendeeEmails: string[];
}

export interface CalendarEventResult {
  eventId: string;
  meetLink: string | null;
}

/**
 * Integración con Google Calendar (+ Google Meet) sobre cursos@merygarcia.com.ar.
 *
 * FASE 2: implementación real con service account + domain-wide delegation.
 * Por ahora, si no hay credenciales configuradas, es un no-op que loguea y
 * deja la reserva funcionar igual (googleEventId/meetLink quedan null).
 *
 * Env esperadas (cuando se implemente):
 *   GOOGLE_SERVICE_ACCOUNT_JSON  (o _PATH) — clave del service account
 *   GOOGLE_CALENDAR_IMPERSONATE  — cursos@merygarcia.com.ar
 *   GOOGLE_CALENDAR_ID           — 'primary' o el id del calendario
 */
@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return !!(
      this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_JSON') ||
      this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_PATH')
    );
  }

  async createEvent(
    input: CalendarEventInput,
  ): Promise<CalendarEventResult | null> {
    if (!this.configured) {
      this.logger.warn(
        `Google Calendar no configurado — se omite el evento "${input.summary}"`,
      );
      return null;
    }
    // FASE 2: crear evento con conferenceData (Meet) e invitados.
    this.logger.log(`(pendiente) crear evento: ${input.summary}`);
    return null;
  }

  async updateEvent(
    eventId: string,
    input: CalendarEventInput,
  ): Promise<CalendarEventResult | null> {
    if (!this.configured || !eventId) return null;
    this.logger.log(`(pendiente) actualizar evento ${eventId}`);
    return null;
  }

  async deleteEvent(eventId: string): Promise<void> {
    if (!this.configured || !eventId) return;
    this.logger.log(`(pendiente) borrar evento ${eventId}`);
  }
}
