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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { AppointmentsService } from './appointments.service.js';
import { CreateScheduleDto } from './dto/create-schedule.dto.js';
import { UpdateScheduleDto } from './dto/update-schedule.dto.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto.js';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto.js';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto.js';
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

@ApiTags('Citas')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService:
      AppointmentsService,
  ) {}

  /* Horarios */

  @ApiOperation({ summary: 'Listar horarios del psicólogo.' })
  @Get('schedules/psychologist/:psychologistId')
  findSchedules(
    @Param('psychologistId', ParseIntPipe)
    psychologistId: number,
    @Query(
      'includeInactive',
      new ParseBoolPipe({ optional: true }),
    )
    includeInactive?: boolean,
  ) {
    return this.appointmentsService
      .findSchedulesByPsychologist(
        psychologistId,
        includeInactive ?? false,
      );
  }

  @ApiOperation({ summary: 'Crear bloque semanal.' })
  @Roles(ROL_PSICOLOGO, ROL_ADMINISTRADOR)
  @Post('schedules/psychologist/:psychologistId')
  createSchedule(
    @Param('psychologistId', ParseIntPipe)
    psychologistId: number,
    @Body() dto: CreateScheduleDto,
    @Request() req: RequestWithUser,
  ) {
    return this.appointmentsService.createSchedule(
      psychologistId,
      dto,
      req.user,
    );
  }

  @ApiOperation({ summary: 'Actualizar bloque semanal.' })
  @Roles(ROL_PSICOLOGO, ROL_ADMINISTRADOR)
  @Patch('schedules/:scheduleId')
  updateSchedule(
    @Param('scheduleId', ParseIntPipe)
    scheduleId: number,
    @Body() dto: UpdateScheduleDto,
    @Request() req: RequestWithUser,
  ) {
    return this.appointmentsService.updateSchedule(
      scheduleId,
      dto,
      req.user,
    );
  }

  @ApiOperation({ summary: 'Desactivar bloque semanal.' })
  @Roles(ROL_PSICOLOGO, ROL_ADMINISTRADOR)
  @Patch('schedules/:scheduleId/deactivate')
  deactivateSchedule(
    @Param('scheduleId', ParseIntPipe)
    scheduleId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.appointmentsService
      .deactivateSchedule(
        scheduleId,
        req.user,
      );
  }

  /* Citas */

  @ApiOperation({ summary: 'Crear una cita.' })
  @Roles(
    ROL_PACIENTE,
    ROL_PSICOLOGO,
    ROL_ADMINISTRADOR,
  )
  @Post()
  createAppointment(
    @Body() dto: CreateAppointmentDto,
    @Request() req: RequestWithUser,
  ) {
    return this.appointmentsService
      .createAppointment(dto, req.user);
  }

  @ApiOperation({ summary: 'Consultar citas del paciente.' })
  @Get('patient/:patientId')
  findPatientAppointments(
    @Param('patientId', ParseIntPipe)
    patientId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.appointmentsService.findByPatient(
      patientId,
      req.user,
    );
  }

  @ApiOperation({ summary: 'Consultar agenda del psicologo.' })
  @Roles(ROL_PSICOLOGO, ROL_ADMINISTRADOR)
  @Get('psychologist/:psychologistId')
  findPsychologistAppointments(
    @Param('psychologistId', ParseIntPipe)
    psychologistId: number,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Request() req: RequestWithUser,
  ) {
    return this.appointmentsService
      .findByPsychologist(
        psychologistId,
        req.user,
        from,
        to,
      );
  }

  @ApiOperation({ summary: 'Actualizar estado de la cita.' })
  @Roles(ROL_PSICOLOGO, ROL_ADMINISTRADOR)
  @Patch(':appointmentId/status')
  updateStatus(
    @Param('appointmentId', ParseIntPipe)
    appointmentId: number,
    @Body() dto: UpdateAppointmentStatusDto,
    @Request() req: RequestWithUser,
  ) {
    return this.appointmentsService.updateStatus(
      appointmentId,
      dto,
      req.user,
    );
  }

  @ApiOperation({ summary: 'Cancelar cita.' })
  @Patch(':appointmentId/cancel')
  cancelAppointment(
    @Param('appointmentId', ParseIntPipe)
    appointmentId: number,
    @Body() dto: CancelAppointmentDto,
    @Request() req: RequestWithUser,
  ) {
    return this.appointmentsService
      .cancelAppointment(
        appointmentId,
        dto,
        req.user,
      );
  }

  @ApiOperation({ summary: 'Reprogramar cita.' })
  @Patch(':appointmentId/reschedule')
  rescheduleAppointment(
    @Param('appointmentId', ParseIntPipe)
    appointmentId: number,
    @Body() dto: RescheduleAppointmentDto,
    @Request() req: RequestWithUser,
  ) {
    return this.appointmentsService
      .rescheduleAppointment(
        appointmentId,
        dto,
        req.user,
      );
  }

  @ApiOperation({ summary: 'Obtener dashboard de citas.' })
  @Roles(ROL_PSICOLOGO, ROL_ADMINISTRADOR)
  @Get('dashboard/psychologist/:psychologistId')
  findDashboardAppointments(
    @Param('psychologistId', ParseIntPipe)
    psychologistId: number,

    @Query('from')
    from: string | undefined,

    @Query('to')
    to: string | undefined,

    @Request()
    req: RequestWithUser,
  ) {
    return this.appointmentsService
      .findDashboardAppointments(
        psychologistId,
        req.user,
        from,
        to,
      );
  }

  @ApiOperation({ summary: 'Consultar cita por ID.' })
  @Get(':appointmentId')
  findOne(
    @Param('appointmentId', ParseIntPipe)
    appointmentId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.appointmentsService
      .findAppointmentById(
        appointmentId,
        req.user,
      );
  }
}