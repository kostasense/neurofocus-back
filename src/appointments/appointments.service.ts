import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CreateScheduleDto } from './dto/create-schedule.dto.js';
import { UpdateScheduleDto } from './dto/update-schedule.dto.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto.js';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto.js';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto.js';

const ROL_PACIENTE = 1;
const ROL_PSICOLOGO = 2;
const ROL_ADMINISTRADOR = 3;

interface AuthenticatedUser {
  userId: number;
  correo: string;
  rol: number;
}

@Injectable()
export class AppointmentsService {
  constructor(private readonly db: DatabaseService) {}

  /* =========================
     HORARIOS
     ========================= */

  async findSchedulesByPsychologist(
    idPsicologo: number,
    incluirInactivos = false,
  ) {
    await this.ensurePsychologistExists(idPsicologo);

    return this.db.executeQuery(
      `SELECT
          id_horario,
          id_psicologo,
          dia_semana,
          hora_inicio,
          hora_fin,
          modalidad,
          activo
       FROM dbo.HorarioPsicologo
       WHERE id_psicologo = @idPsicologo
         AND (
           @incluirInactivos = 1
           OR activo = 1
         )
       ORDER BY
         dia_semana,
         hora_inicio`,
      [
        {
          name: 'idPsicologo',
          value: idPsicologo,
        },
        {
          name: 'incluirInactivos',
          value: incluirInactivos,
        },
      ],
    );
  }

  async findScheduleById(idHorario: number) {
    const rows = await this.db.executeQuery(
      `SELECT
          id_horario,
          id_psicologo,
          dia_semana,
          hora_inicio,
          hora_fin,
          modalidad,
          activo
       FROM dbo.HorarioPsicologo
       WHERE id_horario = @idHorario`,
      [
        {
          name: 'idHorario',
          value: idHorario,
        },
      ],
    );

    if (!rows[0]) {
      throw new NotFoundException(
        'Horario no encontrado',
      );
    }

    return rows[0];
  }

  async createSchedule(
    idPsicologo: number,
    dto: CreateScheduleDto,
    user: AuthenticatedUser,
  ) {
    this.ensurePsychologistOwnerOrAdmin(
      idPsicologo,
      user,
    );

    await this.ensurePsychologistExists(idPsicologo);

    this.validateTimeRange(
      dto.horaInicio,
      dto.horaFin,
    );

    const overlaps = await this.db.executeQuery(
      `SELECT id_horario
       FROM dbo.HorarioPsicologo
       WHERE id_psicologo = @idPsicologo
         AND dia_semana = @diaSemana
         AND activo = 1
         AND hora_inicio < @horaFin
         AND hora_fin > @horaInicio`,
      [
        {
          name: 'idPsicologo',
          value: idPsicologo,
        },
        {
          name: 'diaSemana',
          value: dto.diaSemana,
        },
        {
          name: 'horaInicio',
          value: dto.horaInicio,
        },
        {
          name: 'horaFin',
          value: dto.horaFin,
        },
      ],
    );

    if (overlaps[0]) {
      throw new ConflictException(
        'El horario se superpone con otro bloque activo',
      );
    }

    const rows = await this.db.executeQuery(
      `INSERT INTO dbo.HorarioPsicologo (
         id_psicologo,
         dia_semana,
         hora_inicio,
         hora_fin,
         modalidad
       )
       OUTPUT INSERTED.id_horario
       VALUES (
         @idPsicologo,
         @diaSemana,
         @horaInicio,
         @horaFin,
         @modalidad
       )`,
      [
        {
          name: 'idPsicologo',
          value: idPsicologo,
        },
        {
          name: 'diaSemana',
          value: dto.diaSemana,
        },
        {
          name: 'horaInicio',
          value: dto.horaInicio,
        },
        {
          name: 'horaFin',
          value: dto.horaFin,
        },
        {
          name: 'modalidad',
          value: dto.modalidad ?? 1,
        },
      ],
    );

    return this.findScheduleById(
      rows[0].id_horario,
    );
  }

