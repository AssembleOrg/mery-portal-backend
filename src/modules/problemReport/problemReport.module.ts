import { Module } from '@nestjs/common';
import { PrismaService } from '~/shared/services';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { ProblemReportController } from './problemReport.controller';
import { ProblemReportService } from './problemReport.service';

@Module({
  imports: [WhatsAppModule],
  controllers: [ProblemReportController],
  providers: [ProblemReportService, PrismaService],
  exports: [ProblemReportService],
})
export class ProblemReportModule {}
