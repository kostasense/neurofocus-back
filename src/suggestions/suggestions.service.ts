import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CreateSuggestionDto } from './dto/create-suggestion.dto.js';
import { UpdateSuggestionDto } from './dto/update-suggestion.dto.js';

const ROL_ADMINISTRADOR = 3;

interface AuthenticatedUser {
  userId: number;
  correo: string;
  rol: number;
}

@Injectable()
export class SuggestionsService {
  constructor(
    private readonly db: DatabaseService,
  ) {}

  async create(
    dto: CreateSuggestionDto,
    user: AuthenticatedUser,
  ) {
    const comentario = dto.comentario.trim();

    if (!comentario) {
      throw new BadRequestException(
        'El comentario no puede estar vacío',
      );
    }

    if (
      dto.categoria === 2 &&
      !dto.idPsicologoReferido
    ) {
      throw new BadRequestException(
        'Debe indicar el psicólogo referido para sugerencias de atención psicológica',
      );
    }

    if (dto.idPsicologoReferido) {
      await this.ensurePsychologistExists(
        dto.idPsicologoReferido,
      );
    }

    if (dto.idCita) {
      const cita = await this.getAppointment(
        dto.idCita,
      );

      const esAdministrador =
        user.rol === ROL_ADMINISTRADOR;

      const participaEnCita =
        cita.id_paciente === user.userId ||
        cita.id_psicologo === user.userId;

      if (!esAdministrador && !participaEnCita) {
        throw new ForbiddenException(
          'No puedes hacer referencia a una cita ajena',
        );
      }

      if (
        dto.idPsicologoReferido &&
        cita.id_psicologo !==
          dto.idPsicologoReferido
      ) {
        throw new BadRequestException(
          'El psicólogo referido no corresponde a la cita',
        );
      }
    }

    const rows = await this.db.executeQuery(
      `INSERT INTO dbo.Sugerencias (
         id_autor,
         id_psicologo_referido,
         id_cita,
         categoria,
         calificacion,
         comentario
       )
       OUTPUT INSERTED.id_sugerencia
       VALUES (
         @idAutor,
         @idPsicologoReferido,
         @idCita,
         @categoria,
         @calificacion,
         @comentario
       )`,
      [
        {
          name: 'idAutor',
          value: dto.anonima
            ? null
            : user.userId,
        },
        {
          name: 'idPsicologoReferido',
          value:
            dto.idPsicologoReferido ?? null,
        },
        {
          name: 'idCita',
          value: dto.idCita ?? null,
        },
        {
          name: 'categoria',
          value: dto.categoria,
        },
        {
          name: 'calificacion',
          value: dto.calificacion ?? null,
        },
        {
          name: 'comentario',
          value: comentario,
        },
      ],
    );

    return {
      idSugerencia:
        rows[0].id_sugerencia,
      anonima: dto.anonima,
      mensaje:
        'La sugerencia fue registrada correctamente',
    };
  }

  async findOwn(
    user: AuthenticatedUser,
  ) {
    return this.db.executeQuery(
      `SELECT
          s.id_sugerencia,
          s.id_psicologo_referido,
          psicologo.nombre AS psicologo_referido,
          s.id_cita,
          s.categoria,
          s.calificacion,
          s.comentario,
          s.estado,
          s.fecha_creacion,
          s.fecha_atencion
       FROM dbo.Sugerencias s
       LEFT JOIN dbo.Usuarios psicologo
         ON psicologo.id_usuario =
            s.id_psicologo_referido
       WHERE s.id_autor = @idAutor
       ORDER BY s.fecha_creacion DESC`,
      [
        {
          name: 'idAutor',
          value: user.userId,
        },
      ],
    );
  }

