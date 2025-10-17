import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto, CategoryQueryDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '~/shared/guards';
import { Roles, Public } from '~/shared/decorators';
import { UserRole, PaginatedResponse } from '~/shared/types';

@ApiTags('categories')
@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Crear una nueva categoría (Admin/SubAdmin)' })
  @ApiResponse({ status: 201, description: 'Categoría creada exitosamente', type: CategoryResponseDto })
  @ApiResponse({ status: 409, description: 'El slug ya existe' })
  async create(@Body() createCategoryDto: CreateCategoryDto): Promise<CategoryResponseDto> {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get('all')
  @Public()
  @ApiOperation({ summary: 'Listar TODAS las categorías activas sin paginación (para admins)' })
  @ApiResponse({ status: 200, description: 'Lista completa de categorías activas', type: [CategoryResponseDto] })
  async findAllNoPagination(): Promise<CategoryResponseDto[]> {
    return this.categoriesService.findAllActive();
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Listar todas las categorías/cursos (Público)' })
  @ApiResponse({ status: 200, description: 'Lista de categorías/cursos', type: [CategoryResponseDto] })
  async findAll(@Query() query: CategoryQueryDto, @Req() request: any): Promise<PaginatedResponse<CategoryResponseDto>> {
    const userId = request.user?.sub;
    return this.categoriesService.findAll(query, userId);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Obtener una categoría/curso por ID o slug (Público)' })
  @ApiParam({ name: 'id', description: 'ID o slug de la categoría/curso' })
  @ApiResponse({ status: 200, description: 'Categoría/curso encontrada', type: CategoryResponseDto })
  @ApiResponse({ status: 404, description: 'Categoría/curso no encontrada' })
  async findOne(@Param('id') id: string, @Req() request: any): Promise<CategoryResponseDto> {
    const userId = request.user?.sub;
    return this.categoriesService.findOne(id, userId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Actualizar una categoría (Admin/SubAdmin)' })
  @ApiParam({ name: 'id', description: 'ID de la categoría' })
  @ApiResponse({ status: 200, description: 'Categoría actualizada exitosamente', type: CategoryResponseDto })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  @ApiResponse({ status: 409, description: 'El slug ya existe' })
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Eliminar una categoría (Solo Admin)' })
  @ApiParam({ name: 'id', description: 'ID de la categoría' })
  @ApiResponse({ status: 200, description: 'Categoría eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  @ApiResponse({ status: 409, description: 'No se puede eliminar una categoría con videos' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.categoriesService.remove(id);
    return { message: 'Categoría eliminada exitosamente' };
  }
}

