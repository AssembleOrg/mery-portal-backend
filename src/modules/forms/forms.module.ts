import { Module } from '@nestjs/common';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';
import { PrismaService } from '~/shared/services';

@Module({
  controllers: [FormsController],
  providers: [FormsService, PrismaService],
  exports: [FormsService],
})
export class FormsModule {}
