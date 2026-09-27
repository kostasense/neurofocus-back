import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { PatientsService } from './patients.service.js';
import { UpdatePatientDto } from './dto/update-patient.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

const ROL_ADMINISTRADOR = 3;

interface RequestWithUser extends ExpressRequest {
  user: {
    userId: number;
    correo: string;
    rol: number;
  };
}

@ApiTags('Pacientes')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patients')
export class PatientsController {
  constructor(
    private readonly patientsService: PatientsService,
  ) {}

  @ApiOperation({
    summary: 'Listar todos los pacientes',
  })
  @Roles(ROL_ADMINISTRADOR)
  @Get()
  findAll() {
    return this.patientsService.findAll();
  }

  @ApiOperation({
    summary: 'Consultar el perfil de un paciente',
  })
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe)
    id: number,
    @Request() req: RequestWithUser,
  ) {
    const esAdministrador =
      req.user.rol === ROL_ADMINISTRADOR;

    if (
      !esAdministrador &&
      req.user.userId !== id
    ) {
      throw new ForbiddenException(
        'No puedes consultar a otro paciente',
      );
    }

    return this.patientsService.findById(id);
  }

  @ApiOperation({
    summary: 'Actualizar el perfil de un paciente',
  })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe)
    id: number,
    @Body() dto: UpdatePatientDto,
    @Request() req: RequestWithUser,
  ) {
    const esAdministrador =
      req.user.rol === ROL_ADMINISTRADOR;

    if (
      !esAdministrador &&
      req.user.userId !== id
    ) {
      throw new ForbiddenException(
        'No puedes modificar a otro paciente',
      );
    }

    return this.patientsService.update(
      id,
      dto,
    );
  }
}