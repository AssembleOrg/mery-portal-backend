import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PresencialClassStatus,
  PresencialSignupStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../shared/services';
import { ChatGateway } from '../chat/chat.gateway';
import { PresencialEmailService } from './presencial-email.service';
import { CreatePresencialClassDto, UpdatePresencialClassDto } from './dto';

const TZ = 'America/Argentina/Buenos_Aires';
const AR_OFFSET = '-03:00';
/** Hasta cuántos meses hacia adelante se pueden abrir fechas. */
const HORIZON_MONTHS = 6;
const MIN_HOUR = 9;
const MAX_HOUR = 18;

const ACTIVE_CLASS: PresencialClassStatus[] = [
  PresencialClassStatus.TENTATIVE,
  PresencialClassStatus.CONFIRMED,
];
const ACTIVE_SIGNUP: PresencialSignupStatus[] = [
  PresencialSignupStatus.PENDING,
  PresencialSignupStatus.CONFIRMED,
];

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
} as const;

const classInclude = {
  categories: {
    include: { category: { select: { id: true, name: true, slug: true } } },
  },
} as const;

type ClassRow = Prisma.PresencialClassGetPayload<{ include: typeof classInclude }>;

@Injectable()
export class PresencialClassesService {
  private readonly logger = new Logger(PresencialClassesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: PresencialEmailService,
    private readonly gateway: ChatGateway,
  ) {}

  // ---------------------------------------------------------------------------
  // Helpers de fecha (hora Argentina, sin DST)
  // ---------------------------------------------------------------------------

