import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '~/shared/decorators';
import { JwtAuthGuard } from '~/shared/guards';
import { CreateProblemReportDto } from './dto';
import { ProblemReportService } from './problemReport.service';

@ApiTags('problem-report')
@Controller('problem-report')
export class ProblemReportController {
  constructor(private readonly problemReportService: ProblemReportService) {}

  @Post()
  @Public()
  @ApiOperation({ summary: 'Crear un nuevo reporte de problema' })
  @ApiResponse({ status: 201, description: 'Reporte de problema creado exitosamente' })
  async create(@Body() createProblemReportDto: CreateProblemReportDto) {
    return this.problemReportService.create(createProblemReportDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener todos los reportes de problemas' })
  @ApiResponse({
    status: 200,
    description: 'Lista de reportes de problemas obtenida exitosamente',
  })
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.problemReportService.findAll(page, limit);
  }
}
