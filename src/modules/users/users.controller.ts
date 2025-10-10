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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as ApiResponseDoc,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto, UserQueryDto, AssignCourseDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles, Auditory } from '../../shared/decorators';
import { UserRole } from '../../shared/types';

@ApiTags('Usuarios')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @HttpCode(HttpStatus.CREATED)
  @Auditory({ action: 'CREATE', entity: 'User' })
  @ApiOperation({ summary: 'Crear nuevo usuario' })
  @ApiResponseDoc({
    status: 201,
    description: 'Usuario creado exitosamente',
    type: UserResponseDto,
  })
  @ApiResponseDoc({
    status: 409,
    description: 'El usuario ya existe',
  })
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiOperation({ summary: 'Obtener lista de usuarios con paginación' })
  @ApiResponseDoc({
    status: 200,
    description: 'Lista de usuarios obtenida exitosamente',
  })
  async findAll(@Query() query: UserQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiOperation({ summary: 'Obtener usuario por ID' })
  @ApiResponseDoc({
    status: 200,
    description: 'Usuario obtenido exitosamente',
    type: UserResponseDto,
  })
  @ApiResponseDoc({
    status: 404,
    description: 'Usuario no encontrado',
  })
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @Auditory({ action: 'UPDATE', entity: 'User' })
  @ApiOperation({ summary: 'Actualizar usuario' })
  @ApiResponseDoc({
    status: 200,
    description: 'Usuario actualizado exitosamente',
    type: UserResponseDto,
  })
  @ApiResponseDoc({
    status: 404,
    description: 'Usuario no encontrado',
  })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Auditory({ action: 'DELETE', entity: 'User' })
  @ApiOperation({ summary: 'Eliminar usuario (soft delete)' })
  @ApiResponseDoc({
    status: 204,
    description: 'Usuario eliminado exitosamente',
  })
  @ApiResponseDoc({
    status: 404,
    description: 'Usuario no encontrado',
  })
  async remove(@Param('id') id: string): Promise<void> {
    return this.usersService.remove(id);
  }

  @Patch(':id/restore')
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @Auditory({ action: 'RESTORE', entity: 'User' })
  @ApiOperation({ summary: 'Restaurar usuario eliminado' })
  @ApiResponseDoc({
    status: 200,
    description: 'Usuario restaurado exitosamente',
    type: UserResponseDto,
  })
  @ApiResponseDoc({
    status: 404,
    description: 'Usuario no encontrado o no está eliminado',
  })
  async restore(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.restore(id);
  }

  /**
   * Get all categories (courses) assigned to a user
   */
  @Get(':userId/categories')
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiOperation({ summary: 'Obtener categorías/cursos asignados a un usuario' })
  @ApiResponseDoc({
    status: 200,
    description: 'Lista de categorías del usuario obtenida exitosamente',
  })
  @ApiResponseDoc({
    status: 404,
    description: 'Usuario no encontrado',
  })
  async getUserCategories(@Param('userId') userId: string) {
    const categories = await this.usersService.getUserCategories(userId);
    return {
      success: true,
      data: categories,
      count: categories.length,
    };
  }

  /**
   * Manually assign a course to a user
   */
  @Post(':userId/categories/:categoryId')
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @HttpCode(HttpStatus.CREATED)
  @Auditory({ action: 'ASSIGN_COURSE', entity: 'CategoryPurchase' })
  @ApiOperation({ summary: 'Asignar curso/categoría a un usuario manualmente' })
  @ApiResponseDoc({
    status: 201,
    description: 'Curso asignado exitosamente',
  })
  @ApiResponseDoc({
    status: 400,
    description: 'El usuario ya tiene acceso a esta categoría',
  })
  @ApiResponseDoc({
    status: 404,
    description: 'Usuario o categoría no encontrado',
  })
  async assignCourse(
    @Param('userId') userId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: AssignCourseDto,
  ) {
    const result = await this.usersService.assignCourse(userId, categoryId, dto);
    return {
      success: true,
      message: 'Curso asignado exitosamente',
      data: result,
    };
  }

  /**
   * Remove course access from a user
   */
  @Delete(':userId/categories/:categoryId')
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @HttpCode(HttpStatus.OK)
  @Auditory({ action: 'REMOVE_COURSE', entity: 'CategoryPurchase' })
  @ApiOperation({ summary: 'Quitar acceso a un curso/categoría de un usuario' })
  @ApiResponseDoc({
    status: 200,
    description: 'Acceso al curso eliminado exitosamente',
  })
  @ApiResponseDoc({
    status: 404,
    description: 'Usuario no tiene acceso a esta categoría',
  })
  async removeCourse(
    @Param('userId') userId: string,
    @Param('categoryId') categoryId: string,
  ) {
    const result = await this.usersService.removeCourseAccess(userId, categoryId);
    return {
      success: true,
      ...result,
    };
  }
}