  async updateSchedule(
    idHorario: number,
    dto: UpdateScheduleDto,
    user: AuthenticatedUser,
  ) {
    const current =
      await this.findScheduleById(idHorario);

    this.ensurePsychologistOwnerOrAdmin(
      current.id_psicologo,
      user,
    );

    const diaSemana =
      dto.diaSemana ?? current.dia_semana;

    const horaInicio =
      dto.horaInicio ?? current.hora_inicio;

    const horaFin =
      dto.horaFin ?? current.hora_fin;

    const modalidad =
      dto.modalidad ?? current.modalidad;

    const activo =
      dto.activo ?? current.activo;

    this.validateTimeRange(
      horaInicio,
      horaFin,
    );

    if (activo) {
      const overlaps = await this.db.executeQuery(
        `SELECT id_horario
         FROM dbo.HorarioPsicologo
         WHERE id_psicologo = @idPsicologo
           AND dia_semana = @diaSemana
           AND id_horario <> @idHorario
           AND activo = 1
           AND hora_inicio < @horaFin
           AND hora_fin > @horaInicio`,
        [
          {
            name: 'idPsicologo',
            value: current.id_psicologo,
          },
          {
            name: 'diaSemana',
            value: diaSemana,
          },
          {
            name: 'idHorario',
            value: idHorario,
          },
          {
            name: 'horaInicio',
            value: horaInicio,
          },
          {
            name: 'horaFin',
            value: horaFin,
          },
        ],
      );

      if (overlaps[0]) {
        throw new ConflictException(
          'El horario se superpone con otro bloque activo',
        );
      }
    }

    await this.db.executeQuery(
      `UPDATE dbo.HorarioPsicologo
       SET
         dia_semana = @diaSemana,
         hora_inicio = @horaInicio,
         hora_fin = @horaFin,
         modalidad = @modalidad,
         activo = @activo
       WHERE id_horario = @idHorario`,
      [
        {
          name: 'diaSemana',
          value: diaSemana,
        },
        {
          name: 'horaInicio',
          value: horaInicio,
        },
        {
          name: 'horaFin',
          value: horaFin,
        },
        {
          name: 'modalidad',
          value: modalidad,
        },
        {
          name: 'activo',
          value: activo,
        },
        {
          name: 'idHorario',
          value: idHorario,
        },
      ],
    );

    return this.findScheduleById(idHorario);
  }

  async deactivateSchedule(
    idHorario: number,
    user: AuthenticatedUser,
  ) {
    const schedule =
      await this.findScheduleById(idHorario);

    this.ensurePsychologistOwnerOrAdmin(
      schedule.id_psicologo,
      user,
    );

    await this.db.executeQuery(
      `UPDATE dbo.HorarioPsicologo
       SET activo = 0
       WHERE id_horario = @idHorario`,
      [
        {
          name: 'idHorario',
          value: idHorario,
        },
      ],
    );

    return this.findScheduleById(idHorario);
  }

  /* =========================
     CITAS
     ========================= */

  async findAppointmentById(
    idCita: number,
    user: AuthenticatedUser,
  ) {
    const rows = await this.db.executeQuery(
      `SELECT
          c.id_cita,
          c.id_paciente,
          paciente.nombre AS paciente,
          c.id_psicologo,
          psicologo.nombre AS psicologo,
          c.id_evaluacion,
          c.inicio,
          c.fin,
          c.modalidad,
          c.estado,
          c.creada_por,
          c.fecha_creacion,
          c.motivo_cancelacion,
          c.notas_agenda
       FROM dbo.Citas c
       INNER JOIN dbo.Usuarios paciente
         ON paciente.id_usuario = c.id_paciente
       INNER JOIN dbo.Usuarios psicologo
         ON psicologo.id_usuario = c.id_psicologo
       WHERE c.id_cita = @idCita`,
      [
        {
          name: 'idCita',
          value: idCita,
        },
      ],
    );

    const appointment = rows[0];

    if (!appointment) {
      throw new NotFoundException(
        'Cita no encontrada',
      );
    }

    this.ensureAppointmentAccess(
      appointment,
      user,
    );

    return appointment;
  }

