import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '~/shared/services';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { CreateProblemReportDto, ProblemReportResponse } from './dto';

@Injectable()
export class ProblemReportService {
  private readonly logger = new Logger(ProblemReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  async create(createProblemReportDto: CreateProblemReportDto) {
    try {
      const { recentRequests, ...dbData } = createProblemReportDto;
      const newReport = await this.prisma.problemReport.create({
        data: dbData,
      });

      this.whatsAppService
        .reportProblem({
          email: createProblemReportDto.email,
          phone: createProblemReportDto.phone,
          description: createProblemReportDto.description,
          recentRequests: createProblemReportDto.recentRequests,
        })
        .catch((err) => {
          this.logger.error('Error notificando reporte por WhatsApp', err);
        });

      return newReport;
    } catch (_error) {
      throw new InternalServerErrorException(
        'No se pudo registrar el problema. Intente nuevamente.',
      );
    }
  }

  async findAll(
    page?: number,
    limit?: number,
  ): Promise<{ data: ProblemReportResponse[]; total?: number } | ProblemReportResponse[]> {
    const skip = page && limit ? (page - 1) * limit : undefined;
    const take = limit;

    try {
      const [problemReports, total] = await Promise.all([
        this.prisma.problemReport.findMany({
          skip,
          take,
          orderBy: { createdAt: 'desc' },
        }),
        page && limit ? this.prisma.problemReport.count() : undefined,
      ]);

      const mappedReports = problemReports.map((report) =>
        plainToInstance(ProblemReportResponse, report, { excludeExtraneousValues: true }),
      );

      if (page && limit) {
        return {
          data: mappedReports,
          total,
        };
      }

      return mappedReports;
    } catch (_error) {
      throw new InternalServerErrorException(
        'No se pudieron obtener los reportes de problemas.',
      );
    }
  }
}
