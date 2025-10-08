import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddToCartDto {
  @ApiProperty({
    example: 'clx123...',
    description: 'ID de la categoría/curso a agregar al carrito',
  })
  @IsString()
  @IsNotEmpty()
  categoryId: string;
}