  async findByPatient(
    idPaciente: number,
    user: AuthenticatedUser,
  ) {
    if (
      user.rol !== ROL_ADMINISTRADOR &&
      user.userId !== idPaciente
    ) {
      throw new ForbiddenException(
        'No puedes consultar las citas de otro paciente',
      );
    }

    return this.db.executeQuery(
      `SELECT
          c.id_cita,
          c.id_paciente,
          c.id_psicologo,
          u.nombre AS psicologo,
          c.id_evaluacion,
          c.inicio,
          c.fin,
          c.modalidad,
          c.estado,
          c.fecha_creacion,
          c.motivo_cancelacion
       FROM dbo.Citas c
       INNER JOIN dbo.Usuarios u
         ON u.id_usuario = c.id_psicologo
       WHERE c.id_paciente = @idPaciente
       ORDER BY c.inicio DESC`,
      [
        {
          name: 'idPaciente',
          value: idPaciente,
        },
      ],
    );
  }

  async findByPsychologist(
    idPsicologo: number,
    user: AuthenticatedUser,
    desde?: string,
    hasta?: string,
  ) {
    this.ensurePsychologistOwnerOrAdmin(
      idPsicologo,
      user,
    );

    return this.db.executeQuery(
      `SELECT
          c.id_cita,
          c.id_paciente,
          u.nombre AS paciente,
          p.num_control_o_num_empleado,
          p.tipo_persona,
          c.id_psicologo,
          c.id_evaluacion,
          c.inicio,
          c.fin,
          c.modalidad,
          c.estado,
          c.fecha_creacion,
          c.motivo_cancelacion,
          c.notas_agenda
       FROM dbo.Citas c
       INNER JOIN dbo.Pacientes p
         ON p.id_paciente = c.id_paciente
       INNER JOIN dbo.Usuarios u
         ON u.id_usuario = c.id_paciente
       WHERE c.id_psicologo = @idPsicologo
         AND (
           @desde IS NULL
           OR c.fin >= @desde
         )
         AND (
           @hasta IS NULL
           OR c.inicio <= @hasta
         )
       ORDER BY c.inicio`,
      [
        {
          name: 'idPsicologo',
          value: idPsicologo,
        },
        {
          name: 'desde',
          value: desde ?? null,
        },
        {
          name: 'hasta',
          value: hasta ?? null,
        },
      ],
    );
  }

