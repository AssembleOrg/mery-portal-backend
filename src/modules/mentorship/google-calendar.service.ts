import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { google, calendar_v3 } from 'googleapis';

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

const TZ = 'America/Argentina/Buenos_Aires';
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

/**
 * Google Calendar (+ Google Meet) sobre cursos@merygarcia.com.ar mediante un
 * service account con domain-wide delegation (siempre activo, sin OAuth).
 *
 * Env:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  — JSON de la clave del service account (string), o
 *   GOOGLE_SERVICE_ACCOUNT_PATH  — path al archivo JSON
 *   GOOGLE_CALENDAR_IMPERSONATE  — cuenta a impersonar (default cursos@merygarcia.com.ar)
 *   GOOGLE_CALENDAR_ID           — calendario destino (default 'primary')
 *
 * Si no hay credenciales, es un no-op: la reserva funciona igual (sin evento).
 * Ningún método lanza: ante error loguea y devuelve null para no romper el flujo.
 */
@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private client: calendar_v3.Calendar | null = null;
  private clientTried = false;

  constructor(private readonly config: ConfigService) {}

  private get impersonate(): string {
    return (
      this.config.get<string>('GOOGLE_CALENDAR_IMPERSONATE') ||
      'cursos@merygarcia.com.ar'
    );
  }

  private get calendarId(): string {
    return this.config.get<string>('GOOGLE_CALENDAR_ID') || 'primary';
  }

  get configured(): boolean {
    return !!(
      this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_JSON') ||
      this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_PATH')
    );
  }

  private loadCredentials(): { client_email: string; private_key: string } | null {
    try {
      const raw = this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_JSON');
      const path = this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_PATH');
      const json = raw
        ? raw
        : path
          ? fs.readFileSync(path, 'utf8')
          : null;
      if (!json) return null;
      const parsed = JSON.parse(json);
      if (!parsed.client_email || !parsed.private_key) return null;
      return {
        client_email: parsed.client_email,
        // Las claves suelen venir con \n escapados si se pasan por env.
        private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
      };
    } catch (err) {
      this.logger.error('No se pudo leer el service account', err as Error);
      return null;
    }
  }

  private getClient(): calendar_v3.Calendar | null {
    if (this.clientTried) return this.client;
    this.clientTried = true;
    const creds = this.loadCredentials();
    if (!creds) {
      this.logger.warn(
        'Google Calendar no configurado — las mentorías no crean evento',
      );
      return null;
    }
    const auth = new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: SCOPES,
      subject: this.impersonate, // domain-wide delegation
    });
    this.client = google.calendar({ version: 'v3', auth });
    return this.client;
  }

  private meetLinkOf(event: calendar_v3.Schema$Event | undefined): string | null {
    if (!event) return null;
    if (event.hangoutLink) return event.hangoutLink;
    const entry = event.conferenceData?.entryPoints?.find(
      (e) => e.entryPointType === 'video' && e.uri,
    );
    return entry?.uri ?? null;
  }

  async createEvent(
    input: CalendarEventInput,
  ): Promise<CalendarEventResult | null> {
    const cal = this.getClient();
    if (!cal) return null;
    try {
      const res = await cal.events.insert({
        calendarId: this.calendarId,
        conferenceDataVersion: 1,
        sendUpdates: 'all',
        requestBody: {
          summary: input.summary,
          description: input.description,
          start: { dateTime: input.start.toISOString(), timeZone: TZ },
          end: { dateTime: input.end.toISOString(), timeZone: TZ },
          attendees: input.attendeeEmails.map((email) => ({ email })),
          conferenceData: {
            createRequest: {
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        },
      });
      const event = res.data;
      if (!event.id) return null;
      return { eventId: event.id, meetLink: this.meetLinkOf(event) };
    } catch (err) {
      this.logger.error('Error creando evento en Google Calendar', err as Error);
      return null;
    }
  }

  async updateEvent(
    eventId: string,
    input: CalendarEventInput,
  ): Promise<CalendarEventResult | null> {
    const cal = this.getClient();
    if (!cal || !eventId) return null;
    try {
      const res = await cal.events.patch({
        calendarId: this.calendarId,
        eventId,
        sendUpdates: 'all',
        requestBody: {
          start: { dateTime: input.start.toISOString(), timeZone: TZ },
          end: { dateTime: input.end.toISOString(), timeZone: TZ },
        },
      });
      return { eventId, meetLink: this.meetLinkOf(res.data) };
    } catch (err) {
      this.logger.error(
        `Error actualizando evento ${eventId} en Google Calendar`,
        err as Error,
      );
      return null;
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    const cal = this.getClient();
    if (!cal || !eventId) return;
    try {
      await cal.events.delete({
        calendarId: this.calendarId,
        eventId,
        sendUpdates: 'all',
      });
    } catch (err) {
      this.logger.error(
        `Error borrando evento ${eventId} en Google Calendar`,
        err as Error,
      );
    }
  }
}
