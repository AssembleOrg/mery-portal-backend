import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { PasswordUtil } from '../../shared/utils';
import { PaginatedResponse } from '../../shared/types';
import { CreateUserDto, UpdateUserDto, UserResponseDto, UserQueryDto } from './dto';
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
}
