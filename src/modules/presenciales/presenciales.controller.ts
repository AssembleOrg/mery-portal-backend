import { 
  Controller, 
  Get, 
  Post, 
  Put,
  Patch,
  Body, 
  Param, 
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PresencialesService } from './presenciales.service';
import { 
  CreatePresencialPollDto, 
  UpdatePresencialPollDto, 
  VotePresencialPollDto,
  PresencialPollResponseDto,
  PresencialVoteResponseDto,
} from './dto';
import { JwtAuthGuard, RolesGuard } from '~/shared/guards';
import { Roles } from '~/shared/decorators';
import { UserRole, PaginatedResponse } from '~/shared/types';
import { PresencialPollQueryDto } from './dto/presencial-poll-query.dto';

@ApiTags('presenciales')
@Controller('presenciales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PresencialesController {
  constructor(private readonly presencialesService: PresencialesService) {}

  @Get('polls')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Obtener todas las encuestas' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de encuestas',
    type: [PresencialPollResponseDto]
  })
  async findAll(
    @Query() query: PresencialPollQueryDto,
    @Req() request: any,
  ): Promise<PaginatedResponse<PresencialPollResponseDto>> {
    const userId = request.user?.sub;
    return this.presencialesService.findAll(query, userId);
  }

  @Post('polls')
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Crear una nueva encuesta (Admin/SubAdmin)' })
  @ApiResponse({ 
    status: 201, 
    description: 'Encuesta creada exitosamente', 
    type: PresencialPollResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async create(@Body() createPollDto: CreatePresencialPollDto): Promise<PresencialPollResponseDto> {
    return this.presencialesService.create(createPollDto);
  }

  @Put('polls/:id')
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Actualizar una encuesta (Admin/SubAdmin)' })
  @ApiParam({ name: 'id', description: 'ID de la encuesta' })
  @ApiResponse({ 
    status: 200, 
    description: 'Encuesta actualizada exitosamente', 
    type: PresencialPollResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Encuesta no encontrada' })
  async update(
    @Param('id') id: string,
    @Body() updatePollDto: UpdatePresencialPollDto,
  ): Promise<PresencialPollResponseDto> {
    return this.presencialesService.update(id, updatePollDto);
  }

  @Patch('polls/:id/close')
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cerrar una encuesta (Admin/SubAdmin)' })
  @ApiParam({ name: 'id', description: 'ID de la encuesta' })
  @ApiResponse({ 
    status: 200, 
    description: 'Encuesta cerrada exitosamente', 
    type: PresencialPollResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Encuesta no encontrada' })
  async close(@Param('id') id: string): Promise<PresencialPollResponseDto> {
    return this.presencialesService.close(id);
  }

  @Get('polls/:id/votes')
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Obtener votos de una encuesta (Admin/SubAdmin)' })
  @ApiParam({ name: 'id', description: 'ID de la encuesta' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de votos',
    type: [PresencialVoteResponseDto]
  })
  @ApiResponse({ status: 404, description: 'Encuesta no encontrada' })
  async getVotes(@Param('id') id: string): Promise<{ data: PresencialVoteResponseDto[]; meta: { total: number } }> {
    return this.presencialesService.getVotes(id);
  }

  @Post('polls/:pollId/vote')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Votar en una encuesta' })
  @ApiParam({ name: 'pollId', description: 'ID de la encuesta' })
  @ApiResponse({ 
    status: 201, 
    description: 'Voto registrado exitosamente', 
    type: PresencialVoteResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Encuesta cerrada o fecha límite pasada' })
  @ApiResponse({ status: 403, description: 'Usuario no tiene permiso para votar' })
  @ApiResponse({ status: 404, description: 'Encuesta u opción no encontrada' })
  async vote(
    @Param('pollId') pollId: string,
    @Body() voteDto: VotePresencialPollDto,
    @Req() request: any,
  ): Promise<PresencialVoteResponseDto> {
    const userId = request.user?.sub;
    if (!userId) {
      throw new Error('Usuario no autenticado');
    }
    return this.presencialesService.vote(pollId, userId, voteDto);
  }

  @Get('polls/:id/stats')
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Obtener estadísticas de una encuesta (Admin/SubAdmin)' })
  @ApiParam({ name: 'id', description: 'ID de la encuesta' })
  @ApiResponse({ 
    status: 200, 
    description: 'Estadísticas de la encuesta',
    schema: {
      type: 'object',
      properties: {
        poll_id: { type: 'string' },
        total_votes: { type: 'number' },
        votes_by_option: { 
          type: 'object',
          additionalProperties: { type: 'number' }
        },
        unique_voters: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Encuesta no encontrada' })
  async getStats(@Param('id') id: string): Promise<{
    poll_id: string;
    total_votes: number;
    votes_by_option: Record<string, number>;
    unique_voters: number;
  }> {
    return this.presencialesService.getStats(id);
  }
}

