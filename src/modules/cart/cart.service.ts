import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CartResponseDto } from './dto';
import { plainToClass } from 'class-transformer';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get or create cart for a user
   */
  async getOrCreateCart(userId: string): Promise<CartResponseDto> {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                image: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  image: true,
                  description: true,
                },
              },
            },
          },
        },
      });
    }

    return this.formatCartResponse(cart);
  }

  /**
   * Add category/course to cart
   */
  async addToCart(userId: string, categoryId: string): Promise<CartResponseDto> {
    // Check if category exists and is active
    const category = await this.prisma.videoCategory.findUnique({
      where: { id: categoryId, deletedAt: null },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    if (!category.isActive) {
      throw new BadRequestException('Esta categoría no está disponible');
    }

    // Check if user already purchased this category
    const existingPurchase = await this.prisma.categoryPurchase.findUnique({
      where: {
        userId_categoryId: { userId, categoryId },
      },
    });

    if (existingPurchase) {
      throw new ConflictException('Ya compraste este curso');
    }

    // Get or create cart
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
      });
    }

    // Check if item already in cart
    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_categoryId: { cartId: cart.id, categoryId },
      },
    });

    if (existingItem) {
      throw new ConflictException('Este curso ya está en tu carrito');
    }

    // Add item to cart with current prices (snapshot)
    await this.prisma.cartItem.create({
      data: {
        cartId: cart.id,
        categoryId,
        priceARS: category.priceARS,
        priceUSD: category.priceUSD,
      },
    });

    return this.getOrCreateCart(userId);
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(userId: string, itemId: string): Promise<CartResponseDto> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      throw new NotFoundException('Carrito no encontrado');
    }

    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId: cart.id,
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Item no encontrado en el carrito');
    }

    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    return this.getOrCreateCart(userId);
  }

  /**
   * Clear entire cart
   */
  async clearCart(userId: string): Promise<{ message: string }> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      throw new NotFoundException('Carrito no encontrado');
    }

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return { message: 'Carrito vaciado exitosamente' };
  }

  /**
   * Get cart summary (for checkout)
   */
  async getCartSummary(userId: string): Promise<{
    itemCount: number;
    totalARS: number;
    totalUSD: number;
    items: Array<{
      categoryId: string;
      categoryName: string;
      priceARS: number;
      priceUSD: number;
    }>;
  }> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!cart) {
      return {
        itemCount: 0,
        totalARS: 0,
        totalUSD: 0,
        items: [],
      };
    }

    const totalARS = cart.items.reduce((sum, item) => sum + Number(item.priceARS), 0);
    const totalUSD = cart.items.reduce((sum, item) => sum + Number(item.priceUSD), 0);

    return {
      itemCount: cart.items.length,
      totalARS,
      totalUSD,
      items: cart.items.map(item => ({
        categoryId: item.categoryId,
        categoryName: item.category.name,
        priceARS: Number(item.priceARS),
        priceUSD: Number(item.priceUSD),
      })),
    };
  }

  /**
   * Format cart response with calculated totals
   */
  private formatCartResponse(cart: any): CartResponseDto {
    const totalARS = cart.items.reduce((sum, item) => sum + Number(item.priceARS), 0);
    const totalUSD = cart.items.reduce((sum, item) => sum + Number(item.priceUSD), 0);

    const response = {
      ...cart,
      itemCount: cart.items.length,
      totalARS,
      totalUSD,
      items: cart.items.map(item => ({
        ...item,
        priceARS: Number(item.priceARS),
        priceUSD: Number(item.priceUSD),
      })),
    };

    return plainToClass(CartResponseDto, response, { excludeExtraneousValues: true });
  }
}

