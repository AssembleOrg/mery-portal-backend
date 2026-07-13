import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { PrismaService } from '~/shared/services';
import { PaginatedResponse } from '~/shared/types';
import {
  CreateFormDto,
  FormFieldDto,
  SubmitFormResponseDto,
  UpdateFormDto,
  FormQueryDto,
  FormResponsesQueryDto,
  UpdateResponseStatusDto,
} from './dto';
import { EmailService } from '../email/email.service';

const TIMEZONE = 'America/Argentina/Buenos_Aires';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHOICE_TYPES = ['select', 'radio', 'checkbox'];
const MAX_TEXT_LENGTH = 5000;

type YesNoAnswer = { value: boolean; context?: string };

@Injectable()
export class FormsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // ============ Helpers ============

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  /**
   * Assign stable IDs to fields/options that don't have one and
   * validate structural coherence of the definitions.
   */
  private normalizeFields(fields: FormFieldDto[]): FormFieldDto[] {
    return fields.map((field) => {
      const normalized: FormFieldDto = {
        ...field,
        id: field.id || randomUUID(),
        label: field.label?.trim() ?? '',
      };

      if (CHOICE_TYPES.includes(field.type)) {
        if (!field.options || field.options.length === 0) {
          throw new BadRequestException(
            `El campo "${field.label}" (${field.type}) necesita al menos una opción`,
          );
        }
        normalized.options = field.options.map((opt) => ({
          ...opt,
          id: opt.id || randomUUID(),
          label: opt.label.trim(),
        }));
      } else {
        delete normalized.options;
      }

      if (field.type !== 'yesno') {
        delete normalized.allowContext;
        delete normalized.contextLabel;
      }

      return normalized;
    });
  }

  private async ensureUniqueSlug(slug: string, excludeId?: string): Promise<string> {
    let candidate = slug;
    let attempt = 1;
    // Find a free slug appending -2, -3... if taken
    // (also considers soft-deleted forms since slug is a unique column)
    while (true) {
      const existing = await this.prisma.form.findUnique({ where: { slug: candidate } });
      if (!existing || existing.id === excludeId) return candidate;
      attempt += 1;
      candidate = `${slug}-${attempt}`;
      if (attempt > 50) {
        throw new ConflictException('No se pudo generar un slug único');
      }
    }
  }

  private async findFormOrFail(id: string) {
    const form = await this.prisma.form.findFirst({
      where: { id, deletedAt: null },
    });
    if (!form) {
      throw new NotFoundException('Formulario no encontrado');
    }
    return form;
  }

  // ============ Admin CRUD ============

  async create(dto: CreateFormDto) {
    const baseSlug = this.slugify(dto.slug || dto.title);
    if (!baseSlug) {
      throw new BadRequestException('El título no permite generar un slug válido');
    }
    const slug = await this.ensureUniqueSlug(baseSlug);
    const fields = this.normalizeFields(dto.fields || []);

    return this.prisma.form.create({
      data: {
        title: dto.title,
        slug,
        description: dto.description,
        status: dto.status || 'draft',
        fields: fields as object[],
        successMessage: dto.successMessage,
        closedMessage: dto.closedMessage,
        submitLabel: dto.submitLabel,
      },
      include: { _count: { select: { responses: true } } },
    });
  }

  async findAll(query: FormQueryDto): Promise<PaginatedResponse<unknown>> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const where = {
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { title: { contains: query.search, mode: 'insensitive' as const } },
          { slug: { contains: query.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [forms, total] = await Promise.all([
      this.prisma.form.findMany({
        where,
        include: { _count: { select: { responses: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.form.count({ where }),
    ]);

    return {
      data: forms,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string) {
    const form = await this.prisma.form.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { responses: true } } },
    });
    if (!form) {
      throw new NotFoundException('Formulario no encontrado');
    }
    return form;
  }

  async update(id: string, dto: UpdateFormDto) {
    const form = await this.findFormOrFail(id);

    let slug = form.slug;
    if (dto.slug !== undefined || dto.title !== undefined) {
      const baseSlug = this.slugify(dto.slug || form.slug);
      if (dto.slug !== undefined && baseSlug !== form.slug) {
        slug = await this.ensureUniqueSlug(baseSlug, id);
      }
    }

    return this.prisma.form.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        slug,
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.fields !== undefined && {
          fields: this.normalizeFields(dto.fields) as object[],
        }),
        ...(dto.successMessage !== undefined && { successMessage: dto.successMessage }),
        ...(dto.closedMessage !== undefined && { closedMessage: dto.closedMessage }),
        ...(dto.submitLabel !== undefined && { submitLabel: dto.submitLabel }),
      },
      include: { _count: { select: { responses: true } } },
    });
  }

  async remove(id: string) {
    await this.findFormOrFail(id);
    // Soft delete + free the slug for future forms
    return this.prisma.form.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'closed',
        slug: `deleted-${Date.now()}-${id.slice(-6)}`,
      },
    });
  }

  async duplicate(id: string) {
    const form = await this.findFormOrFail(id);
    const slug = await this.ensureUniqueSlug(`${form.slug}-copia`);

    return this.prisma.form.create({
      data: {
        title: `${form.title} (copia)`,
        slug,
        description: form.description,
        status: 'draft',
        fields: form.fields as object[],
        successMessage: form.successMessage,
        closedMessage: form.closedMessage,
        submitLabel: form.submitLabel,
      },
      include: { _count: { select: { responses: true } } },
    });
  }

  // ============ Public ============

  async getPublicBySlug(slug: string) {
    const form = await this.prisma.form.findFirst({
      where: { slug, deletedAt: null, status: { in: ['published', 'closed'] } },
    });
    if (!form) {
      throw new NotFoundException('Formulario no encontrado');
    }

    if (form.status === 'closed') {
      return {
        id: form.id,
        slug: form.slug,
        title: form.title,
        status: form.status,
        closedMessage:
          form.closedMessage || 'Este formulario ya no acepta respuestas. ¡Gracias por tu interés!',
      };
    }

    return {
      id: form.id,
      slug: form.slug,
      title: form.title,
      description: form.description,
      status: form.status,
      fields: form.fields,
      submitLabel: form.submitLabel,
      successMessage: form.successMessage,
    };
  }

  async submit(slug: string, dto: SubmitFormResponseDto, ipAddress?: string, userAgent?: string) {
    const form = await this.prisma.form.findFirst({
      where: { slug, deletedAt: null },
    });
    if (!form || form.status === 'draft') {
      throw new NotFoundException('Formulario no encontrado');
    }
    if (form.status === 'closed') {
      throw new BadRequestException('Este formulario ya no acepta respuestas');
    }

    const fields = (form.fields as unknown as FormFieldDto[]) || [];
    const cleanAnswers = this.validateAnswers(fields, dto.answers);

    const emailField = fields.find((f) => f.type === 'email' && f.id);
    const email = emailField ? (cleanAnswers[emailField.id!] as string | undefined) || null : null;

    if (email) {
      const existing = await this.prisma.formResponse.findUnique({
        where: { formId_email: { formId: form.id, email } },
      });
      if (existing) {
        throw new ConflictException(
          'Ya recibimos una respuesta con este email para este formulario. Si necesitás modificar tus datos, escribinos.',
        );
      }
    }

    try {
      await this.prisma.formResponse.create({
        data: {
          formId: form.id,
          answers: cleanAnswers as Prisma.InputJsonValue,
          email,
          ipAddress: ipAddress?.slice(0, 100),
          userAgent: userAgent?.slice(0, 300),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          'Ya recibimos una respuesta con este email para este formulario. Si necesitás modificar tus datos, escribinos.',
        );
      }
      throw e;
    }

    return {
      success: true,
      message:
        form.successMessage ||
        'Gracias por completar el formulario. Muy pronto recibirás la confirmación de tu lugar por email.',
    };
  }

  /**
   * Validate submitted answers against the form's field definitions.
   * Returns a clean answers object containing only known field IDs.
   */
  private validateAnswers(
    fields: FormFieldDto[],
    answers: Record<string, unknown>,
  ): Record<string, unknown> {
    const clean: Record<string, unknown> = {};

    for (const field of fields) {
      if (field.type === 'info' || !field.id) continue;

      const raw = answers[field.id];
      const isEmpty =
        raw === undefined ||
        raw === null ||
        (typeof raw === 'string' && raw.trim() === '') ||
        (Array.isArray(raw) && raw.length === 0);

      if (isEmpty) {
        if (field.required) {
          throw new BadRequestException(`El campo "${field.label}" es obligatorio`);
        }
        continue;
      }

      switch (field.type) {
        case 'text':
        case 'phone':
        case 'textarea': {
          if (typeof raw !== 'string') {
            throw new BadRequestException(`Valor inválido para "${field.label}"`);
          }
          clean[field.id] = raw.trim().slice(0, MAX_TEXT_LENGTH);
          break;
        }
        case 'email': {
          if (typeof raw !== 'string' || !EMAIL_REGEX.test(raw.trim())) {
            throw new BadRequestException(`Email inválido en "${field.label}"`);
          }
          clean[field.id] = raw.trim().toLowerCase();
          break;
        }
        case 'select':
        case 'radio': {
          const optionIds = (field.options || []).map((o) => o.id);
          if (typeof raw !== 'string' || !optionIds.includes(raw)) {
            throw new BadRequestException(`Opción inválida en "${field.label}"`);
          }
          clean[field.id] = raw;
          break;
        }
        case 'checkbox': {
          const optionIds = (field.options || []).map((o) => o.id);
          if (!Array.isArray(raw) || raw.some((v) => typeof v !== 'string' || !optionIds.includes(v))) {
            throw new BadRequestException(`Opciones inválidas en "${field.label}"`);
          }
          clean[field.id] = Array.from(new Set(raw));
          break;
        }
        case 'yesno': {
          const obj = raw as YesNoAnswer;
          if (typeof obj !== 'object' || typeof obj.value !== 'boolean') {
            throw new BadRequestException(`Valor inválido para "${field.label}"`);
          }
          const answer: YesNoAnswer = { value: obj.value };
          if (field.allowContext && typeof obj.context === 'string' && obj.context.trim()) {
            answer.context = obj.context.trim().slice(0, MAX_TEXT_LENGTH);
          }
          clean[field.id] = answer;
          break;
        }
      }
    }

    return clean;
  }

  // ============ Responses & Analytics ============

  async getResponses(formId: string, query: FormResponsesQueryDto) {
    const form = await this.findFormOrFail(formId);
    const page = query.page || 1;
    const limit = query.limit || 25;
    const where: Prisma.FormResponseWhereInput = { formId };
    if (query.status) where.status = query.status;

    const [responses, total] = await Promise.all([
      this.prisma.formResponse.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.formResponse.count({ where }),
    ]);

    return {
      data: {
        form: { id: form.id, title: form.title, slug: form.slug, fields: form.fields },
        responses,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getAnalytics(formId: string) {
    const form = await this.findFormOrFail(formId);
    const responses = await this.prisma.formResponse.findMany({
      where: { formId },
      orderBy: { createdAt: 'asc' },
      select: { answers: true, createdAt: true, status: true },
    });

    const statusCounts = { pending: 0, accepted: 0, rejected: 0 };
    for (const r of responses) {
      if (r.status === 'accepted') statusCounts.accepted++;
      else if (r.status === 'rejected') statusCounts.rejected++;
      else statusCounts.pending++;
    }

    const now = DateTime.now().setZone(TIMEZONE);
    const todayStart = now.startOf('day');
    const weekStart = now.minus({ days: 6 }).startOf('day');

    let today = 0;
    let last7Days = 0;
    const byDayMap = new Map<string, number>();

    for (const r of responses) {
      const dt = DateTime.fromJSDate(r.createdAt).setZone(TIMEZONE);
      if (dt >= todayStart) today += 1;
      if (dt >= weekStart) last7Days += 1;
      const key = dt.toFormat('yyyy-MM-dd');
      byDayMap.set(key, (byDayMap.get(key) || 0) + 1);
    }

    const byDay = Array.from(byDayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // Distribution for choice + yesno fields
    const fields = (form.fields as unknown as FormFieldDto[]) || [];
    const distributions = fields
      .filter((f) => f.id && (CHOICE_TYPES.includes(f.type) || f.type === 'yesno'))
      .map((field) => {
        const counts = new Map<string, number>();
        let answered = 0;

        for (const r of responses) {
          const value = (r.answers as Record<string, unknown>)[field.id!];
          if (value === undefined || value === null) continue;
          answered += 1;

          if (field.type === 'yesno') {
            const v = (value as YesNoAnswer).value ? 'yes' : 'no';
            counts.set(v, (counts.get(v) || 0) + 1);
          } else if (Array.isArray(value)) {
            for (const optId of value) {
              counts.set(String(optId), (counts.get(String(optId)) || 0) + 1);
            }
          } else {
            counts.set(String(value), (counts.get(String(value)) || 0) + 1);
          }
        }

        const options =
          field.type === 'yesno'
            ? [
                { id: 'yes', label: 'Sí', count: counts.get('yes') || 0 },
                { id: 'no', label: 'No', count: counts.get('no') || 0 },
              ]
            : (field.options || []).map((opt) => ({
                id: opt.id!,
                label: opt.label,
                count: counts.get(opt.id!) || 0,
              }));

        return {
          fieldId: field.id!,
          label: field.label,
          type: field.type,
          answered,
          options: options.map((o) => ({
            ...o,
            percent: answered > 0 ? Math.round((o.count / answered) * 1000) / 10 : 0,
          })),
        };
      });

    return {
      form: { id: form.id, title: form.title, slug: form.slug, status: form.status },
      total: responses.length,
      today,
      last7Days,
      firstResponseAt: responses[0]?.createdAt ?? null,
      lastResponseAt: responses[responses.length - 1]?.createdAt ?? null,
      byDay,
      distributions,
      statusCounts,
    };
  }

  /**
   * Cambia el estado de decisión de una respuesta (pending/accepted/rejected).
   * Al aceptar por primera vez, envía el email de confirmación + invitación formal.
   */
  async updateResponseStatus(
    formId: string,
    responseId: string,
    dto: UpdateResponseStatusDto,
  ) {
    const form = await this.findFormOrFail(formId);
    const response = await this.prisma.formResponse.findFirst({
      where: { id: responseId, formId },
    });
    if (!response) {
      throw new NotFoundException('Respuesta no encontrada');
    }

    let invitationSentAt = response.invitationSentAt ?? null;

    // Enviar invitación solo la primera vez que se acepta
    if (dto.status === 'accepted' && !invitationSentAt) {
      const contact = this.extractInvitationData(
        (form.fields as unknown as FormFieldDto[]) || [],
        response.answers as Record<string, unknown>,
      );

      if (!contact.email || !EMAIL_REGEX.test(contact.email)) {
        throw new BadRequestException(
          'La respuesta no tiene un email válido para enviar la invitación',
        );
      }

      try {
        await this.emailService.sendEventInvitationEmail(contact.email, contact.name, {
          eventTitle: form.title,
          horario: contact.horario,
          eventDetails: contact.eventDetails,
        });
        invitationSentAt = new Date();
      } catch {
        throw new BadRequestException(
          'No se pudo enviar el email de invitación. Intentá de nuevo.',
        );
      }
    }

    return this.prisma.formResponse.update({
      where: { id: responseId },
      data: { status: dto.status, invitationSentAt },
    });
  }

  /** Extrae email, nombre, horario y detalles del evento desde las respuestas. */
  private extractInvitationData(
    fields: FormFieldDto[],
    answers: Record<string, unknown>,
  ): { email: string; name: string; horario: string | null; eventDetails: string | null } {
    const real = fields.filter((f) => f.id);

    const emailField = real.find((f) => f.type === 'email');
    const email = emailField ? String(answers[emailField.id!] ?? '').trim() : '';

    const nameField = real.find((f) => f.type === 'text');
    const name = nameField ? String(answers[nameField.id!] ?? '').trim() : '';

    // Horario: primer radio cuya etiqueta menciona "horario", si no, cualquier radio
    const horarioField =
      real.find((f) => f.type === 'radio' && /horario/i.test(f.label)) ||
      real.find((f) => f.type === 'radio');
    let horario: string | null = null;
    if (horarioField) {
      const val = answers[horarioField.id!];
      horario =
        horarioField.options?.find((o) => o.id === val)?.label || (val ? String(val) : null);
    }

    // Detalles del evento: bloque info cuya etiqueta menciona "fecha"
    const infoField =
      real.find((f) => f.type === 'info' && /fecha|masterclass|master class/i.test(f.label)) ||
      fields.find((f) => f.type === 'info');
    const eventDetails = infoField?.description?.trim() || null;

    return { email, name, horario, eventDetails };
  }

  async exportCsv(formId: string): Promise<{ filename: string; content: string }> {
    const form = await this.findFormOrFail(formId);
    const responses = await this.prisma.formResponse.findMany({
      where: { formId },
      orderBy: { createdAt: 'asc' },
    });

    const fields = ((form.fields as unknown as FormFieldDto[]) || []).filter(
      (f) => f.type !== 'info' && f.id,
    );

    const escapeCsv = (value: string): string => `"${value.replace(/"/g, '""')}"`;

    const header = ['Fecha', ...fields.map((f) => f.label)].map(escapeCsv).join(',');

    const rows = responses.map((r) => {
      const answers = r.answers as Record<string, unknown>;
      const date = DateTime.fromJSDate(r.createdAt)
        .setZone(TIMEZONE)
        .toFormat('dd/MM/yyyy HH:mm');

      const cells = fields.map((field) => {
        const value = answers[field.id!];
        if (value === undefined || value === null) return '';

        if (field.type === 'yesno') {
          const v = value as YesNoAnswer;
          return `${v.value ? 'Sí' : 'No'}${v.context ? ` — ${v.context}` : ''}`;
        }
        if (Array.isArray(value)) {
          return value
            .map((optId) => field.options?.find((o) => o.id === optId)?.label || String(optId))
            .join(' | ');
        }
        if (field.type === 'select' || field.type === 'radio') {
          return field.options?.find((o) => o.id === value)?.label || String(value);
        }
        return String(value);
      });

      return [date, ...cells].map(escapeCsv).join(',');
    });

    // BOM so Excel opens UTF-8 correctly
    const content = '\uFEFF' + [header, ...rows].join('\r\n');
    const filename = `${form.slug}-respuestas.csv`;

    return { filename, content };
  }
}
