import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';

interface RequestWithUser extends ExpressRequest {
  user: {
    userId: number;
    correo: string;
    rol: number;
  };
}

const ROL_ADMINISTRADOR = 3;

@ApiTags('Usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Registrar una nueva cuenta de paciente',
  })
  register(
    @Body() dto: RegisterDto,
  ) {
    return this.usersService.register(dto);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Crear un usuario desde administración',
  })
  @Roles(ROL_ADMINISTRADOR)
  @Post()
  create(
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.create(dto);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Listar usuarios, opcionalmente filtrados por rol',
  })
  @Roles(ROL_ADMINISTRADOR)
  @Get()
  findAll(
    @Query('idRol')
    idRol?: string,
  ) {
    return this.usersService.findAll(
      idRol
        ? Number(idRol)
        : undefined,
    );
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Consultar los datos públicos de un usuario',
  })
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe)
    id: number,
    @Request() req: RequestWithUser,
  ) {
    if (
      req.user.rol !== ROL_ADMINISTRADOR &&
      req.user.userId !== id
    ) {
      throw new ForbiddenException(
        'No puedes ver los datos de otro usuario',
      );
    }

    return this.usersService.findPublicById(id);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Actualizar los datos básicos de un usuario',
  })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe)
    id: number,
    @Body() dto: UpdateUserDto,
    @Request() req: RequestWithUser,
  ) {
    if (
      req.user.rol !== ROL_ADMINISTRADOR &&
      req.user.userId !== id
    ) {
      throw new ForbiddenException(
        'No puedes modificar los datos de otro usuario',
      );
    }

    return this.usersService.update(
      id,
      dto,
    );
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Cambiar la contraseña del usuario autenticado',
  })
  @Patch(':id/password')
  changePassword(
    @Param('id', ParseIntPipe)
    id: number,
    @Body() dto: ChangePasswordDto,
    @Request() req: RequestWithUser,
  ) {
    if (req.user.userId !== id) {
      throw new ForbiddenException(
        'Solo puedes cambiar tu propia contraseña',
      );
    }

    return this.usersService.changePassword(
      id,
      dto,
    );
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Desactivar una cuenta de usuario',
  })
  @Roles(ROL_ADMINISTRADOR)
  @Patch(':id/deactivate')
  deactivate(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.usersService.setActive(
      id,
      false,
    );
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Reactivar una cuenta de usuario',
  })
  @Roles(ROL_ADMINISTRADOR)
  @Patch(':id/reactivate')
  reactivate(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.usersService.setActive(
      id,
      true,
    );
  }
}