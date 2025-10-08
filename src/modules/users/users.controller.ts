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
import { CreateUserDto, UpdateUserDto, UserResponseDto, UserQueryDto } from './dto';
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
}
