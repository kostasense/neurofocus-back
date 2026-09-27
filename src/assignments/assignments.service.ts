import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CreateAssignmentDto } from './dto/create-assignment.dto.js';
import { CloseAssignmentDto } from './dto/close-assignment.dto.js';

@Injectable()
export class AssignmentsService {
  constructor(private readonly db: DatabaseService) {}

  async findById(idAsignacion: number) {
    const rows = await this.db.executeQuery(
      `SELECT
          pp.id_asignacion,
          pp.id_paciente,
          paciente.nombre AS paciente,
          pp.id_psicologo,
          psicologo.nombre AS psicologo,
          pp.es_principal,
          pp.fecha_inicio,
          pp.fecha_fin,
          pp.motivo_fin
       FROM dbo.PacientePsicologo pp
       INNER JOIN dbo.Usuarios paciente
         ON paciente.id_usuario = pp.id_paciente
       INNER JOIN dbo.Usuarios psicologo
         ON psicologo.id_usuario = pp.id_psicologo
       WHERE pp.id_asignacion = @idAsignacion`,
      [
        {
          name: 'idAsignacion',
          value: idAsignacion,
        },
      ],
    );

    if (!rows[0]) {
      throw new NotFoundException(
        'Asignación no encontrada',
      );
    }

    return rows[0];
  }

  async findCurrentByPatient(idPaciente: number) {
    const rows = await this.db.executeQuery(
      `SELECT TOP (1)
          pp.id_asignacion,
          pp.id_paciente,
          pp.id_psicologo,
          u.nombre AS psicologo,
          u.correo,
          ps.cedula_profesional,
          ps.especialidad,
          ps.chat_disponible,
          ps.activo_para_citas,
          pp.fecha_inicio
       FROM dbo.PacientePsicologo pp
       INNER JOIN dbo.Usuarios u
         ON u.id_usuario = pp.id_psicologo
       INNER JOIN dbo.Psicologos ps
         ON ps.id_psicologo = pp.id_psicologo
       WHERE pp.id_paciente = @idPaciente
         AND pp.es_principal = 1
         AND pp.fecha_fin IS NULL
       ORDER BY pp.fecha_inicio DESC`,
      [
        {
          name: 'idPaciente',
          value: idPaciente,
        },
      ],
    );

    return rows[0] ?? null;
  }

  async findHistoryByPatient(idPaciente: number) {
    return this.db.executeQuery(
      `SELECT
          pp.id_asignacion,
          pp.id_paciente,
          pp.id_psicologo,
          u.nombre AS psicologo,
          ps.cedula_profesional,
          ps.especialidad,
          pp.es_principal,
          pp.fecha_inicio,
          pp.fecha_fin,
          pp.motivo_fin
       FROM dbo.PacientePsicologo pp
       INNER JOIN dbo.Usuarios u
         ON u.id_usuario = pp.id_psicologo
       INNER JOIN dbo.Psicologos ps
         ON ps.id_psicologo = pp.id_psicologo
       WHERE pp.id_paciente = @idPaciente
       ORDER BY pp.fecha_inicio DESC`,
      [
        {
          name: 'idPaciente',
          value: idPaciente,
        },
      ],
    );
  }

  async findActiveByPsychologist(idPsicologo: number) {
    return this.db.executeQuery(
      `SELECT
          pp.id_asignacion,
          pp.id_paciente,
          u.nombre AS paciente,
          u.correo,
          p.num_control_o_num_empleado,
          p.tipo_persona,
          pp.es_principal,
          pp.fecha_inicio
       FROM dbo.PacientePsicologo pp
       INNER JOIN dbo.Pacientes p
         ON p.id_paciente = pp.id_paciente
       INNER JOIN dbo.Usuarios u
         ON u.id_usuario = pp.id_paciente
       WHERE pp.id_psicologo = @idPsicologo
         AND pp.fecha_fin IS NULL
       ORDER BY
         pp.es_principal DESC,
         u.nombre`,
      [
        {
          name: 'idPsicologo',
          value: idPsicologo,
        },
      ],
    );
  }

