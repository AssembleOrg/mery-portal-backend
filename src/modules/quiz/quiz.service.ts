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
  nextAttemptAt: string | null;
  lastAttempt: {
    passed: boolean;
    correctCount: number;
    totalQuestions: number;
    wrongQuestionIds: string[];
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

  private nextAttemptAt(def: QuizDefinition, lastAttemptAt: Date): Date {
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
    if (!def) {
      return {
        required: false,
        passed: false,
        canAttempt: false,
        nextAttemptAt: null,
        lastAttempt: null,
      };
    }

    const last = await this.prisma.quizAttempt.findFirst({
      where: { userId, categoryId },
      orderBy: { createdAt: 'desc' },
    });
    const passed = last?.passed
      ? true
      : await this.hasPassed(userId, categoryId);

    let canAttempt = !passed;
    let nextAttemptAt: string | null = null;
    if (!passed && last) {
      const next = this.nextAttemptAt(def, last.createdAt);
      if (next > new Date()) {
        canAttempt = false;
        nextAttemptAt = next.toISOString();
      }
    }

    return {
      required: true,
      passed,
      canAttempt,
      nextAttemptAt,
      lastAttempt: last
        ? {
            passed: last.passed,
            correctCount: last.correctCount,
            totalQuestions: last.totalQuestions,
            wrongQuestionIds: (last.wrongQuestionIds as string[]) ?? [],
            createdAt: last.createdAt.toISOString(),
          }
        : null,
    };
  }

  /**
   * Preguntas para el frontend: solo id + texto, nunca la respuesta correcta.
   */
  async getQuestions(userId: string, categoryId: string, role: UserRole) {
    const category = await this.resolveCategory(categoryId);
    const def = getQuizForSlug(category.slug);
    if (!def) {
      return { required: false as const, questions: [], status: await this.getStatus(userId, categoryId) };
    }
    await this.assertPurchase(userId, categoryId, role);
    return {
      required: true as const,
      questions: def.questions.map((q) => ({ id: q.id, text: q.text })),
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
    if (!def) {
      throw new BadRequestException('Este curso no tiene examen final');
    }
    await this.assertPurchase(userId, categoryId, role);

    if (await this.hasPassed(userId, categoryId)) {
      throw new BadRequestException('Ya aprobaste este examen');
    }

    // Cooldown de 24h desde el último intento fallido
    const last = await this.prisma.quizAttempt.findFirst({
      where: { userId, categoryId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (last) {
      const next = this.nextAttemptAt(def, last.createdAt);
      if (next > new Date()) {
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
      wrongQuestionIds,
      nextAttemptAt: passed
        ? null
        : this.nextAttemptAt(def, attempt.createdAt).toISOString(),
    };
  }
}