  async findAll(
    estado?: number,
    categoria?: number,
    idPsicologo?: number,
  ) {
    this.validateFilters(
      estado,
      categoria,
      idPsicologo,
    );

    return this.db.executeQuery(
      `SELECT
          s.id_sugerencia,
          s.id_autor,
          autor.nombre AS autor,
          s.id_psicologo_referido,
          psicologo.nombre AS psicologo_referido,
          s.id_cita,
          s.categoria,
          s.calificacion,
          s.comentario,
          s.estado,
          s.fecha_creacion,
          s.atendida_por,
          administrador.nombre AS administrador,
          s.fecha_atencion,
          s.respuesta_interna
       FROM dbo.Sugerencias s
       LEFT JOIN dbo.Usuarios autor
         ON autor.id_usuario = s.id_autor
       LEFT JOIN dbo.Usuarios psicologo
         ON psicologo.id_usuario =
            s.id_psicologo_referido
       LEFT JOIN dbo.Usuarios administrador
         ON administrador.id_usuario =
            s.atendida_por
       WHERE (
         @estado IS NULL
         OR s.estado = @estado
       )
       AND (
         @categoria IS NULL
         OR s.categoria = @categoria
       )
       AND (
         @idPsicologo IS NULL
         OR s.id_psicologo_referido =
            @idPsicologo
       )
       ORDER BY
         s.estado ASC,
         s.fecha_creacion DESC`,
      [
        {
          name: 'estado',
          value: estado ?? null,
        },
        {
          name: 'categoria',
          value: categoria ?? null,
        },
        {
          name: 'idPsicologo',
          value: idPsicologo ?? null,
        },
      ],
    );
  }

  async findById(
    idSugerencia: number,
    user: AuthenticatedUser,
  ) {
    const suggestion =
      await this.getSuggestionRaw(
        idSugerencia,
      );

    const esAdministrador =
      user.rol === ROL_ADMINISTRADOR;

    const esAutor =
      suggestion.id_autor === user.userId;

    if (!esAdministrador && !esAutor) {
      throw new ForbiddenException(
        'No tienes acceso a esta sugerencia',
      );
    }

    return suggestion;
  }

  async update(
    idSugerencia: number,
    dto: UpdateSuggestionDto,
    user: AuthenticatedUser,
  ) {
    if (user.rol !== ROL_ADMINISTRADOR) {
      throw new ForbiddenException(
        'Solo un administrador puede atender sugerencias',
      );
    }

    const suggestion =
      await this.getSuggestionRaw(
        idSugerencia,
      );

    const nuevoEstado =
      dto.estado ?? suggestion.estado;

    this.validateStateTransition(
      suggestion.estado,
      nuevoEstado,
    );

    const respuestaInterna =
      dto.respuestaInterna !== undefined
        ? dto.respuestaInterna.trim()
        : undefined;

    if (
      dto.respuestaInterna !== undefined &&
      !respuestaInterna
    ) {
      throw new BadRequestException(
        'La respuesta interna no puede estar vacía',
      );
    }

    const marcaAtencion =
      nuevoEstado === 3 ||
      nuevoEstado === 4;

    await this.db.executeQuery(
      `UPDATE dbo.Sugerencias
       SET
         estado = @estado,

         respuesta_interna =
           CASE
             WHEN @actualizarRespuesta = 1
               THEN @respuestaInterna
             ELSE respuesta_interna
           END,

         atendida_por =
           CASE
             WHEN @asignarAdministrador = 1
               THEN @idAdministrador
             ELSE atendida_por
           END,

         fecha_atencion =
           CASE
             WHEN @marcaAtencion = 1
               THEN COALESCE(
                 fecha_atencion,
                 SYSUTCDATETIME()
               )
             ELSE fecha_atencion
           END

       WHERE id_sugerencia =
         @idSugerencia`,
      [
        {
          name: 'estado',
          value: nuevoEstado,
        },
        {
          name: 'actualizarRespuesta',
          value:
            dto.respuestaInterna !==
            undefined,
        },
        {
          name: 'respuestaInterna',
          value:
            respuestaInterna ?? null,
        },
        {
          name: 'asignarAdministrador',
          value: nuevoEstado >= 2,
        },
        {
          name: 'marcaAtencion',
          value: marcaAtencion,
        },
        {
          name: 'idAdministrador',
          value: user.userId,
        },
        {
          name: 'idSugerencia',
          value: idSugerencia,
        },
      ],
    );

    return this.getSuggestionRaw(
      idSugerencia,
    );
  }

