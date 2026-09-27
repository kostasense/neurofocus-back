import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { UpdatePsychologistDto } from './dto/update-psychologist.dto.js';

@Injectable()
export class PsychologistsService {
  constructor(private readonly db: DatabaseService) {}

  async exists(idPsicologo: number): Promise<boolean> {
    const rows = await this.db.executeQuery(
      `SELECT 1 AS existe
       FROM dbo.Psicologos
       WHERE id_psicologo = @idPsicologo`,
      [{ name: 'idPsicologo', value: idPsicologo }],
    );

    return Boolean(rows[0]);
  }

  async findById(idPsicologo: number) {
    const rows = await this.db.executeQuery(
      `SELECT
          ps.id_psicologo,
          u.nombre,
          u.correo,
          u.activo,
          ps.cedula_profesional,
          ps.especialidad,
          ps.duracion_cita_minutos,
          ps.chat_disponible,
          ps.activo_para_citas
       FROM dbo.Psicologos ps
       INNER JOIN dbo.Usuarios u
         ON u.id_usuario = ps.id_psicologo
       WHERE ps.id_psicologo = @idPsicologo`,
      [{ name: 'idPsicologo', value: idPsicologo }],
    );

    if (!rows[0]) {
      throw new NotFoundException(
        'Psicólogo no encontrado',
      );
    }

    return rows[0];
  }

  async findAll(soloActivosParaCitas = false) {
    const query = `
      SELECT
        ps.id_psicologo,
        u.nombre,
        u.correo,
        u.activo,
        ps.cedula_profesional,
        ps.especialidad,
        ps.duracion_cita_minutos,
        ps.chat_disponible,
        ps.activo_para_citas
      FROM dbo.Psicologos ps
      INNER JOIN dbo.Usuarios u
        ON u.id_usuario = ps.id_psicologo
      WHERE
        (@soloActivos = 0 OR ps.activo_para_citas = 1)
        AND u.activo = 1
      ORDER BY u.nombre
    `;

    return this.db.executeQuery(query, [
      {
        name: 'soloActivos',
        value: soloActivosParaCitas,
      },
    ]);
  }

  async update(
    idPsicologo: number,
    dto: UpdatePsychologistDto,
  ) {
    await this.findById(idPsicologo);

    if (dto.cedulaProfesional) {
      const duplicados = await this.db.executeQuery(
        `SELECT id_psicologo
         FROM dbo.Psicologos
         WHERE cedula_profesional = @cedula
           AND id_psicologo <> @idPsicologo`,
        [
          {
            name: 'cedula',
            value: dto.cedulaProfesional,
          },
          {
            name: 'idPsicologo',
            value: idPsicologo,
          },
        ],
      );

      if (duplicados[0]) {
        throw new ConflictException(
          'La cédula profesional ya está registrada',
        );
      }
    }

    await this.db.executeQuery(
      `UPDATE dbo.Psicologos
       SET
         cedula_profesional =
           COALESCE(
             @cedulaProfesional,
             cedula_profesional
           ),

         especialidad =
           CASE
             WHEN @actualizarEspecialidad = 1
               THEN @especialidad
             ELSE especialidad
           END,

         duracion_cita_minutos =
           COALESCE(
             @duracionCitaMinutos,
             duracion_cita_minutos
           ),

         chat_disponible =
           COALESCE(
             @chatDisponible,
             chat_disponible
           ),

         activo_para_citas =
           COALESCE(
             @activoParaCitas,
             activo_para_citas
           )

       WHERE id_psicologo = @idPsicologo`,
      [
        {
          name: 'cedulaProfesional',
          value: dto.cedulaProfesional ?? null,
        },
        {
          name: 'actualizarEspecialidad',
          value: dto.especialidad !== undefined,
        },
        {
          name: 'especialidad',
          value: dto.especialidad ?? null,
        },
        {
          name: 'duracionCitaMinutos',
          value: dto.duracionCitaMinutos ?? null,
        },
        {
          name: 'chatDisponible',
          value: dto.chatDisponible ?? null,
        },
        {
          name: 'activoParaCitas',
          value: dto.activoParaCitas ?? null,
        },
        {
          name: 'idPsicologo',
          value: idPsicologo,
        },
      ],
    );

    return this.findById(idPsicologo);
  }

  async setChatDisponible(
    idPsicologo: number,
    disponible: boolean,
  ) {
    await this.findById(idPsicologo);

    await this.db.executeQuery(
      `UPDATE dbo.Psicologos
       SET chat_disponible = @disponible
       WHERE id_psicologo = @idPsicologo`,
      [
        {
          name: 'disponible',
          value: disponible,
        },
        {
          name: 'idPsicologo',
          value: idPsicologo,
        },
      ],
    );

    return this.findById(idPsicologo);
  }

  async setActivoParaCitas(
    idPsicologo: number,
    activo: boolean,
  ) {
    await this.findById(idPsicologo);

    await this.db.executeQuery(
      `UPDATE dbo.Psicologos
       SET activo_para_citas = @activo
       WHERE id_psicologo = @idPsicologo`,
      [
        {
          name: 'activo',
          value: activo,
        },
        {
          name: 'idPsicologo',
          value: idPsicologo,
        },
      ],
    );

    return this.findById(idPsicologo);
  }

  async findDashboardPatients(
    idPsicologo: number,
  ) {
    await this.findById(idPsicologo);

    return this.db.executeQuery(
      `SELECT
          id_psicologo,
          id_paciente,
          paciente,
          tipo_persona,
          fecha_inicio,
          id_expediente,
          estado_expediente,
          fecha_ultima_evaluacion,
          proxima_cita
      FROM dbo.vw_DashboardPsicologoPacientes
      WHERE id_psicologo = @idPsicologo
      ORDER BY paciente`,
      [
        {
          name: 'idPsicologo',
          value: idPsicologo,
        },
      ],
    );
  }
}
