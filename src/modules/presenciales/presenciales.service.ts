import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '~/shared/services';
import { DateTimeUtil } from '~/shared/utils';
import { DateTime } from 'luxon';
import { CreatePresencialPollDto, UpdatePresencialPollDto, VotePresencialPollDto, PresencialPollResponseDto, PresencialVoteResponseDto, PresencialPollQueryDto } from './dto';
import { PaginatedResponse } from '~/shared/types';
import { plainToClass } from 'class-transformer';

@Injectable()
export class PresencialesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Validate poll option (date, time, duration)
   */
  private validatePollOption(option: { date: string; start_time: string; duration_minutes?: number }): void {
    // Validate date format and day of week (Tuesday-Saturday = 2-6)
    const date = DateTimeUtil.fromISO(option.date);
    if (!date.isValid) {
      throw new BadRequestException(`Fecha inválida: ${option.date}`);
    }

    const dayOfWeek = date.weekday; // 1 = Monday, 2 = Tuesday, ..., 6 = Saturday, 7 = Sunday
    if (dayOfWeek < 2 || dayOfWeek > 6) {
      throw new BadRequestException(`La fecha debe ser de martes a sábado. Fecha recibida: ${option.date} (día ${dayOfWeek})`);
    }

    // Validate time format and range (10:00 - 17:00)
    const timeMatch = option.start_time.match(/^(\d{2}):(\d{2})$/);
    if (!timeMatch) {
      throw new BadRequestException(`Formato de hora inválido: ${option.start_time}. Debe ser HH:mm`);
    }

    const [hours, minutes] = timeMatch.slice(1).map(Number);
    if (hours < 10 || hours > 17 || (hours === 17 && minutes > 0)) {
      throw new BadRequestException(`La hora debe estar entre 10:00 y 17:00. Hora recibida: ${option.start_time}`);
    }

    // Validate duration
    const duration = option.duration_minutes || 120;
    if (duration <= 0) {
      throw new BadRequestException('La duración debe ser mayor a 0 minutos');
    }
  }

  /**
   * Check if user is eligible to vote in a poll
   */
  private async checkUserEligibility(userId: string, userEmail: string, eligibility: any): Promise<boolean> {
    const { courseIds, userOverrides } = eligibility;

    // Check user overrides first
    for (const override of userOverrides || []) {
      const matchesUserId = override.userId && override.userId === userId;
      const matchesEmail = override.email && override.email.toLowerCase() === userEmail.toLowerCase();
      
      if ((matchesUserId || matchesEmail) && override.allowed) {
        return true;
      }
    }

    // Check course subscriptions
    if (courseIds && courseIds.length > 0) {
      const activeSubscriptions = await this.prisma.categoryPurchase.findMany({
        where: {
          userId,
          categoryId: { in: courseIds },
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      });

      if (activeSubscriptions.length > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get user's full name
   */
  private async getUserName(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    if (!user) return null;

    const parts = [user.firstName, user.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : null;
  }

  /**
   * Create a new poll
   */
  async create(createPollDto: CreatePresencialPollDto): Promise<PresencialPollResponseDto> {
    // Validate all options
    for (const option of createPollDto.options) {
      this.validatePollOption(option);
    }

    // Create poll with options
    const poll = await this.prisma.presencialPoll.create({
      data: {
        title: createPollDto.title,
        description: createPollDto.description || null,
        deadlineAt: createPollDto.deadline_at 
          ? DateTimeUtil.fromISO(createPollDto.deadline_at).toJSDate()
          : null,
        status: 'open',
        eligibility: createPollDto.eligibility as any,
        options: {
          create: createPollDto.options.map(opt => ({
            date: DateTimeUtil.fromISO(opt.date).startOf('day').toJSDate(),
            startTime: opt.start_time,
            durationMinutes: opt.duration_minutes || 120,
          })),
        },
      },
      include: {
        options: true,
      },
    });

    return this.toPollResponseDto(poll);
  }

  /**
   * Get all polls with pagination
   */
  async findAll(query: PresencialPollQueryDto, userId?: string): Promise<PaginatedResponse<PresencialPollResponseDto>> {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [polls, total] = await Promise.all([
      this.prisma.presencialPoll.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          options: {
            orderBy: { date: 'asc' },
          },
        },
      }),
      this.prisma.presencialPoll.count({ where }),
    ]);

    // Filter polls by eligibility if user is provided
    // Note: For admins, show all polls. For regular users, filter by eligibility
    let filteredPolls = polls;
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, role: true },
      });

      if (user && user.role !== 'ADMIN' && user.role !== 'SUBADMIN') {
        // Only filter for regular users, admins see all
        filteredPolls = [];
        for (const poll of polls) {
          const isEligible = await this.checkUserEligibility(userId, user.email, poll.eligibility);
          if (isEligible) {
            filteredPolls.push(poll);
          }
        }
      }
    }

    return {
      data: filteredPolls.map(poll => this.toPollResponseDto(poll)),
      meta: {
        page,
        limit,
        total: filteredPolls.length,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Get a single poll by ID
   */
  async findOne(id: string, userId?: string): Promise<PresencialPollResponseDto> {
    const poll = await this.prisma.presencialPoll.findUnique({
      where: { id },
      include: {
        options: {
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!poll) {
      throw new NotFoundException('Encuesta no encontrada');
    }

    // Check eligibility if user is provided (admins can always access)
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, role: true },
      });

      if (user && user.role !== 'ADMIN' && user.role !== 'SUBADMIN') {
        // Only check eligibility for regular users
        const isEligible = await this.checkUserEligibility(userId, user.email, poll.eligibility);
        if (!isEligible) {
          throw new ForbiddenException('No tienes permiso para acceder a esta encuesta');
        }
      }
    }

    return this.toPollResponseDto(poll);
  }

  /**
   * Update a poll
   */
  async update(id: string, updatePollDto: UpdatePresencialPollDto): Promise<PresencialPollResponseDto> {
    const poll = await this.prisma.presencialPoll.findUnique({
      where: { id },
      include: { options: true },
    });

    if (!poll) {
      throw new NotFoundException('Encuesta no encontrada');
    }

    // Validate options if provided
    if (updatePollDto.options) {
      for (const option of updatePollDto.options) {
        this.validatePollOption(option);
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (updatePollDto.title !== undefined) updateData.title = updatePollDto.title;
    if (updatePollDto.description !== undefined) updateData.description = updatePollDto.description;
    if (updatePollDto.deadline_at !== undefined) {
      updateData.deadlineAt = updatePollDto.deadline_at
        ? DateTimeUtil.fromISO(updatePollDto.deadline_at).toJSDate()
        : null;
    }
    if (updatePollDto.status !== undefined) updateData.status = updatePollDto.status;
    if (updatePollDto.eligibility !== undefined) updateData.eligibility = updatePollDto.eligibility as any;

    // Update options if provided
    if (updatePollDto.options) {
      // Delete existing options
      await this.prisma.presencialPollOption.deleteMany({
        where: { pollId: id },
      });

      // Create new options
      updateData.options = {
        create: updatePollDto.options.map(opt => ({
          date: DateTimeUtil.fromISO(opt.date).startOf('day').toJSDate(),
          startTime: opt.start_time,
          durationMinutes: opt.duration_minutes || 120,
        })),
      };
    }

    const updatedPoll = await this.prisma.presencialPoll.update({
      where: { id },
      data: updateData,
      include: {
        options: {
          orderBy: { date: 'asc' },
        },
      },
    });

    return this.toPollResponseDto(updatedPoll);
  }

  /**
   * Close a poll
   */
  async close(id: string): Promise<PresencialPollResponseDto> {
    const poll = await this.prisma.presencialPoll.findUnique({
      where: { id },
      include: { options: true },
    });

    if (!poll) {
      throw new NotFoundException('Encuesta no encontrada');
    }

    const updatedPoll = await this.prisma.presencialPoll.update({
      where: { id },
      data: { status: 'closed' },
      include: {
        options: {
          orderBy: { date: 'asc' },
        },
      },
    });

    return this.toPollResponseDto(updatedPoll);
  }

  /**
   * Get votes for a poll
   */
  async getVotes(pollId: string): Promise<{ data: PresencialVoteResponseDto[]; meta: { total: number } }> {
    const poll = await this.prisma.presencialPoll.findUnique({
      where: { id: pollId },
    });

    if (!poll) {
      throw new NotFoundException('Encuesta no encontrada');
    }

    const votes = await this.prisma.presencialVote.findMany({
      where: { pollId },
      orderBy: { votedAt: 'desc' },
    });

    return {
      data: votes.map(vote => this.toVoteResponseDto(vote)),
      meta: {
        total: votes.length,
      },
    };
  }

  /**
   * Vote in a poll
   */
  async vote(pollId: string, userId: string, voteDto: VotePresencialPollDto): Promise<PresencialVoteResponseDto> {
    // Get poll and check if it exists
    const poll = await this.prisma.presencialPoll.findUnique({
      where: { id: pollId },
      include: {
        options: true,
      },
    });

    if (!poll) {
      throw new NotFoundException('Encuesta no encontrada');
    }

    // Check if option exists
    const option = poll.options.find(opt => opt.id === voteDto.option_id);
    if (!option) {
      throw new NotFoundException('Opción no encontrada');
    }

    // Check poll status
    if (poll.status !== 'open') {
      throw new BadRequestException('La encuesta no está abierta para votar');
    }

    // Check deadline
    if (poll.deadlineAt && new Date(poll.deadlineAt) < new Date()) {
      throw new BadRequestException('La fecha límite de la encuesta ha pasado');
    }

    // Check user eligibility
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const isEligible = await this.checkUserEligibility(userId, user.email, poll.eligibility);
    if (!isEligible) {
      throw new ForbiddenException('No tienes permiso para votar en esta encuesta');
    }

    // Check if user already voted (upsert)
    const existingVote = await this.prisma.presencialVote.findUnique({
      where: {
        pollId_userId: {
          pollId,
          userId,
        },
      },
    });

    const userName = await this.getUserName(userId);

    let vote;
    if (existingVote) {
      // Update existing vote
      vote = await this.prisma.presencialVote.update({
        where: { id: existingVote.id },
        data: {
          optionId: voteDto.option_id,
          votedAt: new Date(),
          userName: userName || null,
        },
      });
    } else {
      // Create new vote
      vote = await this.prisma.presencialVote.create({
        data: {
          pollId,
          optionId: voteDto.option_id,
          userId,
          userName: userName || null,
        },
      });
    }

    return this.toVoteResponseDto(vote);
  }

  /**
   * Get poll statistics
   */
  async getStats(pollId: string): Promise<{
    poll_id: string;
    total_votes: number;
    votes_by_option: Record<string, number>;
    unique_voters: number;
  }> {
    const poll = await this.prisma.presencialPoll.findUnique({
      where: { id: pollId },
      include: {
        options: true,
        votes: true,
      },
    });

    if (!poll) {
      throw new NotFoundException('Encuesta no encontrada');
    }

    const votesByOption: Record<string, number> = {};
    for (const option of poll.options) {
      votesByOption[option.id] = 0;
    }

    for (const vote of poll.votes) {
      votesByOption[vote.optionId] = (votesByOption[vote.optionId] || 0) + 1;
    }

    const uniqueVoters = new Set(poll.votes.map(v => v.userId)).size;

    return {
      poll_id: pollId,
      total_votes: poll.votes.length,
      votes_by_option: votesByOption,
      unique_voters: uniqueVoters,
    };
  }

  /**
   * Convert Prisma poll to response DTO
   */
  private toPollResponseDto(poll: any): PresencialPollResponseDto {
    return plainToClass(PresencialPollResponseDto, {
      id: poll.id,
      title: poll.title,
      description: poll.description,
      status: poll.status,
      deadline_at: poll.deadlineAt ? DateTime.fromJSDate(poll.deadlineAt).setZone('America/Argentina/Buenos_Aires').toISO() : null,
      options: poll.options.map((opt: any) => ({
        id: opt.id,
        date: DateTime.fromJSDate(opt.date).setZone('America/Argentina/Buenos_Aires').toFormat('yyyy-MM-dd'),
        start_time: opt.startTime,
        duration_minutes: opt.durationMinutes,
      })),
      created_at: DateTime.fromJSDate(poll.createdAt).setZone('America/Argentina/Buenos_Aires').toISO(),
      eligibility: poll.eligibility,
    }, { excludeExtraneousValues: true });
  }

  /**
   * Convert Prisma vote to response DTO
   */
  private toVoteResponseDto(vote: any): PresencialVoteResponseDto {
    return plainToClass(PresencialVoteResponseDto, {
      id: vote.id,
      poll_id: vote.pollId,
      option_id: vote.optionId,
      user_id: vote.userId,
      user_name: vote.userName,
      voted_at: DateTime.fromJSDate(vote.votedAt).setZone('America/Argentina/Buenos_Aires').toISO(),
    }, { excludeExtraneousValues: true });
  }
}

