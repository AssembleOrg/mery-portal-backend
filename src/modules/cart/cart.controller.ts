import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as ApiResponseDoc,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto, CartResponseDto } from './dto';
import { JwtAuthGuard } from '../../shared/guards';
import { CurrentUser } from '../../shared/decorators';
import type { JwtPayload } from '../../shared/types';

@ApiTags('Carrito de Compras')
@Controller('cart')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener carrito del usuario actual' })
  @ApiResponseDoc({
    status: 200,
    description: 'Carrito obtenido exitosamente',
    type: CartResponseDto,
  })
  async getCart(@CurrentUser() user: JwtPayload): Promise<CartResponseDto> {
    return this.cartService.getOrCreateCart(user.sub);
  }

  @Post('add')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Agregar curso al carrito' })
  @ApiResponseDoc({
    status: 200,
    description: 'Curso agregado al carrito exitosamente',
    type: CartResponseDto,
  })
  @ApiResponseDoc({
    status: 404,
    description: 'Categoría no encontrada',
  })
  @ApiResponseDoc({
    status: 409,
    description: 'El curso ya está en el carrito o ya fue comprado',
  })
  async addToCart(
    @CurrentUser() user: JwtPayload,
    @Body() addToCartDto: AddToCartDto,
  ): Promise<CartResponseDto> {
    return this.cartService.addToCart(user.sub, addToCartDto.categoryId);
  }

  @Delete('items/:itemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar item del carrito' })
  @ApiResponseDoc({
    status: 200,
    description: 'Item eliminado del carrito exitosamente',
    type: CartResponseDto,
  })
  @ApiResponseDoc({
    status: 404,
    description: 'Item no encontrado',
  })
  async removeFromCart(
    @CurrentUser() user: JwtPayload,
    @Param('itemId') itemId: string,
  ): Promise<CartResponseDto> {
    return this.cartService.removeFromCart(user.sub, itemId);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vaciar carrito completo' })
  @ApiResponseDoc({
    status: 200,
    description: 'Carrito vaciado exitosamente',
  })
  async clearCart(@CurrentUser() user: JwtPayload): Promise<{ message: string }> {
    return this.cartService.clearCart(user.sub);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Obtener resumen del carrito para checkout' })
  @ApiResponseDoc({
    status: 200,
    description: 'Resumen del carrito obtenido exitosamente',
  })
  async getCartSummary(@CurrentUser() user: JwtPayload) {
    return this.cartService.getCartSummary(user.sub);
  }
}

