import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
class CategoryNestedDto {
  @ApiProperty({ example: 'clx123...', description: 'ID de la categoría' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Curso de Cejas', description: 'Nombre de la categoría' })
  @Expose()
  name: string;

  @ApiProperty({ example: 'curso-cejas', description: 'Slug de la categoría' })
  @Expose()
  slug: string;

  @ApiProperty({ example: 'https://example.com/image.jpg', description: 'Imagen del curso' })
  @Expose()
  image?: string;

  @ApiProperty({ example: 'Descripción del curso', description: 'Descripción' })
  @Expose()
  description?: string;
}

@Exclude()
export class CartItemDto {
  @ApiProperty({ example: 'clx123...', description: 'ID del item en el carrito' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'clx456...', description: 'ID de la categoría' })
  @Expose()
  categoryId: string;

  @ApiProperty({ type: CategoryNestedDto, description: 'Información de la categoría/curso' })
  @Expose()
  @Type(() => CategoryNestedDto)
  category: CategoryNestedDto;

  @ApiProperty({ example: 89999.99, description: 'Precio en ARS al momento de agregar' })
  @Expose()
  priceARS: number;

  @ApiProperty({ example: 89.99, description: 'Precio en USD al momento de agregar' })
  @Expose()
  priceUSD: number;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Fecha de agregado' })
  @Expose()
  addedAt: Date;
}

@Exclude()
export class CartResponseDto {
  @ApiProperty({ example: 'clx123...', description: 'ID del carrito' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'clx456...', description: 'ID del usuario' })
  @Expose()
  userId: string;

  @ApiProperty({ type: [CartItemDto], description: 'Items en el carrito' })
  @Expose()
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @ApiProperty({ example: 3, description: 'Cantidad de items en el carrito' })
  @Expose()
  itemCount: number;

  @ApiProperty({ example: 269999.97, description: 'Total en ARS' })
  @Expose()
  totalARS: number;

  @ApiProperty({ example: 269.97, description: 'Total en USD' })
  @Expose()
  totalUSD: number;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Fecha de creación' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Fecha de actualización' })
  @Expose()
  updatedAt: Date;
}

