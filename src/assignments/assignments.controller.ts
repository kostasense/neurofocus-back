import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { AssignmentsService } from './assignments.service.js';
import { CreateAssignmentDto } from './dto/create-assignment.dto.js';
import { CloseAssignmentDto } from './dto/close-assignment.dto.js';
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

@ApiTags('Asignaciones')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assignments')
export class AssignmentsController {
  constructor(
    private readonly assignmentsService:
      AssignmentsService,
  ) {}

  @ApiOperation({summary:'Asignar un psicólogo a un paciente'})
  @Roles(ROL_ADMINISTRADOR)
  @Post()
  create(@Body() dto: CreateAssignmentDto) {
    return this.assignmentsService.create(dto);
  }

  @ApiOperation({summary:'Cerrar una asignación paciente-psicólogo'})
  @Roles(ROL_ADMINISTRADOR)
  @Patch(':id/close')
  close(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CloseAssignmentDto,
  ) {
    return this.assignmentsService.close(id, dto);
  }

  @ApiOperation({summary:'Consultar la asignación principal vigente del paciente'})
  @Get('patient/:patientId/current')
  currentByPatient(
    @Param('patientId', ParseIntPipe)
    patientId: number,
    @Request() req: RequestWithUser,
  ) {
    const esAdministrador =
      req.user.rol === ROL_ADMINISTRADOR;

    if (!esAdministrador && req.user.userId !== patientId) {
      throw new ForbiddenException(
        'No puedes consultar la asignación de otro paciente',
      );
    }

    return this.assignmentsService.findCurrentByPatient(
      patientId,
    );
  }

  @ApiOperation({summary:'Consultar el historial de asignaciones del paciente'})
  @Get('patient/:patientId/history')
  historyByPatient(
    @Param('patientId', ParseIntPipe)
    patientId: number,
    @Request() req: RequestWithUser,
  ) {
    const esAdministrador =
      req.user.rol === ROL_ADMINISTRADOR;

    if (!esAdministrador && req.user.userId !== patientId) {
      throw new ForbiddenException(
        'No puedes consultar el historial de otro paciente',
      );
    }

    return this.assignmentsService.findHistoryByPatient(
      patientId,
    );
  }

  @ApiOperation({summary:'Listar pacientes asignados al psicólogo'})
  @Roles(ROL_PSICOLOGO, ROL_ADMINISTRADOR)
  @Get('psychologist/:psychologistId/patients')
  patientsByPsychologist(
    @Param('psychologistId', ParseIntPipe)
    psychologistId: number,
    @Request() req: RequestWithUser,
  ) {
    const esAdministrador =
      req.user.rol === ROL_ADMINISTRADOR;

    if (
      !esAdministrador &&
      req.user.userId !== psychologistId
    ) {
      throw new ForbiddenException(
        'No puedes consultar los pacientes de otro psicólogo',
      );
    }

    return this.assignmentsService.findActiveByPsychologist(
      psychologistId,
    );
  }
}