  private async getSuggestionRaw(
    idSugerencia: number,
  ) {
    const rows = await this.db.executeQuery(
      `SELECT
          s.id_sugerencia,
          s.id_autor,
          autor.nombre AS autor,
          s.id_psicologo_referido,
          psicologo.nombre AS psicologo_referido,
          s.id_cita,
          s.categoria,
          s.calificacion,
          s.comentario,
          s.estado,
          s.fecha_creacion,
          s.atendida_por,
          administrador.nombre AS administrador,
          s.fecha_atencion,
          s.respuesta_interna
       FROM dbo.Sugerencias s
       LEFT JOIN dbo.Usuarios autor
         ON autor.id_usuario = s.id_autor
       LEFT JOIN dbo.Usuarios psicologo
         ON psicologo.id_usuario =
            s.id_psicologo_referido
       LEFT JOIN dbo.Usuarios administrador
         ON administrador.id_usuario =
            s.atendida_por
       WHERE s.id_sugerencia =
         @idSugerencia`,
      [
        {
          name: 'idSugerencia',
          value: idSugerencia,
        },
      ],
    );

    if (!rows[0]) {
      throw new NotFoundException(
        'Sugerencia no encontrada',
      );
    }

    return rows[0];
  }

  private async ensurePsychologistExists(
    idPsicologo: number,
  ) {
    const rows = await this.db.executeQuery(
      `SELECT
          ps.id_psicologo
       FROM dbo.Psicologos ps
       INNER JOIN dbo.Usuarios u
         ON u.id_usuario = ps.id_psicologo
       WHERE ps.id_psicologo =
         @idPsicologo
         AND u.activo = 1`,
      [
        {
          name: 'idPsicologo',
          value: idPsicologo,
        },
      ],
    );

    if (!rows[0]) {
      throw new NotFoundException(
        'Psicólogo no encontrado o inactivo',
      );
    }
  }

  private async getAppointment(
    idCita: number,
  ) {
    const rows = await this.db.executeQuery(
      `SELECT
          id_cita,
          id_paciente,
          id_psicologo
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

  private validateFilters(
    estado?: number,
    categoria?: number,
    idPsicologo?: number,
  ) {
    if (
      estado !== undefined &&
      ![1, 2, 3, 4].includes(estado)
    ) {
      throw new BadRequestException(
        'El estado debe estar entre 1 y 4',
      );
    }

    if (
      categoria !== undefined &&
      ![1, 2, 3, 4, 5].includes(categoria)
    ) {
      throw new BadRequestException(
        'La categoría debe estar entre 1 y 5',
      );
    }

    if (
      idPsicologo !== undefined &&
      (
        !Number.isInteger(idPsicologo) ||
        idPsicologo < 1
      )
    ) {
      throw new BadRequestException(
        'El identificador del psicólogo no es válido',
      );
    }
  }

  private validateStateTransition(
    estadoActual: number,
    nuevoEstado: number,
  ) {
    if (estadoActual === nuevoEstado) {
      return;
    }

    const transitions: Record<
      number,
      number[]
    > = {
      1: [2, 3, 4],
      2: [3, 4],
      3: [4],
      4: [],
    };

    const estadosPermitidos =
      transitions[estadoActual] ?? [];

    if (
      !estadosPermitidos.includes(
        nuevoEstado,
      )
    ) {
      throw new BadRequestException(
        `No se puede cambiar el estado de ${estadoActual} a ${nuevoEstado}`,
      );
    }
  }
}