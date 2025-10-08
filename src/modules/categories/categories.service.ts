import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '~/shared/services';
import { PaginatedResponse } from '~/shared/types';
import { CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto, CategoryQueryDto } from './dto';
import { plainToClass } from 'class-transformer';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const { slug, ...categoryData } = createCategoryDto;

    // Check if slug already exists
    const existingSlug = await this.prisma.videoCategory.findUnique({
      where: { slug },
    });

    if (existingSlug) {
      throw new ConflictException('El slug ya existe');
    }

    // Create category
    const category = await this.prisma.videoCategory.create({
      data: {
        ...categoryData,
        slug,
      },
    });

    // Convert Decimal to number for both currencies
    const categoryWithNumberPrices = {
      ...category,
      priceARS: Number(category.priceARS),
      priceUSD: Number(category.priceUSD),
    };

    return plainToClass(CategoryResponseDto, categoryWithNumberPrices, { excludeExtraneousValues: true });
  }

  async findAll(query: CategoryQueryDto, userId?: string): Promise<PaginatedResponse<CategoryResponseDto>> {
    const { page = 1, limit = 10, search, sortBy = 'order', sortOrder = 'asc', isActive } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as any } },
          { description: { contains: search, mode: 'insensitive' as any } },
        ],
      }),
      ...(isActive !== undefined && { isActive }),
    };

    const [categories, total] = await Promise.all([
      this.prisma.videoCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder as any },
        include: {
          _count: {
            select: { videos: true },
          },
        },
      }),
      this.prisma.videoCategory.count({ where }),
    ]);

    // Transform to DTOs and add video count + user access
    const categoriesWithExtras = await Promise.all(
      categories.map(async (category) => {
        const categoryWithNumberPrices = {
          ...category,
          priceARS: Number(category.priceARS),
          priceUSD: Number(category.priceUSD),
        };
        const categoryDto: any = plainToClass(CategoryResponseDto, categoryWithNumberPrices, { excludeExtraneousValues: true });
        categoryDto.videoCount = category._count.videos;
        
        // Check user access if userId provided
        if (userId) {
          categoryDto.hasAccess = await this.checkUserAccess(userId, category.id);
          categoryDto.isPurchased = categoryDto.hasAccess;
        }
        
        return categoryDto;
      }),
    );

    return {
      data: categoriesWithExtras,
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

  async findOne(identifier: string, userId?: string): Promise<CategoryResponseDto> {
    // Try to find by ID or slug
    const category = await this.prisma.videoCategory.findFirst({
      where: {
        OR: [
          { id: identifier },
          { slug: identifier },
        ],
        deletedAt: null,
      },
      include: {
        _count: {
          select: { videos: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    const categoryWithNumberPrices = {
      ...category,
      priceARS: Number(category.priceARS),
      priceUSD: Number(category.priceUSD),
    };

    const categoryDto: any = plainToClass(CategoryResponseDto, categoryWithNumberPrices, { excludeExtraneousValues: true });
    categoryDto.videoCount = category._count.videos;

    // Check user access if userId provided
    if (userId) {
      categoryDto.hasAccess = await this.checkUserAccess(userId, category.id);
      categoryDto.isPurchased = categoryDto.hasAccess;
    }

    return categoryDto;
  }

  private async checkUserAccess(userId: string, categoryId: string): Promise<boolean> {
    const category = await this.prisma.videoCategory.findUnique({
      where: { id: categoryId },
      select: { isFree: true },
    });

    if (category?.isFree) {
      return true;
    }

    const purchase = await this.prisma.categoryPurchase.findUnique({
      where: {
        userId_categoryId: {
          userId,
          categoryId,
        },
      },
    });

    return purchase !== null && purchase.isActive && (!purchase.expiresAt || purchase.expiresAt > new Date());
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<CategoryResponseDto> {
    const category = await this.prisma.videoCategory.findUnique({
      where: { id, deletedAt: null },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    // If slug is being updated, check it doesn't exist
    if (updateCategoryDto.slug && updateCategoryDto.slug !== category.slug) {
      const existingSlug = await this.prisma.videoCategory.findUnique({
        where: { slug: updateCategoryDto.slug },
      });

      if (existingSlug) {
        throw new ConflictException('El slug ya existe');
      }
    }

    const updatedCategory = await this.prisma.videoCategory.update({
      where: { id },
      data: updateCategoryDto,
      include: {
        _count: {
          select: { videos: true },
        },
      },
    });

    const categoryWithNumberPrices = {
      ...updatedCategory,
      priceARS: Number(updatedCategory.priceARS),
      priceUSD: Number(updatedCategory.priceUSD),
    };

    const categoryDto: any = plainToClass(CategoryResponseDto, categoryWithNumberPrices, { excludeExtraneousValues: true });
    categoryDto.videoCount = updatedCategory._count.videos;

    return categoryDto;
  }

  async remove(id: string): Promise<void> {
    const category = await this.prisma.videoCategory.findUnique({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: { videos: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    // Check if category has videos
    if (category._count.videos > 0) {
      throw new ConflictException('No se puede eliminar una categoría que tiene videos asociados');
    }

    // Soft delete
    await this.prisma.videoCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

