import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MentorshipStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/services';
import { GoogleCalendarService } from './google-calendar.service';
import {
  BookMentorshipDto,
  CreateAvailabilityDto,
  UpdateAvailabilityDto,
} from './dto';

const TZ = 'America/Argentina/Buenos_Aires';
const AR_OFFSET = '-03:00';
/** Anticipación mínima para reservar (3 días = hasta el viernes previo a un lunes). */
const BOOKING_CUTOFF_DAYS = 3;
/** Anticipación mínima para reprogramar o cancelar. */
const CHANGE_MIN_HOURS = 72;
/** Cuántas semanas hacia adelante se generan horarios. */
const HORIZON_DAYS = 8 * 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface Slot {
  start: Date;
  end: Date;
}

@Injectable()
export class MentorshipService {
  private readonly logger = new Logger(MentorshipService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: GoogleCalendarService,
  ) {}

  // ---------------------------------------------------------------------------
  // Helpers de fecha (zona horaria Argentina, sin DST)
  // ---------------------------------------------------------------------------

  private arDateStr(d: Date): string {
    // YYYY-MM-DD en hora Argentina.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }

  private addDays(dateStr: string, n: number): string {
    const base = new Date(`${dateStr}T12:00:00Z`);
    base.setUTCDate(base.getUTCDate() + n);
    return base.toISOString().slice(0, 10);
  }

  private weekdayOf(dateStr: string): number {
    return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  }

  private slotDate(dateStr: string, minutes: number): Date {
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    return new Date(`${dateStr}T${hh}:${mm}:00${AR_OFFSET}`);
  }

  // ---------------------------------------------------------------------------
  // Disponibilidad (CRUD admin)
  // ---------------------------------------------------------------------------

  listAvailability() {
    return this.prisma.mentorshipAvailability.findMany({
      orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }],
    });
  }

  async createAvailability(dto: CreateAvailabilityDto) {
    if (dto.endMin <= dto.startMin) {
      throw new BadRequestException('El fin debe ser posterior al inicio');
    }
    return this.prisma.mentorshipAvailability.create({
      data: {
        weekday: dto.weekday,
        startMin: dto.startMin,
        endMin: dto.endMin,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateAvailability(id: string, dto: UpdateAvailabilityDto) {
    await this.getAvailabilityOrFail(id);
    return this.prisma.mentorshipAvailability.update({
      where: { id },
      data: {
        ...(dto.weekday !== undefined ? { weekday: dto.weekday } : {}),
        ...(dto.startMin !== undefined ? { startMin: dto.startMin } : {}),
        ...(dto.endMin !== undefined ? { endMin: dto.endMin } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async removeAvailability(id: string) {
    await this.getAvailabilityOrFail(id);
    await this.prisma.mentorshipAvailability.delete({ where: { id } });
    return { deleted: true };
  }

  private async getAvailabilityOrFail(id: string) {
    const found = await this.prisma.mentorshipAvailability.findUnique({
      where: { id },
    });
    if (!found) throw new NotFoundException('Disponibilidad no encontrada');
    return found;
  }

  // ---------------------------------------------------------------------------
  // Generación de horarios disponibles
  // ---------------------------------------------------------------------------

  /** Genera todos los horarios futuros según las plantillas activas. */
  private async generateSlots(): Promise<Slot[]> {
    const templates = await this.prisma.mentorshipAvailability.findMany({
      where: { isActive: true },
    });
    if (templates.length === 0) return [];

    const today = this.arDateStr(new Date());
    const slots: Slot[] = [];
    for (let i = 0; i <= HORIZON_DAYS; i++) {
      const dateStr = this.addDays(today, i);
      const wd = this.weekdayOf(dateStr);
      for (const t of templates) {
        if (t.weekday !== wd) continue;
        slots.push({
          start: this.slotDate(dateStr, t.startMin),
          end: this.slotDate(dateStr, t.endMin),
        });
      }
    }
    return slots;
  }

  /** true si el horario respeta la anticipación mínima (3 días) y es futuro. */
  private passesCutoff(start: Date, now: Date): boolean {
    return start.getTime() - now.getTime() >= BOOKING_CUTOFF_DAYS * DAY_MS;
  }

  /**
   * Horarios disponibles: futuros, dentro de la anticipación y sin reserva
   * vigente. Devuelve la lista con el flag `available` para reflejar los ocupados.
   */
  async availableSlots(): Promise<
    Array<{ start: string; end: string; available: boolean }>
  > {
    const now = new Date();
    const slots = (await this.generateSlots()).filter((s) =>
      this.passesCutoff(s.start, now),
    );
    if (slots.length === 0) return [];

    const booked = await this.prisma.mentorship.findMany({
      where: {
        status: MentorshipStatus.SCHEDULED,
        scheduledStart: { in: slots.map((s) => s.start) },
      },
      select: { scheduledStart: true },
    });
    const bookedSet = new Set(booked.map((b) => b.scheduledStart.getTime()));

    return slots.map((s) => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      available: !bookedSet.has(s.start.getTime()),
    }));
  }

  // ---------------------------------------------------------------------------
  // Elegibilidad
  // ---------------------------------------------------------------------------

  private async examPassed(userId: string, categoryId: string): Promise<boolean> {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: { userId, categoryId, passed: true },
      select: { id: true },
    });
    return attempt !== null;
  }

  private async activePurchase(userId: string, categoryId: string) {
    return this.prisma.categoryPurchase.findUnique({
      where: { userId_categoryId: { userId, categoryId } },
    });
  }

  /** Mentoría vigente (agendada o cumplida) del alumno para ese curso. */
  private async currentMentorship(userId: string, categoryId: string) {
    return this.prisma.mentorship.findFirst({
      where: {
        userId,
        categoryId,
        status: { in: [MentorshipStatus.SCHEDULED, MentorshipStatus.COMPLETED] },
      },
    });
  }

  async getEligibility(userId: string, categoryId: string) {
    const [purchase, examOk, current] = await Promise.all([
      this.activePurchase(userId, categoryId),
      this.examPassed(userId, categoryId),
      this.currentMentorship(userId, categoryId),
    ]);
    const purchased = !!purchase && purchase.isActive;
    return {
      purchased,
      examPassed: examOk,
      alreadyBooked: !!current,
      mentorship: current ? this.serialize(current) : null,
      canBook: purchased && examOk && !current,
    };
  }

  // ---------------------------------------------------------------------------
  // Reserva / reprogramación / cancelación
  // ---------------------------------------------------------------------------

  private async findMatchingSlot(startIso: string): Promise<Slot> {
    const startMs = new Date(startIso).getTime();
    const slots = await this.generateSlots();
    const match = slots.find((s) => s.start.getTime() === startMs);
    if (!match) {
      throw new BadRequestException('El horario elegido no es válido');
    }
    if (!this.passesCutoff(match.start, new Date())) {
      throw new BadRequestException(
        'Ese horario ya no se puede reservar (hay que hacerlo con al menos 3 días de anticipación)',
      );
    }
    return match;
  }

  async book(userId: string, dto: BookMentorshipDto) {
    const { categoryId } = dto;
    const [purchase, examOk] = await Promise.all([
      this.activePurchase(userId, categoryId),
      this.examPassed(userId, categoryId),
    ]);
    if (!purchase || !purchase.isActive) {
      throw new ForbiddenException('No tenés una compra activa de este curso');
    }
    if (!examOk) {
      throw new ForbiddenException(
        'Primero tenés que aprobar el examen final del curso',
      );
    }

    const slot = await this.findMatchingSlot(dto.start);

    try {
      const mentorship = await this.prisma.mentorship.create({
        data: {
          userId,
          categoryId,
          scheduledStart: slot.start,
          scheduledEnd: slot.end,
          status: MentorshipStatus.SCHEDULED,
          meetingEmail: dto.meetingEmail.trim().toLowerCase(),
        },
      });
      await this.attachCalendarEvent(mentorship.id, slot, dto.meetingEmail, categoryId);
      return this.serialize(await this.byId(mentorship.id));
    } catch (err) {
      // Índices únicos parciales: race condition o mentoría ya existente.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const target = String(err.meta?.target ?? '');
        if (target.includes('user_category')) {
          throw new ConflictException(
            'Ya tenés una mentoría para este curso',
          );
        }
        throw new ConflictException(
          'Ese horario se acaba de ocupar. Elegí otro.',
        );
      }
      throw err;
    }
  }

  async reschedule(userId: string, mentorshipId: string, startIso: string) {
    const mentorship = await this.byId(mentorshipId);
    if (mentorship.userId !== userId) {
      throw new ForbiddenException('No es tu mentoría');
    }
    if (mentorship.status !== MentorshipStatus.SCHEDULED) {
      throw new BadRequestException('La mentoría no está agendada');
    }
    if (mentorship.rescheduleCount >= 1) {
      throw new BadRequestException('Ya reprogramaste esta mentoría una vez');
    }
    this.assertChangeWindow(mentorship.scheduledStart);

    const slot = await this.findMatchingSlot(startIso);

    try {
      await this.prisma.mentorship.update({
        where: { id: mentorshipId },
        data: {
          scheduledStart: slot.start,
          scheduledEnd: slot.end,
          rescheduleCount: { increment: 1 },
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Ese horario se acaba de ocupar. Elegí otro.');
      }
      throw err;
    }

    await this.updateCalendarEvent(mentorshipId, slot);
    return this.serialize(await this.byId(mentorshipId));
  }

  async cancel(userId: string, mentorshipId: string) {
    const mentorship = await this.byId(mentorshipId);
    if (mentorship.userId !== userId) {
      throw new ForbiddenException('No es tu mentoría');
    }
    if (mentorship.status !== MentorshipStatus.SCHEDULED) {
      throw new BadRequestException('La mentoría no está agendada');
    }
    this.assertChangeWindow(mentorship.scheduledStart);

    await this.prisma.mentorship.update({
      where: { id: mentorshipId },
      data: { status: MentorshipStatus.CANCELLED },
    });
    if (mentorship.googleEventId) {
      await this.calendar.deleteEvent(mentorship.googleEventId);
    }
    return { cancelled: true };
  }

  private assertChangeWindow(start: Date) {
    const hoursUntil = (start.getTime() - Date.now()) / (60 * 60 * 1000);
    if (hoursUntil < CHANGE_MIN_HOURS) {
      throw new BadRequestException(
        `Solo se puede reprogramar o cancelar hasta ${CHANGE_MIN_HOURS} hs antes`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Google Calendar (delegado al servicio; no-op si no está configurado)
  // ---------------------------------------------------------------------------

  private async attachCalendarEvent(
    mentorshipId: string,
    slot: Slot,
    meetingEmail: string,
    categoryId: string,
  ) {
    const category = await this.prisma.videoCategory.findUnique({
      where: { id: categoryId },
      select: { name: true },
    });
    const impersonate =
      process.env.GOOGLE_CALENDAR_IMPERSONATE || 'cursos@merygarcia.com.ar';
    const res = await this.calendar.createEvent({
      summary: `Mentoría — ${category?.name ?? 'Curso'}`,
      description: 'Mentoría de Mery Garcia.',
      start: slot.start,
      end: slot.end,
      attendeeEmails: [impersonate, meetingEmail.trim().toLowerCase()],
    });
    if (res) {
      await this.prisma.mentorship.update({
        where: { id: mentorshipId },
        data: { googleEventId: res.eventId, googleMeetLink: res.meetLink },
      });
    }
  }

  private async updateCalendarEvent(mentorshipId: string, slot: Slot) {
    const m = await this.byId(mentorshipId);
    if (!m.googleEventId) return;
    const res = await this.calendar.updateEvent(m.googleEventId, {
      summary: 'Mentoría — Mery Garcia',
      start: slot.start,
      end: slot.end,
      attendeeEmails: [
        process.env.GOOGLE_CALENDAR_IMPERSONATE || 'cursos@merygarcia.com.ar',
        m.meetingEmail,
      ],
    });
    if (res) {
      await this.prisma.mentorship.update({
        where: { id: mentorshipId },
        data: { googleMeetLink: res.meetLink },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Consultas
  // ---------------------------------------------------------------------------

  private async byId(id: string) {
    const m = await this.prisma.mentorship.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Mentoría no encontrada');
    return m;
  }

  listMine(userId: string) {
    return this.prisma.mentorship
      .findMany({
        where: { userId },
        orderBy: { scheduledStart: 'desc' },
        include: { category: { select: { id: true, name: true, slug: true } } },
      })
      .then((rows) => rows.map((r) => this.serialize(r)));
  }

  /** Calendario admin: mentorías en un rango (para ver que no se pisen). */
  async listAdmin(filter: { from?: string; to?: string; status?: string }) {
    const where: Prisma.MentorshipWhereInput = {
      ...(filter.status ? { status: filter.status as MentorshipStatus } : {}),
      ...(filter.from || filter.to
        ? {
            scheduledStart: {
              ...(filter.from ? { gte: new Date(filter.from) } : {}),
              ...(filter.to ? { lte: new Date(filter.to) } : {}),
            },
          }
        : {}),
    };
    const rows = await this.prisma.mentorship.findMany({
      where,
      orderBy: { scheduledStart: 'asc' },
      include: {
        category: { select: { id: true, name: true } },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    return rows.map((r) => ({
      ...this.serialize(r),
      user: r.user,
      category: r.category,
    }));
  }

  /**
   * Cron: marca como cumplidas las mentorías cuyo horario ya pasó. Al quedar
   * COMPLETED se activa el chat del curso (lo resuelve chat.service).
   */
  async completePastDue(): Promise<{ completed: number }> {
    const { count } = await this.prisma.mentorship.updateMany({
      where: {
        status: MentorshipStatus.SCHEDULED,
        scheduledEnd: { lt: new Date() },
      },
      data: { status: MentorshipStatus.COMPLETED },
    });
    return { completed: count };
  }

  private serialize(m: {
    id: string;
    categoryId: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    status: MentorshipStatus;
    rescheduleCount: number;
    meetingEmail: string;
    googleMeetLink: string | null;
    userId?: string;
  }) {
    return {
      id: m.id,
      categoryId: m.categoryId,
      scheduledStart: m.scheduledStart.toISOString(),
      scheduledEnd: m.scheduledEnd.toISOString(),
      status: m.status,
      rescheduleCount: m.rescheduleCount,
      canReschedule:
        m.status === MentorshipStatus.SCHEDULED && m.rescheduleCount < 1,
      meetingEmail: m.meetingEmail,
      meetLink: m.googleMeetLink,
    };
  }
}
