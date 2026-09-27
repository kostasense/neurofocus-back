import {
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
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

import { EvaluationsService } from './evaluations.service.js';
import { CreateEvaluationDto } from './dto/create-evaluation.dto.js';
import { StartInstrumentDto } from './dto/start-instrument.dto.js';
import { SubmitInstrumentDto } from './dto/submit-instrument.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

const ROL_PACIENTE = 1;
const ROL_PSICOLOGO = 2;
const ROL_ADMINISTRADOR = 3;

interface RequestWithUser extends ExpressRequest {
  user: {
    userId: number;
    correo: string;
    rol: number;
  };
}

@ApiTags('Evaluaciones')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('evaluations')
export class EvaluationsController {
  constructor(
    private readonly evaluationsService:
      EvaluationsService,
  ) {}

  @ApiOperation({
    summary: 'Listar los instrumentos activos',
  })
  @Get('instruments')
  findInstruments() {
    return this.evaluationsService.findInstruments();
  }

  @ApiOperation({
    summary: 'Crear una nueva evaluación',
  })
  @Roles(
    ROL_PACIENTE,
    ROL_PSICOLOGO,
    ROL_ADMINISTRADOR,
  )
  @Post()
  create(
    @Body() dto: CreateEvaluationDto,
    @Request() req: RequestWithUser,
  ) {
    return this.evaluationsService.createEvaluation(
      dto.idPaciente,
      req.user,
    );
  }

  @ApiOperation({
    summary: 'Consultar las evaluaciones de un paciente',
  })
  @Get('patient/:patientId')
  findByPatient(
    @Param('patientId', ParseIntPipe)
    patientId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.evaluationsService.findByPatient(
      patientId,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Consultar evaluaciones de pacientes asignados al psicólogo',
  })
  @Roles(
    ROL_PSICOLOGO,
    ROL_ADMINISTRADOR,
  )
  @Get('psychologist/:psychologistId')
  findAssignedToPsychologist(
    @Param('psychologistId', ParseIntPipe)
    psychologistId: number,
    @Query(
      'pendingReview',
      new ParseBoolPipe({ optional: true }),
    )
    pendingReview: boolean | undefined,
    @Request() req: RequestWithUser,
  ) {
    return this.evaluationsService
      .findAssignedToPsychologist(
        psychologistId,
        req.user,
        pendingReview ?? false,
      );
  }

  @ApiOperation({
    summary:
      'Consultar una aplicación de instrumento y sus respuestas',
  })
  @Get('applications/:applicationId')
  getApplication(
    @Param('applicationId', ParseIntPipe)
    applicationId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.evaluationsService.getApplication(
      applicationId,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Enviar las respuestas y calcular el resultado del instrumento',
  })
  @Roles(ROL_PACIENTE)
  @Post('applications/:applicationId/submit')
  submitInstrument(
    @Param('applicationId', ParseIntPipe)
    applicationId: number,
    @Body() dto: SubmitInstrumentDto,
    @Request() req: RequestWithUser,
  ) {
    return this.evaluationsService.submitInstrument(
      applicationId,
      dto,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Abandonar una aplicación de instrumento en proceso',
  })
  @Roles(ROL_PACIENTE)
  @Patch('applications/:applicationId/abandon')
  abandonApplication(
    @Param('applicationId', ParseIntPipe)
    applicationId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.evaluationsService.abandonApplication(
      applicationId,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Iniciar un instrumento dentro de una evaluación',
  })
  @Roles(
    ROL_PACIENTE,
    ROL_PSICOLOGO,
    ROL_ADMINISTRADOR,
  )
  @Post(':id/instruments')
  startInstrument(
    @Param('id', ParseIntPipe)
    idEvaluacion: number,
    @Body() dto: StartInstrumentDto,
    @Request() req: RequestWithUser,
  ) {
    return this.evaluationsService.startInstrument(
      idEvaluacion,
      dto.idInstrumento,
      req.user,
    );
  }

  @ApiOperation({
    summary: 'Cerrar una evaluación incompleta',
  })
  @Patch(':id/close-incomplete')
  closeIncomplete(
    @Param('id', ParseIntPipe)
    idEvaluacion: number,
    @Request() req: RequestWithUser,
  ) {
    return this.evaluationsService
      .closeIncompleteEvaluation(
        idEvaluacion,
        req.user,
      );
  }

  @ApiOperation({
    summary:
      'Marcar una evaluación como revisada por el psicólogo',
  })
  @Roles(ROL_PSICOLOGO)
  @Patch(':id/review')
  markReviewed(
    @Param('id', ParseIntPipe)
    idEvaluacion: number,
    @Request() req: RequestWithUser,
  ) {
    return this.evaluationsService.markReviewed(
      idEvaluacion,
      req.user,
    );
  }

  @ApiOperation({
    summary: 'Anular una evaluación',
  })
  @Roles(ROL_ADMINISTRADOR)
  @Patch(':id/cancel')
  cancelEvaluation(
    @Param('id', ParseIntPipe)
    idEvaluacion: number,
    @Request() req: RequestWithUser,
  ) {
    return this.evaluationsService.cancelEvaluation(
      idEvaluacion,
      req.user,
    );
  }

  /*
   * Esta ruta genérica debe permanecer al final para evitar
   * conflictos con /patient, /psychologist y /applications.
   */
  @ApiOperation({
    summary:
      'Consultar el resultado consolidado de una evaluación',
  })
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe)
    id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.evaluationsService.findById(
      id,
      req.user,
    );
  }
}