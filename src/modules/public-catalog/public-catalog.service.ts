import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/services';

/**
 * Catálogo público en formato chico y plano, pensado para que lo lea un LLM:
 * nombres en castellano, precios ya formateados y la URL a la que mandar.
 * Es la fuente de verdad de precios del chatbot — nunca se cachean en su
 * base de conocimiento porque un precio viejo es una promesa que hay que honrar.
 */

const SITE_URL = process.env.PUBLIC_SITE_URL ?? 'https://merygarcia.com.ar';

export interface CatalogItem {
  slug: string;
  nombre: string;
  descripcion: string | null;
  modalidad: string | null;
  precioARS: number;
  precioUSD: number;
  precioListaARS: number | null;
  enPromocion: boolean;
  descuentoPorcentaje: number | null;
  esGratis: boolean;
  cantidadVideos: number;
  url: string;
}

@Injectable()
export class PublicCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private toNumber(value: Prisma.Decimal | null): number | null {
    return value === null ? null : Number(value);
  }

  private serialize(c: {
    slug: string;
    name: string;
    description: string | null;
    modalidad: string | null;
    priceARS: Prisma.Decimal;
    priceUSD: Prisma.Decimal;
    originalPriceARS: Prisma.Decimal | null;
    isFree: boolean;
    _count: { videos: number };
  }): CatalogItem {
    const precioARS = Number(c.priceARS);
    const listaARS = this.toNumber(c.originalPriceARS);
    const enPromocion = listaARS !== null && listaARS > precioARS;

    return {
      slug: c.slug,
      nombre: c.name,
      descripcion: c.description,
      modalidad: c.modalidad,
      precioARS,
      precioUSD: Number(c.priceUSD),
      precioListaARS: listaARS,
      enPromocion,
      descuentoPorcentaje: enPromocion
        ? Math.round(((listaARS! - precioARS) / listaARS!) * 100)
        : null,
      esGratis: c.isFree,
      cantidadVideos: c._count.videos,
      url: `${SITE_URL}/cursos/${c.slug}`,
    };
  }

  private readonly select = {
    slug: true,
    name: true,
    description: true,
    modalidad: true,
    priceARS: true,
    priceUSD: true,
    originalPriceARS: true,
    isFree: true,
    _count: { select: { videos: true } },
  } as const;

  async listar(): Promise<{ moneda: string; actualizado: string; cursos: CatalogItem[] }> {
    const categories = await this.prisma.videoCategory.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { order: 'asc' },
      select: this.select,
    });

    return {
      moneda: 'ARS',
      actualizado: new Date().toISOString(),
      cursos: categories.map((c) => this.serialize(c)),
    };
  }

  async obtener(slug: string): Promise<CatalogItem> {
    const category = await this.prisma.videoCategory.findFirst({
      where: { slug, deletedAt: null, isActive: true },
      select: this.select,
    });
    if (!category) {
      throw new NotFoundException(`No existe una formación con el slug "${slug}"`);
    }
    return this.serialize(category);
  }
}
