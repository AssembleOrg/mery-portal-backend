import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/services';
import { UserRole } from '../../shared/types';
import { getQuizForSlug, QuizDefinition } from './quiz-definitions';

export interface QuizStatus {
  required: boolean;
  passed: boolean;
  canAttempt: boolean;
  /** Solo se usa si algún día se vuelve a activar el cooldown entre intentos. */
  nextAttemptAt: string | null;
  attempts: number;
  /**
   * Último intento. NO incluye qué preguntas estuvieron mal: al alumno solo se
   * le dice cuántas acertó y se le recomienda volver a ver el curso.
   */
  lastAttempt: {
    passed: boolean;
    correctCount: number;
    totalQuestions: number;
    createdAt: string;
  } | null;
}

@Injectable()
export class QuizService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveCategory(categoryId: string) {
    const category = await this.prisma.videoCategory.findFirst({
      where: { id: categoryId, deletedAt: null },
      select: { id: true, slug: true, name: true },
    });
    if (!category) {
      throw new NotFoundException(`Categoría no encontrada: ${categoryId}`);
    }
    return category;
  }

  private async assertPurchase(userId: string, categoryId: string, role: UserRole) {
    if (role === UserRole.ADMIN || role === UserRole.SUBADMIN) return;
    const purchase = await this.prisma.categoryPurchase.findUnique({
      where: { userId_categoryId: { userId, categoryId } },
    });
    if (!purchase) {
      throw new ForbiddenException('No tenés acceso a este curso');
    }
  }

  /** null si no hay cooldown configurado (reintento libre). */
  private nextAttemptAt(def: QuizDefinition, lastAttemptAt: Date): Date | null {
    if (def.cooldownHours <= 0) return null;
    const next = new Date(lastAttemptAt);
    next.setHours(next.getHours() + def.cooldownHours);
    return next;
  }

  /**
   * true si el usuario tiene un intento aprobado para la categoría.
   * Usado también por ChatService como gate de desbloqueo.
   */
  async hasPassed(userId: string, categoryId: string): Promise<boolean> {
    const passed = await this.prisma.quizAttempt.findFirst({
      where: { userId, categoryId, passed: true },
      select: { id: true },
    });
    return passed !== null;
  }

  async getStatus(userId: string, categoryId: string): Promise<QuizStatus> {
    const category = await this.resolveCategory(categoryId);
    const def = getQuizForSlug(category.slug);

    const [last, attempts] = await Promise.all([
      this.prisma.quizAttempt.findFirst({
        where: { userId, categoryId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.quizAttempt.count({ where: { userId, categoryId } }),
    ]);
    const passed = last?.passed
      ? true
      : await this.hasPassed(userId, categoryId);

    // Sin cooldown puede reintentar siempre que no haya aprobado todavía.
    let canAttempt = !passed;
    let nextAttemptAt: string | null = null;
    if (!passed && last) {
      const next = this.nextAttemptAt(def, last.createdAt);
      if (next && next > new Date()) {
        canAttempt = false;
        nextAttemptAt = next.toISOString();
      }
    }

    return {
      required: true,
      passed,
      canAttempt,
      nextAttemptAt,
      attempts,
      lastAttempt: last
        ? {
            passed: last.passed,
            correctCount: last.correctCount,
            totalQuestions: last.totalQuestions,
            createdAt: last.createdAt.toISOString(),
          }
        : null,
    };
  }

  /** Mezcla (Fisher-Yates) sobre una copia — no muta la definición. */
  private shuffle<T>(arr: readonly T[]): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /**
   * Preguntas para el frontend: solo id + texto (nunca la respuesta correcta),
   * en orden mezclado en cada apertura del examen.
   */
  async getQuestions(userId: string, categoryId: string, role: UserRole) {
    const category = await this.resolveCategory(categoryId);
    const def = getQuizForSlug(category.slug);
    await this.assertPurchase(userId, categoryId, role);
    return {
      required: true as const,
      maxWrong: def.maxWrong,
      questions: this.shuffle(def.questions).map((q) => ({
        id: q.id,
        text: q.text,
      })),
      status: await this.getStatus(userId, categoryId),
    };
  }

  async submitAttempt(
    userId: string,
    categoryId: string,
    role: UserRole,
    answers: Record<string, boolean>,
  ) {
    const category = await this.resolveCategory(categoryId);
    const def = getQuizForSlug(category.slug);
    await this.assertPurchase(userId, categoryId, role);

    if (await this.hasPassed(userId, categoryId)) {
      throw new BadRequestException('Ya aprobaste este examen');
    }

    // Cooldown entre intentos (deshabilitado mientras cooldownHours sea 0)
    const last = await this.prisma.quizAttempt.findFirst({
      where: { userId, categoryId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (last) {
      const next = this.nextAttemptAt(def, last.createdAt);
      if (next && next > new Date()) {
        throw new BadRequestException(
          `Podés volver a intentarlo a partir de ${next.toISOString()}`,
        );
      }
    }

    // Validar que respondieron todas las preguntas
    const missing = def.questions.filter(
      (q) => typeof answers[q.id] !== 'boolean',
    );
    if (missing.length > 0) {
      throw new BadRequestException('Tenés que responder todas las preguntas');
    }

    const wrongQuestionIds = def.questions
      .filter((q) => answers[q.id] !== q.correct)
      .map((q) => q.id);
    const totalQuestions = def.questions.length;
    const correctCount = totalQuestions - wrongQuestionIds.length;
    const passed = wrongQuestionIds.length <= def.maxWrong;

    const attempt = await this.prisma.quizAttempt.create({
      data: {
        userId,
        categoryId,
        answers: answers as Prisma.InputJsonValue,
        // Se guardan para análisis interno, pero NUNCA se devuelven al alumno.
        wrongQuestionIds: wrongQuestionIds as Prisma.InputJsonValue,
        correctCount,
        totalQuestions,
        passed,
      },
    });

    return {
      passed,
      correctCount,
      totalQuestions,
      maxWrong: def.maxWrong,
      // Reintento libre: el alumno puede volver a ver el curso y rendir de nuevo.
      canRetry: !passed,
      nextAttemptAt: passed
        ? null
        : (this.nextAttemptAt(def, attempt.createdAt)?.toISOString() ?? null),
    };
  }
}