  async create(dto: CreateAssignmentDto) {
    const pool = this.db.getPool();
    const transaction = pool.transaction();

    await transaction.begin();

    try {
      const paciente = await transaction
        .request()
        .input('idPaciente', dto.idPaciente)
        .query(`
          SELECT id_paciente
          FROM dbo.Pacientes
          WHERE id_paciente = @idPaciente
        `);

      if (!paciente.recordset[0]) {
        throw new NotFoundException(
          'Paciente no encontrado',
        );
      }

      const psicologo = await transaction
        .request()
        .input('idPsicologo', dto.idPsicologo)
        .query(`
          SELECT id_psicologo, activo_para_citas
          FROM dbo.Psicologos
          WHERE id_psicologo = @idPsicologo
        `);

      if (!psicologo.recordset[0]) {
        throw new NotFoundException(
          'Psicólogo no encontrado',
        );
      }

      const esPrincipal = dto.esPrincipal ?? true;

      const mismaAsignacion = await transaction
        .request()
        .input('idPaciente', dto.idPaciente)
        .input('idPsicologo', dto.idPsicologo)
        .query(`
          SELECT id_asignacion
          FROM dbo.PacientePsicologo
          WHERE id_paciente = @idPaciente
            AND id_psicologo = @idPsicologo
            AND fecha_fin IS NULL
        `);

      if (mismaAsignacion.recordset[0]) {
        throw new ConflictException(
          'El paciente ya tiene una asignación activa con ese psicólogo',
        );
      }

      if (esPrincipal) {
        await transaction
          .request()
          .input('idPaciente', dto.idPaciente)
          .query(`
            UPDATE dbo.PacientePsicologo
            SET
              fecha_fin = SYSUTCDATETIME(),
              motivo_fin =
                COALESCE(
                  motivo_fin,
                  N'Reasignación de psicólogo principal'
                )
            WHERE id_paciente = @idPaciente
              AND es_principal = 1
              AND fecha_fin IS NULL
          `);
      }

      const resultado = await transaction
        .request()
        .input('idPaciente', dto.idPaciente)
        .input('idPsicologo', dto.idPsicologo)
        .input('esPrincipal', esPrincipal)
        .query(`
          INSERT INTO dbo.PacientePsicologo (
            id_paciente,
            id_psicologo,
            es_principal
          )
          OUTPUT INSERTED.id_asignacion
          VALUES (
            @idPaciente,
            @idPsicologo,
            @esPrincipal
          )
        `);

      const idAsignacion =
        resultado.recordset[0].id_asignacion;

      /*
       * Si existe expediente, actualizamos su responsable cuando
       * la nueva asignación es principal.
       */
      if (esPrincipal) {
        await transaction
          .request()
          .input('idPaciente', dto.idPaciente)
          .input('idPsicologo', dto.idPsicologo)
          .query(`
            UPDATE dbo.Expedientes
            SET id_psicologo_responsable = @idPsicologo
            WHERE id_paciente = @idPaciente
              AND estado = 1
          `);
      }

      await transaction.commit();

      return this.findById(idAsignacion);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async close(
    idAsignacion: number,
    dto: CloseAssignmentDto,
  ) {
    const asignacion = await this.findById(idAsignacion);

    if (asignacion.fecha_fin) {
      throw new BadRequestException(
        'La asignación ya está cerrada',
      );
    }

    const pool = this.db.getPool();
    const transaction = pool.transaction();

    await transaction.begin();

    try {
      await transaction
        .request()
        .input('idAsignacion', idAsignacion)
        .input('motivoFin', dto.motivoFin ?? null)
        .query(`
          UPDATE dbo.PacientePsicologo
          SET
            fecha_fin = SYSUTCDATETIME(),
            motivo_fin = @motivoFin
          WHERE id_asignacion = @idAsignacion
            AND fecha_fin IS NULL
        `);

      if (asignacion.es_principal) {
        await transaction
          .request()
          .input(
            'idPaciente',
            asignacion.id_paciente,
          )
          .input(
            'idPsicologo',
            asignacion.id_psicologo,
          )
          .query(`
            UPDATE dbo.Expedientes
            SET id_psicologo_responsable = NULL
            WHERE id_paciente = @idPaciente
              AND id_psicologo_responsable = @idPsicologo
          `);
      }

      await transaction.commit();

      return this.findById(idAsignacion);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}