  async createAppointment(
    dto: CreateAppointmentDto,
    user: AuthenticatedUser,
  ) {
    const idPaciente =
      user.rol === ROL_PACIENTE
        ? user.userId
        : dto.idPaciente;

    if (!idPaciente) {
      throw new BadRequestException(
        'Debe especificarse el paciente',
      );
    }

    if (
      user.rol === ROL_PSICOLOGO &&
      user.userId !== dto.idPsicologo
    ) {
      throw new ForbiddenException(
        'Un psicólogo solo puede crear citas en su propia agenda',
      );
    }

    if (!dto.inicio.endsWith('Z') || !dto.fin.endsWith('Z')) {
      throw new BadRequestException(
        'Las fechas deben enviarse en formato UTC terminado en Z',
      );
    }

    const inicio = new Date(dto.inicio);
    const fin = new Date(dto.fin);

    this.validateAppointmentDates(inicio, fin);

    await this.ensurePatientExists(idPaciente);
    await this.ensurePsychologistAvailable(
      dto.idPsicologo,
    );

    if (dto.idEvaluacion) {
      await this.ensureEvaluationBelongsToPatient(
        dto.idEvaluacion,
        idPaciente,
      );
    }

    const asignacionActual =
      await this.findCurrentAssignment(idPaciente);

    if (
      asignacionActual &&
      asignacionActual.id_psicologo !== dto.idPsicologo
    ) {
      throw new ForbiddenException(
        'El paciente ya tiene otro psicólogo asignado',
      );
    }

    const pool = this.db.getPool();
    const transaction = pool.transaction();

    await transaction.begin();

    try {
      await this.ensureAppointmentAvailability(
        transaction,
        dto.idPsicologo,
        inicio,
        fin,
      );

      const initialState =
        user.rol === ROL_PSICOLOGO ||
        user.rol === ROL_ADMINISTRADOR
          ? 2
          : 1;

      const result = await transaction
        .request()
        .input('idPaciente', idPaciente)
        .input(
          'idPsicologo',
          dto.idPsicologo,
        )
        .input(
          'idEvaluacion',
          dto.idEvaluacion ?? null,
        )
        .input('inicio', inicio)
        .input('fin', fin)
        .input('modalidad', dto.modalidad)
        .input('estado', initialState)
        .input('creadaPor', user.userId)
        .input(
          'notasAgenda',
          dto.notasAgenda ?? null,
        )
        .query(`
          INSERT INTO dbo.Citas (
            id_paciente,
            id_psicologo,
            id_evaluacion,
            inicio,
            fin,
            modalidad,
            estado,
            creada_por,
            notas_agenda
          )
          OUTPUT INSERTED.id_cita
          VALUES (
            @idPaciente,
            @idPsicologo,
            @idEvaluacion,
            @inicio,
            @fin,
            @modalidad,
            @estado,
            @creadaPor,
            @notasAgenda
          )
          IF NOT EXISTS (
            SELECT 1
            FROM dbo.PacientePsicologo
            WHERE id_paciente = @idPaciente
            AND fecha_fin IS NULL
          )
          BEGIN
          INSERT INTO dbo.PacientePsicologo (
            id_paciente,
            id_psicologo,
            es_principal
          )
          VALUES (
            @idPaciente,
            @idPsicologo,
            1
          );
          END;
        `);

      const idCita =
        result.recordset[0].id_cita;

      await transaction.commit();

      return this.findAppointmentById(
        idCita,
        user,
      );
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async updateStatus(
    idCita: number,
    dto: UpdateAppointmentStatusDto,
    user: AuthenticatedUser,
  ) {
    const appointment =
      await this.getAppointmentRaw(idCita);

    this.ensurePsychologistOwnerOrAdmin(
      appointment.id_psicologo,
      user,
    );

    if ([4, 6].includes(appointment.estado)) {
      throw new BadRequestException(
        'No se puede actualizar una cita cancelada o reprogramada',
      );
    }

    await this.db.executeQuery(
      `UPDATE dbo.Citas
       SET estado = @estado
       WHERE id_cita = @idCita`,
      [
        {
          name: 'estado',
          value: dto.estado,
        },
        {
          name: 'idCita',
          value: idCita,
        },
      ],
    );

    return this.findAppointmentById(
      idCita,
      user,
    );
  }

  async cancelAppointment(
    idCita: number,
    dto: CancelAppointmentDto,
    user: AuthenticatedUser,
  ) {
    const appointment =
      await this.getAppointmentRaw(idCita);

    this.ensureAppointmentAccess(
      appointment,
      user,
    );

    if ([3, 4, 5, 6].includes(appointment.estado)) {
      throw new BadRequestException(
        'La cita ya no puede cancelarse',
      );
    }

    await this.db.executeQuery(
      `UPDATE dbo.Citas
       SET
         estado = 4,
         motivo_cancelacion =
           @motivoCancelacion
       WHERE id_cita = @idCita`,
      [
        {
          name: 'motivoCancelacion',
          value: dto.motivoCancelacion,
        },
        {
          name: 'idCita',
          value: idCita,
        },
      ],
    );

    return this.findAppointmentById(
      idCita,
      user,
    );
  }

  async rescheduleAppointment(
    idCita: number,
    dto: RescheduleAppointmentDto,
    user: AuthenticatedUser,
  ) {
    const original =
      await this.getAppointmentRaw(idCita);

    this.ensureAppointmentAccess(
      original,
      user,
    );

    if ([3, 4, 5, 6].includes(original.estado)) {
      throw new BadRequestException(
        'La cita ya no puede reprogramarse',
      );
    }

    if (!dto.inicio.endsWith('Z') || !dto.fin.endsWith('Z')) {
      throw new BadRequestException(
        'Las fechas deben enviarse en formato UTC terminado en Z',
      );
    }

    const inicio = new Date(dto.inicio);
    const fin = new Date(dto.fin);

    this.validateAppointmentDates(inicio, fin);

    const pool = this.db.getPool();
    const transaction = pool.transaction();

    await transaction.begin();

    try {
      await this.ensureAppointmentAvailability(
        transaction,
        original.id_psicologo,
        inicio,
        fin,
        idCita,
      );

      await transaction
        .request()
        .input('idCita', idCita)
        .query(`
          UPDATE dbo.Citas
          SET estado = 6
          WHERE id_cita = @idCita
        `);

      const newState =
        user.rol === ROL_PACIENTE ? 1 : 2;

      const result = await transaction
        .request()
        .input(
          'idPaciente',
          original.id_paciente,
        )
        .input(
          'idPsicologo',
          original.id_psicologo,
        )
        .input(
          'idEvaluacion',
          original.id_evaluacion ?? null,
        )
        .input('inicio', inicio)
        .input('fin', fin)
        .input(
          'modalidad',
          dto.modalidad ?? original.modalidad,
        )
        .input('estado', newState)
        .input('creadaPor', user.userId)
        .input(
          'notasAgenda',
          original.notas_agenda ?? null,
        )
        .query(`
          INSERT INTO dbo.Citas (
            id_paciente,
            id_psicologo,
            id_evaluacion,
            inicio,
            fin,
            modalidad,
            estado,
            creada_por,
            notas_agenda
          )
          OUTPUT INSERTED.id_cita
          VALUES (
            @idPaciente,
            @idPsicologo,
            @idEvaluacion,
            @inicio,
            @fin,
            @modalidad,
            @estado,
            @creadaPor,
            @notasAgenda
          )
        `);

      const newAppointmentId =
        result.recordset[0].id_cita;

      await transaction.commit();

      return this.findAppointmentById(
        newAppointmentId,
        user,
      );
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async findDashboardAppointments(
    idPsicologo: number,
    user: AuthenticatedUser,
    desde?: string,
    hasta?: string,
  ) {
    this.ensurePsychologistOwnerOrAdmin(
      idPsicologo,
      user,
    );

    return this.db.executeQuery(
      `SELECT
          id_cita,
          id_psicologo,
          id_paciente,
          paciente,
          inicio,
          fin,
          modalidad,
          estado,
          id_evaluacion
      FROM dbo.vw_DashboardPsicologoCitas
      WHERE id_psicologo = @idPsicologo
        AND (
          @desde IS NULL
          OR fin >= @desde
        )
        AND (
          @hasta IS NULL
          OR inicio <= @hasta
        )
      ORDER BY inicio`,
      [
        {
          name: 'idPsicologo',
          value: idPsicologo,
        },
        {
          name: 'desde',
          value: desde ?? null,
        },
        {
          name: 'hasta',
          value: hasta ?? null,
        },
      ],
    );
  }

  /* =========================
     MÉTODOS PRIVADOS
     ========================= */

  private async getAppointmentRaw(idCita: number) {
    const rows = await this.db.executeQuery(
      `SELECT *
       FROM dbo.Citas
       WHERE id_cita = @idCita`,
      [
        {
          name: 'idCita',
          value: idCita,
        },
      ],
    );

    if (!rows[0]) {
      throw new NotFoundException(
        'Cita no encontrada',
      );
    }

    return rows[0];
  }

  private async ensurePatientExists(
    idPaciente: number,
  ) {
    const rows = await this.db.executeQuery(
      `SELECT id_paciente
       FROM dbo.Pacientes
       WHERE id_paciente = @idPaciente`,
      [
        {
          name: 'idPaciente',
          value: idPaciente,
        },
      ],
    );

    if (!rows[0]) {
      throw new NotFoundException(
        'Paciente no encontrado',
      );
    }
  }

  private async ensurePsychologistExists(
    idPsicologo: number,
  ) {
    const rows = await this.db.executeQuery(
      `SELECT id_psicologo
       FROM dbo.Psicologos
       WHERE id_psicologo = @idPsicologo`,
      [
        {
          name: 'idPsicologo',
          value: idPsicologo,
        },
      ],
    );

    if (!rows[0]) {
      throw new NotFoundException(
        'Psicólogo no encontrado',
      );
    }
  }

  private async ensurePsychologistAvailable(
    idPsicologo: number,
  ) {
    const rows = await this.db.executeQuery(
      `SELECT
          ps.id_psicologo
       FROM dbo.Psicologos ps
       INNER JOIN dbo.Usuarios u
         ON u.id_usuario = ps.id_psicologo
       WHERE ps.id_psicologo = @idPsicologo
         AND ps.activo_para_citas = 1
         AND u.activo = 1`,
      [
        {
          name: 'idPsicologo',
          value: idPsicologo,
        },
      ],
    );

    if (!rows[0]) {
      throw new BadRequestException(
        'El psicólogo no está disponible para citas',
      );
    }
  }

  private async isAssigned(
    idPaciente: number,
    idPsicologo: number,
  ): Promise<boolean> {
    const rows = await this.db.executeQuery(
      `SELECT TOP (1) id_asignacion
       FROM dbo.PacientePsicologo
       WHERE id_paciente = @idPaciente
         AND id_psicologo = @idPsicologo
         AND fecha_fin IS NULL`,
      [
        {
          name: 'idPaciente',
          value: idPaciente,
        },
        {
          name: 'idPsicologo',
          value: idPsicologo,
        },
      ],
    );

    return Boolean(rows[0]);
  }

  private async ensureEvaluationBelongsToPatient(
    idEvaluacion: number,
    idPaciente: number,
  ) {
    const rows = await this.db.executeQuery(
      `SELECT id_evaluacion
       FROM dbo.Evaluaciones
       WHERE id_evaluacion = @idEvaluacion
         AND id_paciente = @idPaciente
         AND estado <> 4`,
      [
        {
          name: 'idEvaluacion',
          value: idEvaluacion,
        },
        {
          name: 'idPaciente',
          value: idPaciente,
        },
      ],
    );

    if (!rows[0]) {
      throw new BadRequestException(
        'La evaluación no pertenece al paciente',
      );
    }
  }

  private async ensureAppointmentAvailability(
    transaction: any,
    idPsicologo: number,
    inicio: Date,
    fin: Date,
    excludeAppointmentId?: number,
  ) {
    const result = await transaction
      .request()
      .input('idPsicologo', idPsicologo)
      .input('inicio', inicio)
      .input('fin', fin)
      .input(
        'idCitaExcluida',
        excludeAppointmentId ?? null,
      )
      .query(`
        SELECT TOP (1) id_cita
        FROM dbo.Citas WITH (
          UPDLOCK,
          HOLDLOCK
        )
        WHERE id_psicologo = @idPsicologo
          AND estado IN (1, 2)
          AND inicio < @fin
          AND fin > @inicio
          AND (
            @idCitaExcluida IS NULL
            OR id_cita <> @idCitaExcluida
          )
      `);

    if (result.recordset[0]) {
      throw new ConflictException(
        'El psicólogo ya tiene una cita en ese horario',
      );
    }
  }

  private ensureAppointmentAccess(
    appointment: {
      id_paciente: number;
      id_psicologo: number;
    },
    user: AuthenticatedUser,
  ) {
    if (user.rol === ROL_ADMINISTRADOR) {
      return;
    }

    if (
      user.rol === ROL_PACIENTE &&
      user.userId === appointment.id_paciente
    ) {
      return;
    }

    if (
      user.rol === ROL_PSICOLOGO &&
      user.userId === appointment.id_psicologo
    ) {
      return;
    }

    throw new ForbiddenException(
      'No tienes acceso a esta cita',
    );
  }

  private ensurePsychologistOwnerOrAdmin(
    idPsicologo: number,
    user: AuthenticatedUser,
  ) {
    if (user.rol === ROL_ADMINISTRADOR) {
      return;
    }

    if (
      user.rol === ROL_PSICOLOGO &&
      user.userId === idPsicologo
    ) {
      return;
    }

    throw new ForbiddenException(
      'No puedes administrar la agenda de otro psicólogo',
    );
  }

  private validateTimeRange(
    horaInicio: string,
    horaFin: string,
  ) {
    if (horaFin <= horaInicio) {
      throw new BadRequestException(
        'La hora de fin debe ser posterior a la hora de inicio',
      );
    }
  }

  private validateAppointmentDates(
    inicio: Date,
    fin: Date,
  ) {
    if (
      Number.isNaN(inicio.getTime()) ||
      Number.isNaN(fin.getTime())
    ) {
      throw new BadRequestException(
        'Las fechas no son válidas',
      );
    }

    if (fin <= inicio) {
      throw new BadRequestException(
        'El fin debe ser posterior al inicio',
      );
    }

    if (inicio <= new Date()) {
      throw new BadRequestException(
        'No se pueden crear citas en el pasado',
      );
    }
  }

  private async findCurrentAssignment(
    idPaciente: number,
  ) {
    const rows = await this.db.executeQuery(
      `SELECT TOP (1)
          id_asignacion,
          id_psicologo
      FROM dbo.PacientePsicologo
      WHERE id_paciente = @idPaciente
        AND es_principal = 1
        AND fecha_fin IS NULL
      ORDER BY fecha_inicio DESC`,
      [
        {
          name: 'idPaciente',
          value: idPaciente,
        },
      ],
    );

    return rows[0] ?? null;
  }
}