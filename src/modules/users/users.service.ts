import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { PasswordUtil } from '../../shared/utils';
import { PaginatedResponse } from '../../shared/types';
import { CreateUserDto, UpdateUserDto, UserResponseDto, UserQueryDto, AssignCourseDto } from './dto';
import { plainToClass } from 'class-transformer';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const { email, password, ...userData } = createUserDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('El usuario ya existe');
    }

    // Hash password if provided
    const hashedPassword = password ? await PasswordUtil.hash(password) : undefined;

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword || '',
        ...userData,
      },
    });

    return plainToClass(UserResponseDto, user);
  }

  async findAll(query: UserQueryDto): Promise<PaginatedResponse<UserResponseDto>> {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc', ...filters } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null, // Only non-deleted users
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as any } },
          { lastName: { contains: search, mode: 'insensitive' as any } },
          { email: { contains: search, mode: 'insensitive' as any } },
        ],
      }),
      ...filters,
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder as any },
        select: {
          id: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const userDtos = users.map(user => plainToClass(UserResponseDto, user));

    return {
      data: userDtos,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return plainToClass(UserResponseDto, user);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    const { password, ...updateData } = updateUserDto;

    // Check if user exists and is not deleted
    const existingUser = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existingUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Hash password if provided
    const hashedPassword = password ? await PasswordUtil.hash(password) : undefined;

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...updateData,
        ...(hashedPassword && { password: hashedPassword }),
      },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    return plainToClass(UserResponseDto, user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Soft delete
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: { not: null } },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado o no está eliminado');
    }

    const restoredUser = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    return plainToClass(UserResponseDto, restoredUser);
  }

  /**
   * Get all categories (courses) assigned to a user
   */
  async getUserCategories(userId: string) {
    // Verify user exists
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(`Usuario no encontrado: ${userId}`);
    }

    // Get user's category purchases
    const categoryPurchases = await this.prisma.categoryPurchase.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            image: true,
            priceARS: true,
            priceUSD: true,
            isFree: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return categoryPurchases;
  }

  /**
   * Manually assign a course to a user (admin only)
   */
  async assignCourse(
    userId: string,
    categoryId: string,
    dto: AssignCourseDto,
  ) {
    // Verify user exists
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(`Usuario no encontrado: ${userId}`);
    }

    // Verify category exists
    const category = await this.prisma.videoCategory.findFirst({
      where: { id: categoryId, deletedAt: null },
    });

    if (!category) {
      throw new NotFoundException(`Categoría no encontrada: ${categoryId}`);
    }

    // Check if user already has access
    const existingAccess = await this.prisma.categoryPurchase.findUnique({
      where: {
        userId_categoryId: {
          userId,
          categoryId,
        },
      },
    });

    if (existingAccess) {
      throw new BadRequestException(
        `El usuario ya tiene acceso a la categoría "${category.name}"`,
      );
    }

    // Create category purchase (manual assignment)
    const categoryPurchase = await this.prisma.categoryPurchase.create({
      data: {
        userId,
        categoryId,
        amount: dto.amount,
        currency: dto.currency,
        paymentMethod: dto.paymentMethod || 'manual_assignment',
        paymentStatus: 'completed',
        isActive: true,
        expiresAt: null, // Permanent access
        // transactionId is null for manual assignments
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            image: true,
            priceARS: true,
            priceUSD: true,
            isFree: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return categoryPurchase;
  }

  /**
   * Remove course access from a user (admin only)
   */
  async removeCourseAccess(userId: string, categoryId: string) {
    // Verify the access exists
    const access = await this.prisma.categoryPurchase.findUnique({
      where: {
        userId_categoryId: {
          userId,
          categoryId,
        },
      },
      include: {
        category: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!access) {
      throw new NotFoundException(
        'El usuario no tiene acceso a esta categoría',
      );
    }

    // Delete the access
    await this.prisma.categoryPurchase.delete({
      where: {
        userId_categoryId: {
          userId,
          categoryId,
        },
      },
    });

    return {
      message: `Acceso al curso "${access.category.name}" eliminado exitosamente`,
    };
  }
}
