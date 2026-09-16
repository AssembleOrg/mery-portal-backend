import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { VideoNotesController } from './video-notes.controller';
import { VideoNotesService } from './video-notes.service';

@Module({
  controllers: [VideoNotesController],
  providers: [VideoNotesService, PrismaService],
  exports: [VideoNotesService],
})
export class VideoNotesModule {}