  private atAR(dateStr: string, hour: number): Date {
    const hh = String(hour).padStart(2, '0');
    const d = new Date(`${dateStr}T${hh}:00:00${AR_OFFSET}`);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Fecha inválida');
    }
    return d;
  }

  private dateStrAR(d: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }

  private horizonEnd(): Date {
    const d = new Date();
    d.setMonth(d.getMonth() + HORIZON_MONTHS);
    return d;
  }

  private assertHours(startHour: number, endHour: number) {
    if (
      startHour < MIN_HOUR ||
      endHour > MAX_HOUR ||
      endHour <= startHour
    ) {
      throw new BadRequestException(
        `El horario debe estar entre ${MIN_HOUR}:00 y ${MAX_HOUR}:00 y el fin ser posterior al inicio`,
      );
    }
  }

  private assertWithinHorizon(startAt: Date) {
    const today = this.atAR(this.dateStrAR(new Date()), 0);
    if (startAt < today) {
      throw new BadRequestException('La fecha ya pasó');
    }
    if (startAt > this.horizonEnd()) {
      throw new BadRequestException(
        `Solo se pueden abrir fechas hasta ${HORIZON_MONTHS} meses adelante`,
      );
    }
  }

  private async assertCategories(ids: string[]) {
    if (ids.length === 0) return;
    const found = await this.prisma.videoCategory.count({
      where: { id: { in: ids } },
    });
    if (found !== ids.length) {
      throw new BadRequestException('Alguna formación no existe');
    }
  }

  // ---------------------------------------------------------------------------
  // Serialización
  // ---------------------------------------------------------------------------

  private serialize(c: ClassRow) {
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      date: this.dateStrAR(c.startAt),
      startHour: c.startHour,
      endHour: c.endHour,
      startAt: c.startAt.toISOString(),
      endAt: c.endAt.toISOString(),
      status: c.status,
      restrictToStudents: c.restrictToStudents,
      confirmedAt: c.confirmedAt ? c.confirmedAt.toISOString() : null,
      categories: c.categories.map((cc) => cc.category),
    };
  }

  private studentName(u: { firstName: string | null; lastName: string | null; email: string }) {
    return [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email;
  }

  private emailClass(c: ClassRow) {
    return {
      title: c.title,
      startAt: c.startAt,
      startHour: c.startHour,
      endHour: c.endHour,
      categoryNames: c.categories.map((cc) => cc.category.name),
    };
  }

  private async byId(id: string): Promise<ClassRow> {
    const c = await this.prisma.presencialClass.findUnique({
      where: { id },
      include: classInclude,
    });
    if (!c) throw new NotFoundException('Clase presencial no encontrada');
    return c;
  }

  // ---------------------------------------------------------------------------
  // Alumna
  // ---------------------------------------------------------------------------

  /**
   * Próximas clases (hasta 6 meses) con el estado de MI inscripción. Nunca
   * expone cuántas inscriptas hay. Si la clase está restringida, solo aparece
   * si tengo compra activa de alguna de sus formaciones.
   */
  async listUpcoming(userId: string) {
    const now = new Date();
    const [classes, purchases, mySignups] = await Promise.all([
      this.prisma.presencialClass.findMany({
        where: {
          status: { in: ACTIVE_CLASS },
          endAt: { gte: now },
          startAt: { lte: this.horizonEnd() },
        },
        orderBy: { startAt: 'asc' },
        include: classInclude,
      }),
      this.prisma.categoryPurchase.findMany({
        where: { userId, isActive: true },
        select: { categoryId: true },
      }),
      this.prisma.presencialSignup.findMany({
        where: { userId },
        select: { id: true, classId: true, status: true },
      }),
    ]);
    const owned = new Set(purchases.map((p) => p.categoryId));
    const signupByClass = new Map(mySignups.map((s) => [s.classId, s]));

    return classes
      .filter(
        (c) =>
          !c.restrictToStudents ||
          c.categories.some((cc) => owned.has(cc.categoryId)),
      )
      .map((c) => {
        const s = signupByClass.get(c.id);
        return {
          ...this.serialize(c),
          mySignup: s ? { id: s.id, status: s.status } : null,
        };
      });
  }

  /** Mis inscripciones (todas, más reciente primero) con su clase. */
  async mine(userId: string) {
    const rows = await this.prisma.presencialSignup.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { class: { include: classInclude } },
    });
    return rows.map((s) => ({
      id: s.id,
      status: s.status,
      note: s.note,
      confirmedAt: s.confirmedAt ? s.confirmedAt.toISOString() : null,
      createdAt: s.createdAt.toISOString(),
      class: this.serialize(s.class),
    }));
  }

  async signup(userId: string, classId: string, note?: string) {
    const cls = await this.byId(classId);
    if (!ACTIVE_CLASS.includes(cls.status)) {
      throw new BadRequestException('Esta clase no admite inscripciones');
    }
    if (cls.startAt <= new Date()) {
      throw new BadRequestException('Esta clase ya pasó');
    }
    if (cls.restrictToStudents) {
      const ok = await this.prisma.categoryPurchase.findFirst({
        where: {
          userId,
          isActive: true,
          categoryId: { in: cls.categories.map((cc) => cc.categoryId) },
        },
        select: { id: true },
      });
      if (!ok) {
        throw new ForbiddenException(
          'Esta clase es solo para alumnas de esa formación',
        );
      }
    }

    // Máximo 1 inscripción activa por alumna (cualquier clase futura).
    const active = await this.prisma.presencialSignup.findFirst({
      where: { userId, status: { in: ACTIVE_SIGNUP } },
      include: { class: { select: { id: true, title: true, startAt: true } } },
    });
    if (active) {
      if (active.classId === classId) {
        throw new ConflictException('Ya estás anotada a esta clase');
      }
      throw new ForbiddenException(
        `Ya tenés una inscripción activa (${active.class.title}). Cancelala para anotarte a otra fecha.`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });
    if (!user) throw new NotFoundException('Usuaria no encontrada');

    let row;
    try {
      // Si ya se había bajado / rechazado de esta misma clase, se reactiva.
      row = await this.prisma.presencialSignup.upsert({
        where: { classId_userId: { classId, userId } },
        update: {
          status: PresencialSignupStatus.PENDING,
          note: note?.trim() || null,
          confirmedAt: null,
        },
        create: { classId, userId, note: note?.trim() || null },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ForbiddenException(
          'Ya tenés una inscripción activa. Cancelala para anotarte a otra fecha.',
        );
      }
      throw err;
    }

    this.gateway.broadcastPresencialEvent({
      type: 'signup',
      classId: cls.id,
      title: cls.title,
      start: cls.startAt.toISOString(),
      studentName: this.studentName(user),
    });
    return { id: row.id, status: row.status };
  }

  async cancelSignup(userId: string, signupId: string) {
    const s = await this.prisma.presencialSignup.findUnique({
      where: { id: signupId },
      include: { class: true, user: { select: userSelect } },
    });
    if (!s || s.userId !== userId) {
      throw new NotFoundException('Inscripción no encontrada');
    }
    if (!ACTIVE_SIGNUP.includes(s.status)) {
      throw new BadRequestException('La inscripción no está activa');
    }
    if (s.class.startAt <= new Date()) {
      throw new BadRequestException('La clase ya pasó');
    }
    await this.prisma.presencialSignup.update({
      where: { id: signupId },
      data: { status: PresencialSignupStatus.CANCELLED },
    });
    this.gateway.broadcastPresencialEvent({
      type: 'signup_cancelled',
      classId: s.classId,
      title: s.class.title,
      start: s.class.startAt.toISOString(),
      studentName: this.studentName(s.user),
    });
    return { cancelled: true };
  }

  // ---------------------------------------------------------------------------
  // Admin: CRUD
  // ---------------------------------------------------------------------------

  /** Calendario admin: clases en un rango con sus inscriptas y conteos. */
  async listAdmin(filter: { from?: string; to?: string; status?: string }) {
    const where: Prisma.PresencialClassWhereInput = {
      ...(filter.status
        ? { status: filter.status as PresencialClassStatus }
        : {}),
      ...(filter.from || filter.to
        ? {
            startAt: {
              ...(filter.from ? { gte: new Date(filter.from) } : {}),
              ...(filter.to ? { lte: new Date(filter.to) } : {}),
            },
          }
        : {}),
    };
    const rows = await this.prisma.presencialClass.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: {
        ...classInclude,
        signups: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: userSelect } },
        },
      },
    });
    return rows.map((c) => {
      const signups = c.signups.map((s) => ({
        id: s.id,
        status: s.status,
        note: s.note,
        createdAt: s.createdAt.toISOString(),
        user: s.user,
      }));
      const count = (st: PresencialSignupStatus) =>
        signups.filter((s) => s.status === st).length;
      return {
        ...this.serialize(c),
        signups,
        counts: {
          pending: count(PresencialSignupStatus.PENDING),
          confirmed: count(PresencialSignupStatus.CONFIRMED),
          active:
            count(PresencialSignupStatus.PENDING) +
            count(PresencialSignupStatus.CONFIRMED),
        },
      };
    });
  }

  async create(dto: CreatePresencialClassDto) {
    this.assertHours(dto.startHour, dto.endHour);
    const startAt = this.atAR(dto.date, dto.startHour);
    const endAt = this.atAR(dto.date, dto.endHour);
    this.assertWithinHorizon(startAt);
    const categoryIds = dto.categoryIds ?? [];
    await this.assertCategories(categoryIds);

    const c = await this.prisma.presencialClass.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        startAt,
        endAt,
        startHour: dto.startHour,
        endHour: dto.endHour,
        restrictToStudents: dto.restrictToStudents ?? false,
        categories: {
          create: categoryIds.map((categoryId) => ({ categoryId })),
        },
      },
      include: classInclude,
    });
    return this.serialize(c);
  }

  async update(id: string, dto: UpdatePresencialClassDto) {
    const current = await this.byId(id);
    const date = dto.date ?? this.dateStrAR(current.startAt);
    const startHour = dto.startHour ?? current.startHour;
    const endHour = dto.endHour ?? current.endHour;
    this.assertHours(startHour, endHour);
    const startAt = this.atAR(date, startHour);
    const endAt = this.atAR(date, endHour);
    if (dto.date !== undefined || dto.startHour !== undefined || dto.endHour !== undefined) {
      this.assertWithinHorizon(startAt);
    }
    if (dto.categoryIds) await this.assertCategories(dto.categoryIds);

    const c = await this.prisma.presencialClass.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        startAt,
        endAt,
        startHour,
        endHour,
        ...(dto.restrictToStudents !== undefined
          ? { restrictToStudents: dto.restrictToStudents }
          : {}),
        ...(dto.categoryIds
          ? {
              categories: {
                deleteMany: {},
                create: dto.categoryIds.map((categoryId) => ({ categoryId })),
              },
            }
          : {}),
      },
      include: classInclude,
    });
    return this.serialize(c);
  }

  async remove(id: string) {
    await this.byId(id);
    const active = await this.prisma.presencialSignup.count({
      where: { classId: id, status: { in: ACTIVE_SIGNUP } },
    });
    if (active > 0) {
      throw new BadRequestException(
        'Tiene inscriptas activas. Cancelá la clase (avisa a las alumnas) en vez de borrarla.',
      );
    }
    await this.prisma.presencialClass.delete({ where: { id } });
    return { deleted: true };
  }

  // ---------------------------------------------------------------------------
  // Admin: confirmación / cancelación (avisan a las alumnas)
  // ---------------------------------------------------------------------------

  /** Confirma la fecha y da lugar a todas las PENDING. Avisa por email + in-app. */
  async confirmClass(id: string) {
    const cls = await this.byId(id);
    if (!ACTIVE_CLASS.includes(cls.status)) {
      throw new BadRequestException('La clase no está activa');
    }
    const now = new Date();
    const pending = await this.prisma.presencialSignup.findMany({
      where: { classId: id, status: PresencialSignupStatus.PENDING },
      include: { user: { select: userSelect } },
    });
    await this.prisma.$transaction([
      this.prisma.presencialClass.update({
        where: { id },
        data: { status: PresencialClassStatus.CONFIRMED, confirmedAt: now },
      }),
      this.prisma.presencialSignup.updateMany({
        where: { classId: id, status: PresencialSignupStatus.PENDING },
        data: { status: PresencialSignupStatus.CONFIRMED, confirmedAt: now },
      }),
    ]);

    const info = this.emailClass(cls);
    await Promise.allSettled(
      pending.map((s) =>
        this.email.sendConfirmed(
          { email: s.user.email, name: s.user.firstName ?? '' },
          info,
        ),
      ),
    );
    this.gateway.broadcastPresencialEvent(
      {
        type: 'confirmed',
        classId: cls.id,
        title: cls.title,
        start: cls.startAt.toISOString(),
      },
      pending.map((s) => s.userId),
    );
    this.logger.log(`Clase ${cls.title} confirmada · ${pending.length} inscriptas avisadas`);
    return { confirmed: true, notified: pending.length };
  }

  /** Cancela la fecha; todas las activas quedan CANCELLED y se les avisa. */
  async cancelClass(id: string) {
    const cls = await this.byId(id);
    if (!ACTIVE_CLASS.includes(cls.status)) {
      throw new BadRequestException('La clase no está activa');
    }
    const active = await this.prisma.presencialSignup.findMany({
      where: { classId: id, status: { in: ACTIVE_SIGNUP } },
      include: { user: { select: userSelect } },
    });
    await this.prisma.$transaction([
      this.prisma.presencialClass.update({
        where: { id },
        data: { status: PresencialClassStatus.CANCELLED },
      }),
      this.prisma.presencialSignup.updateMany({
        where: { classId: id, status: { in: ACTIVE_SIGNUP } },
        data: { status: PresencialSignupStatus.CANCELLED },
      }),
    ]);

    const info = this.emailClass(cls);
    await Promise.allSettled(
      active.map((s) =>
        this.email.sendClassCancelled(
          { email: s.user.email, name: s.user.firstName ?? '' },
          info,
        ),
      ),
    );
    this.gateway.broadcastPresencialEvent(
      {
        type: 'class_cancelled',
        classId: cls.id,
        title: cls.title,
        start: cls.startAt.toISOString(),
      },
      active.map((s) => s.userId),
    );
    return { cancelled: true, notified: active.length };
  }

  /** Confirma una inscripción puntual (ej. anotada después de confirmar la fecha). */
  async confirmSignup(signupId: string) {
    const s = await this.signupOrFail(signupId);
    if (s.status !== PresencialSignupStatus.PENDING) {
      throw new BadRequestException('La inscripción no está pendiente');
    }
    await this.prisma.presencialSignup.update({
      where: { id: signupId },
      data: { status: PresencialSignupStatus.CONFIRMED, confirmedAt: new Date() },
    });
    await this.email.sendConfirmed(
      { email: s.user.email, name: s.user.firstName ?? '' },
      this.emailClass(s.class),
    );
    this.gateway.broadcastPresencialEvent(
      {
        type: 'confirmed',
        classId: s.classId,
        title: s.class.title,
        start: s.class.startAt.toISOString(),
        studentName: this.studentName(s.user),
      },
      [s.userId],
    );
    return { confirmed: true };
  }

  /** Rechaza una inscripción (no hay lugar). Avisa a la alumna. */
  async rejectSignup(signupId: string) {
    const s = await this.signupOrFail(signupId);
    if (!ACTIVE_SIGNUP.includes(s.status)) {
      throw new BadRequestException('La inscripción no está activa');
    }
    await this.prisma.presencialSignup.update({
      where: { id: signupId },
      data: { status: PresencialSignupStatus.REJECTED },
    });
    await this.email.sendRejected(
      { email: s.user.email, name: s.user.firstName ?? '' },
      this.emailClass(s.class),
    );
    this.gateway.broadcastPresencialEvent(
      {
        type: 'rejected',
        classId: s.classId,
        title: s.class.title,
        start: s.class.startAt.toISOString(),
        studentName: this.studentName(s.user),
      },
      [s.userId],
    );
    return { rejected: true };
  }

  private async signupOrFail(id: string) {
    const s = await this.prisma.presencialSignup.findUnique({
      where: { id },
      include: {
        user: { select: userSelect },
        class: { include: classInclude },
      },
    });
    if (!s) throw new NotFoundException('Inscripción no encontrada');
    return s;
  }

  // ---------------------------------------------------------------------------
  // Cron
  // ---------------------------------------------------------------------------

  /** Cierra clases ya pasadas (y sus inscripciones activas) → COMPLETED. */
  async completePast(): Promise<{ completed: number }> {
    const now = new Date();
    const past = await this.prisma.presencialClass.findMany({
      where: { status: { in: ACTIVE_CLASS }, endAt: { lt: now } },
      select: { id: true },
    });
    if (past.length === 0) return { completed: 0 };
    const ids = past.map((c) => c.id);
    await this.prisma.$transaction([
      this.prisma.presencialSignup.updateMany({
        where: { classId: { in: ids }, status: { in: ACTIVE_SIGNUP } },
        data: { status: PresencialSignupStatus.COMPLETED },
      }),
      this.prisma.presencialClass.updateMany({
        where: { id: { in: ids } },
        data: { status: PresencialClassStatus.COMPLETED },
      }),
    ]);
    return { completed: ids.length };
  }
}
