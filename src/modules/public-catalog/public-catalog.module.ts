import { Module } from '@nestjs/common';
import { PublicCatalogController } from './public-catalog.controller';
import { PublicCatalogService } from './public-catalog.service';
import { PrismaService } from '../../shared/services';

@Module({
  controllers: [PublicCatalogController],
  providers: [PublicCatalogService, PrismaService],
  exports: [PublicCatalogService],
})
export class PublicCatalogModule {}
