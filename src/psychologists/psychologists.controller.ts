import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
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

import { PsychologistsService } from './psychologists.service.js';
import { UpdatePsychologistDto } from './dto/update-psychologist.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

const ROL_PSICOLOGO = 2;
const ROL_ADMINISTRADOR = 3;

interface RequestWithUser extends ExpressRequest {
  user: {
    userId: number;
    correo: string;
    rol: number;
  };
}

@ApiTags('Psicólogos')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('psychologists')
export class PsychologistsController {
  constructor(
    private readonly psychologistsService:
      PsychologistsService,
  ) {}

  @ApiOperation({
    summary: 'Listar psicólogos',
  })
  @Get()
  findAll(
    @Query(
      'soloActivosParaCitas',
      new ParseBoolPipe({ optional: true }),
    )
    soloActivosParaCitas?: boolean,
  ) {
    return this.psychologistsService.findAll(
      soloActivosParaCitas ?? false,
    );
  }

  /*
   * Las rutas específicas deben colocarse antes de @Get(':id')
   * para evitar que "dashboard" u otros segmentos se interpreten como ID.
   */
  @ApiOperation({
    summary:
      'Consultar el dashboard de pacientes del psicólogo',
  })
  @Roles(
    ROL_PSICOLOGO,
    ROL_ADMINISTRADOR,
  )
  @Get(':id/dashboard/patients')
  findDashboardPatients(
    @Param('id', ParseIntPipe)
    idPsicologo: number,
    @Request() req: RequestWithUser,
  ) {
    const esAdministrador =
      req.user.rol === ROL_ADMINISTRADOR;

    if (
      !esAdministrador &&
      req.user.userId !== idPsicologo
    ) {
      throw new ForbiddenException(
        'No puedes consultar el dashboard de otro psicólogo',
      );
    }

    return this.psychologistsService
      .findDashboardPatients(idPsicologo);
  }

  @ApiOperation({
    summary: 'Consultar el perfil de un psicólogo',
  })
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.psychologistsService.findById(id);
  }

  @ApiOperation({
    summary:
      'Actualizar la información profesional de un psicólogo',
  })
  @Roles(
    ROL_PSICOLOGO,
    ROL_ADMINISTRADOR,
  )
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe)
    id: number,
    @Body() dto: UpdatePsychologistDto,
    @Request() req: RequestWithUser,
  ) {
    const esAdministrador =
      req.user.rol === ROL_ADMINISTRADOR;

    if (
      !esAdministrador &&
      req.user.userId !== id
    ) {
      throw new ForbiddenException(
        'No puedes modificar a otro psicólogo',
      );
    }

    return this.psychologistsService.update(
      id,
      dto,
    );
  }

  @ApiOperation({
    summary:
      'Activar o desactivar la disponibilidad global del chat',
  })
  @Roles(
    ROL_PSICOLOGO,
    ROL_ADMINISTRADOR,
  )
  @Patch(':id/chat/:disponible')
  setChatDisponible(
    @Param('id', ParseIntPipe)
    id: number,
    @Param('disponible', ParseBoolPipe)
    disponible: boolean,
    @Request() req: RequestWithUser,
  ) {
    const esAdministrador =
      req.user.rol === ROL_ADMINISTRADOR;

    if (
      !esAdministrador &&
      req.user.userId !== id
    ) {
      throw new ForbiddenException(
        'No puedes modificar el chat de otro psicólogo',
      );
    }

    return this.psychologistsService
      .setChatDisponible(
        id,
        disponible,
      );
  }

  @ApiOperation({
    summary:
      'Activar o desactivar al psicólogo para recibir citas',
  })
  @Roles(
    ROL_PSICOLOGO,
    ROL_ADMINISTRADOR,
  )
  @Patch(':id/appointments/:activo')
  setActivoParaCitas(
    @Param('id', ParseIntPipe)
    id: number,
    @Param('activo', ParseBoolPipe)
    activo: boolean,
    @Request() req: RequestWithUser,
  ) {
    const esAdministrador =
      req.user.rol === ROL_ADMINISTRADOR;

    if (
      !esAdministrador &&
      req.user.userId !== id
    ) {
      throw new ForbiddenException(
        'No puedes modificar a otro psicólogo',
      );
    }

    return this.psychologistsService
      .setActivoParaCitas(
        id,
        activo,
      );
  }
}