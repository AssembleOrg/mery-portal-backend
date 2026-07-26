import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../shared/decorators';
import { PublicCatalogService } from './public-catalog.service';

/**
 * Feed público de formaciones y precios. Lo consume el chatbot (acción
 * `precios_cursos` / `catalogo_formaciones`) y cualquier integración que
 * necesite el catálogo sin autenticarse. Solo lectura.
 */
@ApiTags('public-catalog')
@Controller('public/catalog')
export class PublicCatalogController {
  constructor(private readonly catalog: PublicCatalogService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Listado de formaciones activas con precio vigente' })
  async listar() {
    return this.catalog.listar();
  }

  @Get(':slug')
  @Public()
  @ApiParam({ name: 'slug', example: 'estilismo-de-cejas' })
  @ApiOperation({ summary: 'Precio y datos de una formación puntual' })
  async obtener(@Param('slug') slug: string) {
    return this.catalog.obtener(slug);
  }
}
