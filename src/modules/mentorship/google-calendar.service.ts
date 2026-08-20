import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { calendar as calendarApi, auth as googleAuth, calendar_v3 } from '@googleapis/calendar';

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
 * Google Calendar (+ Google Meet). Dos modos de autenticación:
 *
 * 1) OAuth (cuenta central con refresh token) — NO requiere ser admin de
 *    Workspace. La cuenta (ej. charly@pistech.net) organiza el evento e invita
 *    a cursos@ + el alumno. Recomendado si no hay domain-wide delegation.
 *    Env: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET,
 *         GOOGLE_OAUTH_REFRESH_TOKEN
 *
 * 2) Service account con domain-wide delegation (impersona una cuenta Workspace).
 *    Env: GOOGLE_SERVICE_ACCOUNT_JSON (o _PATH) + GOOGLE_CALENDAR_IMPERSONATE
 *
 * Común: GOOGLE_CALENDAR_ID (default 'primary' = calendario de la cuenta central).
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

  private get oauthCreds(): { id: string; secret: string; refresh: string } | null {
    const id = this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID');
    const secret = this.config.get<string>('GOOGLE_OAUTH_CLIENT_SECRET');
    const refresh = this.config.get<string>('GOOGLE_OAUTH_REFRESH_TOKEN');
    return id && secret && refresh ? { id, secret, refresh } : null;
  }

  get configured(): boolean {
    return !!(
      this.oauthCreds ||
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

    // 1) OAuth con cuenta central (refresh token) — no requiere admin de Workspace.
    const oauth = this.oauthCreds;
    if (oauth) {
      const client = new googleAuth.OAuth2(oauth.id, oauth.secret);
      client.setCredentials({ refresh_token: oauth.refresh });
      this.client = calendarApi({ version: 'v3', auth: client });
      return this.client;
    }

    // 2) Service account con domain-wide delegation.
    const creds = this.loadCredentials();
    if (creds) {
      const jwt = new googleAuth.JWT({
        email: creds.client_email,
        key: creds.private_key,
        scopes: SCOPES,
        subject: this.impersonate,
      });
      this.client = calendarApi({ version: 'v3', auth: jwt });
      return this.client;
    }

    this.logger.warn(
      'Google Calendar no configurado — las mentorías no crean evento',
    );
    return null;
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
