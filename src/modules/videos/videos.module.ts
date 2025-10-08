import { Module } from '@nestjs/common';
import { VideosService } from './videos.service';
import { VideosController } from './videos.controller';
import { PrismaService } from '../../shared/services';
import { VimeoModule } from '../vimeo';

@Module({
  imports: [VimeoModule],
  controllers: [VideosController],
  providers: [VideosService, PrismaService],
  exports: [VideosService],
})
export class VideosModule {}
