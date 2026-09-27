import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { CreateRecordDto } from './dto/create-record.dto.js';
import { CreateRecordEntryDto } from './dto/create-record-entry.dto.js';
import { CancelRecordEntryDto } from './dto/cancel-record-entry.dto.js';
import { CreateAttachmentDto } from './dto/create-attachment.dto.js';
import { CloseRecordDto } from './dto/close-record.dto.js';
import { ChangeResponsibleDto } from './dto/change-responsible.dto.js';

const ROL_PACIENTE = 1;
const ROL_PSICOLOGO = 2;
const ROL_ADMINISTRADOR = 3;

interface AuthenticatedUser {
  userId: number;
  correo: string;
  rol: number;
}

@Injectable()
export class RecordsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly cryptoService: CryptoService,
  ) {}

  async create(
    dto: CreateRecordDto,
    user: AuthenticatedUser,
  ) {
    if (
      user.rol !== ROL_PSICOLOGO &&
      user.rol !== ROL_ADMINISTRADOR
    ) {
      throw new ForbiddenException(
        'No tienes autorización para crear expedientes',
      );
    }

    await this.ensurePatientExists(dto.idPaciente);

    const idResponsable =
      user.rol === ROL_PSICOLOGO
        ? user.userId
        : dto.idPsicologoResponsable;

    if (!idResponsable) {
      throw new BadRequestException(
        'Debe especificarse el psicólogo responsable',
      );
    }

    await this.ensurePsychologistAssigned(
      dto.idPaciente,
      idResponsable,
    );

    const existing = await this.db.executeQuery(
      `SELECT id_expediente
       FROM dbo.Expedientes
       WHERE id_paciente = @idPaciente`,
      [
        {
          name: 'idPaciente',
          value: dto.idPaciente,
        },
      ],
    );

    if (existing[0]) {
      throw new ConflictException(
        'El paciente ya cuenta con un expediente',
      );
    }

    const rows = await this.db.executeQuery(
      `INSERT INTO dbo.Expedientes (
         id_paciente,
         id_psicologo_responsable,
         motivo_consulta
       )
       OUTPUT INSERTED.id_expediente
       VALUES (
         @idPaciente,
         @idPsicologo,
         @motivoConsulta
       )`,
      [
        {
          name: 'idPaciente',
          value: dto.idPaciente,
        },
        {
          name: 'idPsicologo',
          value: idResponsable,
        },
        {
          name: 'motivoConsulta',
          value: dto.motivoConsulta ?? null,
        },
      ],
    );

    return this.findById(
      rows[0].id_expediente,
      user,
    );
  }

  async findById(
    idExpediente: number,
    user: AuthenticatedUser,
  ) {
    const expediente =
      await this.getRecordRaw(idExpediente);

    await this.ensureAccess(expediente, user);

    return expediente;
  }

  async findByPatient(
    idPaciente: number,
    user: AuthenticatedUser,
  ) {
    const rows = await this.db.executeQuery(
      `SELECT
          e.id_expediente,
          e.id_paciente,
          paciente.nombre AS paciente,
          e.id_psicologo_responsable,
          psicologo.nombre AS psicologo_responsable,
          e.estado,
          e.fecha_apertura,
          e.fecha_cierre,
          e.motivo_consulta
       FROM dbo.Expedientes e
       INNER JOIN dbo.Usuarios paciente
         ON paciente.id_usuario = e.id_paciente
       LEFT JOIN dbo.Usuarios psicologo
         ON psicologo.id_usuario =
            e.id_psicologo_responsable
       WHERE e.id_paciente = @idPaciente`,
      [
        {
          name: 'idPaciente',
          value: idPaciente,
        },
      ],
    );

    const expediente = rows[0];

    if (!expediente) {
      throw new NotFoundException(
        'Expediente no encontrado',
      );
    }

    await this.ensureAccess(expediente, user);

    return expediente;
  }

  async findByPsychologist(
    idPsicologo: number,
    user: AuthenticatedUser,
  ) {
    if (
      user.rol !== ROL_ADMINISTRADOR &&
      !(
        user.rol === ROL_PSICOLOGO &&
        user.userId === idPsicologo
      )
    ) {
      throw new ForbiddenException(
        'No puedes consultar expedientes de otro psicólogo',
      );
    }

    return this.db.executeQuery(
      `SELECT
          e.id_expediente,
          e.id_paciente,
          u.nombre AS paciente,
          p.num_control_o_num_empleado,
          p.tipo_persona,
          e.estado,
          e.fecha_apertura,
          e.fecha_cierre,
          e.motivo_consulta
       FROM dbo.Expedientes e
       INNER JOIN dbo.Pacientes p
         ON p.id_paciente = e.id_paciente
       INNER JOIN dbo.Usuarios u
         ON u.id_usuario = e.id_paciente
       WHERE e.id_psicologo_responsable = @idPsicologo
       ORDER BY u.nombre`,
      [
        {
          name: 'idPsicologo',
          value: idPsicologo,
        },
      ],
    );
  }

  async findEntries(
    idExpediente: number,
    user: AuthenticatedUser,
  ) {
    const expediente =
      await this.getRecordRaw(idExpediente);

    await this.ensureAccess(expediente, user);

    const rows = await this.db.executeQuery(
      `SELECT
          en.id_entrada,
          en.id_expediente,
          en.id_psicologo,
          u.nombre AS psicologo,
          en.id_cita,
          en.id_evaluacion,
          en.tipo,
          en.fecha_registro,
          en.contenido_cifrado,
          en.nonce,
          en.etiqueta_autenticacion,
          en.version,
          en.anulada,
          en.motivo_anulacion
       FROM dbo.EntradasExpediente en
       INNER JOIN dbo.Usuarios u
         ON u.id_usuario = en.id_psicologo
       WHERE en.id_expediente = @idExpediente
       ORDER BY en.fecha_registro DESC`,
      [
        {
          name: 'idExpediente',
          value: idExpediente,
        },
      ],
    );

    return rows.map((entry) =>
      this.mapEntry(entry),
    );
  }

  async findEntryById(
    idEntrada: number,
    user: AuthenticatedUser,
  ) {
    const entry =
      await this.getEntryRaw(idEntrada);

    const expediente =
      await this.getRecordRaw(
        entry.id_expediente,
      );

    await this.ensureAccess(expediente, user);

    return this.mapEntry(entry);
  }

  async createEntry(
    idExpediente: number,
    dto: CreateRecordEntryDto,
    user: AuthenticatedUser,
  ) {
    if (user.rol !== ROL_PSICOLOGO) {
      throw new ForbiddenException(
        'Solo un psicólogo puede crear entradas',
      );
    }

    const expediente =
      await this.getRecordRaw(idExpediente);

    await this.ensureAccess(expediente, user);

    if (expediente.estado !== 1) {
      throw new BadRequestException(
        'El expediente no está activo',
      );
    }

    if (dto.idCita) {
      await this.ensureAppointmentMatches(
        dto.idCita,
        expediente.id_paciente,
        user.userId,
      );
    }

    if (dto.idEvaluacion) {
      await this.ensureEvaluationMatches(
        dto.idEvaluacion,
        expediente.id_paciente,
      );
    }

    const encrypted =
      this.cryptoService.encryptDetached(
        dto.contenido,
      );

    const rows = await this.db.executeQuery(
      `INSERT INTO dbo.EntradasExpediente (
         id_expediente,
         id_psicologo,
         id_cita,
         id_evaluacion,
         tipo,
         contenido_cifrado,
         nonce,
         etiqueta_autenticacion,
         version
       )
       OUTPUT INSERTED.id_entrada
       VALUES (
         @idExpediente,
         @idPsicologo,
         @idCita,
         @idEvaluacion,
         @tipo,
         @contenidoCifrado,
         @nonce,
         @etiqueta,
         @version
       )`,
      [
        {
          name: 'idExpediente',
          value: idExpediente,
        },
        {
          name: 'idPsicologo',
          value: user.userId,
        },
        {
          name: 'idCita',
          value: dto.idCita ?? null,
        },
        {
          name: 'idEvaluacion',
          value: dto.idEvaluacion ?? null,
        },
        {
          name: 'tipo',
          value: dto.tipo,
        },
        {
          name: 'contenidoCifrado',
          value: encrypted.ciphertext,
        },
        {
          name: 'nonce',
          value: encrypted.nonce,
        },
        {
          name: 'etiqueta',
          value: encrypted.authTag,
        },
        {
          name: 'version',
          value: encrypted.keyVersion,
        },
      ],
    );

    return this.findEntryById(
      rows[0].id_entrada,
      user,
    );
  }

  async cancelEntry(
    idEntrada: number,
    dto: CancelRecordEntryDto,
    user: AuthenticatedUser,
  ) {
    if (user.rol !== ROL_PSICOLOGO) {
      throw new ForbiddenException(
        'Solo un psicólogo puede anular entradas',
      );
    }

    const entry =
      await this.getEntryRaw(idEntrada);

    const expediente =
      await this.getRecordRaw(
        entry.id_expediente,
      );

    await this.ensureAccess(expediente, user);

    if (entry.id_psicologo !== user.userId) {
      throw new ForbiddenException(
        'Solo el autor puede anular esta entrada',
      );
    }

    if (entry.anulada) {
      throw new BadRequestException(
        'La entrada ya está anulada',
      );
    }

    await this.db.executeQuery(
      `UPDATE dbo.EntradasExpediente
       SET
         anulada = 1,
         motivo_anulacion = @motivo
       WHERE id_entrada = @idEntrada`,
      [
        {
          name: 'motivo',
          value: dto.motivoAnulacion,
        },
        {
          name: 'idEntrada',
          value: idEntrada,
        },
      ],
    );

    return this.findEntryById(
      idEntrada,
      user,
    );
  }

  async changeResponsible(
    idExpediente: number,
    dto: ChangeResponsibleDto,
    user: AuthenticatedUser,
  ) {
    if (user.rol !== ROL_ADMINISTRADOR) {
      throw new ForbiddenException(
        'Solo el administrador puede cambiar al responsable',
      );
    }

    const expediente =
      await this.getRecordRaw(idExpediente);

    await this.ensurePsychologistAssigned(
      expediente.id_paciente,
      dto.idPsicologoResponsable,
    );

    await this.db.executeQuery(
      `UPDATE dbo.Expedientes
       SET id_psicologo_responsable =
         @idPsicologo
       WHERE id_expediente =
         @idExpediente`,
      [
        {
          name: 'idPsicologo',
          value: dto.idPsicologoResponsable,
        },
        {
          name: 'idExpediente',
          value: idExpediente,
        },
      ],
    );

    return this.findById(
      idExpediente,
      user,
    );
  }

  async close(
    idExpediente: number,
    dto: CloseRecordDto,
    user: AuthenticatedUser,
  ) {
    const expediente =
      await this.getRecordRaw(idExpediente);

    await this.ensureAccess(expediente, user);

    if (
      user.rol !== ROL_PSICOLOGO &&
      user.rol !== ROL_ADMINISTRADOR
    ) {
      throw new ForbiddenException(
        'No tienes autorización para cerrar expedientes',
      );
    }

    if (expediente.estado !== 1) {
      throw new BadRequestException(
        'El expediente ya está cerrado o archivado',
      );
    }

    await this.db.executeQuery(
      `UPDATE dbo.Expedientes
       SET
         estado = @estado,
         fecha_cierre = SYSUTCDATETIME()
       WHERE id_expediente =
         @idExpediente`,
      [
        {
          name: 'estado',
          value: dto.estado,
        },
        {
          name: 'idExpediente',
          value: idExpediente,
        },
      ],
    );

    return this.findById(
      idExpediente,
      user,
    );
  }

  async reopen(
    idExpediente: number,
    user: AuthenticatedUser,
  ) {
    if (user.rol !== ROL_ADMINISTRADOR) {
      throw new ForbiddenException(
        'Solo el administrador puede reabrir expedientes',
      );
    }

    await this.getRecordRaw(idExpediente);

    await this.db.executeQuery(
      `UPDATE dbo.Expedientes
       SET
         estado = 1,
         fecha_cierre = NULL
       WHERE id_expediente =
         @idExpediente`,
      [
        {
          name: 'idExpediente',
          value: idExpediente,
        },
      ],
    );

    return this.findById(
      idExpediente,
      user,
    );
  }

  async createAttachment(
    idEntrada: number,
    dto: CreateAttachmentDto,
    user: AuthenticatedUser,
  ) {
    const entry =
      await this.getEntryRaw(idEntrada);

    const expediente =
      await this.getRecordRaw(
        entry.id_expediente,
      );

    await this.ensureAccess(expediente, user);

    if (
      user.rol !== ROL_PSICOLOGO &&
      user.rol !== ROL_ADMINISTRADOR
    ) {
      throw new ForbiddenException(
        'No puedes registrar adjuntos',
      );
    }

    if (entry.anulada) {
      throw new BadRequestException(
        'No se pueden agregar adjuntos a una entrada anulada',
      );
    }

    const encryptedName =
      this.cryptoService.encrypt(
        dto.nombreArchivo,
      );

    const hash = Buffer.from(
      dto.hashSha256,
      'hex',
    );

    if (hash.length !== 32) {
      throw new BadRequestException(
        'El hash SHA-256 debe tener 32 bytes',
      );
    }

    const rows = await this.db.executeQuery(
      `INSERT INTO dbo.AdjuntosExpediente (
         id_entrada,
         nombre_archivo_cifrado,
         tipo_mime,
         tamano_bytes,
         ubicacion_objeto,
         hash_sha256,
         cargado_por
       )
       OUTPUT INSERTED.id_adjunto
       VALUES (
         @idEntrada,
         @nombreCifrado,
         @tipoMime,
         @tamanoBytes,
         @ubicacion,
         @hash,
         @cargadoPor
       )`,
      [
        {
          name: 'idEntrada',
          value: idEntrada,
        },
        {
          name: 'nombreCifrado',
          value: encryptedName,
        },
        {
          name: 'tipoMime',
          value: dto.tipoMime,
        },
        {
          name: 'tamanoBytes',
          value: dto.tamanoBytes,
        },
        {
          name: 'ubicacion',
          value: dto.ubicacionObjeto,
        },
        {
          name: 'hash',
          value: hash,
        },
        {
          name: 'cargadoPor',
          value: user.userId,
        },
      ],
    );

    return this.findAttachmentById(
      rows[0].id_adjunto,
      user,
    );
  }

  async findAttachments(
    idEntrada: number,
    user: AuthenticatedUser,
  ) {
    const entry =
      await this.getEntryRaw(idEntrada);

    const expediente =
      await this.getRecordRaw(
        entry.id_expediente,
      );

    await this.ensureAccess(expediente, user);

    const rows = await this.db.executeQuery(
      `SELECT
          id_adjunto,
          id_entrada,
          nombre_archivo_cifrado,
          tipo_mime,
          tamano_bytes,
          ubicacion_objeto,
          hash_sha256,
          fecha_carga,
          cargado_por
       FROM dbo.AdjuntosExpediente
       WHERE id_entrada = @idEntrada
       ORDER BY fecha_carga DESC`,
      [
        {
          name: 'idEntrada',
          value: idEntrada,
        },
      ],
    );

    return rows.map((file) =>
      this.mapAttachment(file),
    );
  }

  async findAttachmentById(
    idAdjunto: number,
    user: AuthenticatedUser,
  ) {
    const rows = await this.db.executeQuery(
      `SELECT
          a.id_adjunto,
          a.id_entrada,
          a.nombre_archivo_cifrado,
          a.tipo_mime,
          a.tamano_bytes,
          a.ubicacion_objeto,
          a.hash_sha256,
          a.fecha_carga,
          a.cargado_por,
          en.id_expediente
       FROM dbo.AdjuntosExpediente a
       INNER JOIN dbo.EntradasExpediente en
         ON en.id_entrada = a.id_entrada
       WHERE a.id_adjunto = @idAdjunto`,
      [
        {
          name: 'idAdjunto',
          value: idAdjunto,
        },
      ],
    );

    const file = rows[0];

    if (!file) {
      throw new NotFoundException(
        'Adjunto no encontrado',
      );
    }

    const expediente =
      await this.getRecordRaw(
        file.id_expediente,
      );

    await this.ensureAccess(expediente, user);

    return this.mapAttachment(file);
  }

  private async getRecordRaw(
    idExpediente: number,
  ) {
    const rows = await this.db.executeQuery(
      `SELECT
          e.id_expediente,
          e.id_paciente,
          paciente.nombre AS paciente,
          e.id_psicologo_responsable,
          psicologo.nombre AS psicologo_responsable,
          e.estado,
          e.fecha_apertura,
          e.fecha_cierre,
          e.motivo_consulta
       FROM dbo.Expedientes e
       INNER JOIN dbo.Usuarios paciente
         ON paciente.id_usuario =
            e.id_paciente
       LEFT JOIN dbo.Usuarios psicologo
         ON psicologo.id_usuario =
            e.id_psicologo_responsable
       WHERE e.id_expediente =
         @idExpediente`,
      [
        {
          name: 'idExpediente',
          value: idExpediente,
        },
      ],
    );

    if (!rows[0]) {
      throw new NotFoundException(
        'Expediente no encontrado',
      );
    }

    return rows[0];
  }

  private async getEntryRaw(
    idEntrada: number,
  ) {
    const rows = await this.db.executeQuery(
      `SELECT
          id_entrada,
          id_expediente,
          id_psicologo,
          id_cita,
          id_evaluacion,
          tipo,
          fecha_registro,
          contenido_cifrado,
          nonce,
          etiqueta_autenticacion,
          version,
          anulada,
          motivo_anulacion
       FROM dbo.EntradasExpediente
       WHERE id_entrada = @idEntrada`,
      [
        {
          name: 'idEntrada',
          value: idEntrada,
        },
      ],
    );

    if (!rows[0]) {
      throw new NotFoundException(
        'Entrada no encontrada',
      );
    }

    return rows[0];
  }

  private mapEntry(entry: any) {
    return {
      idEntrada: entry.id_entrada,
      idExpediente: entry.id_expediente,
      idPsicologo: entry.id_psicologo,
      psicologo: entry.psicologo ?? null,
      idCita: entry.id_cita,
      idEvaluacion: entry.id_evaluacion,
      tipo: entry.tipo,
      fechaRegistro: entry.fecha_registro,
      anulada: Boolean(entry.anulada),
      motivoAnulacion:
        entry.motivo_anulacion,
      contenido: entry.anulada
        ? null
        : this.cryptoService
            .decryptDetachedToString(
              entry.contenido_cifrado,
              entry.nonce,
              entry.etiqueta_autenticacion,
              entry.version,
            ),
    };
  }

  private mapAttachment(file: any) {
    return {
      idAdjunto: file.id_adjunto,
      idEntrada: file.id_entrada,
      nombreArchivo:
        this.cryptoService.decrypt(
          file.nombre_archivo_cifrado,
        ),
      tipoMime: file.tipo_mime,
      tamanoBytes: file.tamano_bytes,
      ubicacionObjeto:
        file.ubicacion_objeto,
      hashSha256: Buffer.from(
        file.hash_sha256,
      ).toString('hex'),
      fechaCarga: file.fecha_carga,
      cargadoPor: file.cargado_por,
    };
  }

  private async ensureAccess(
    expediente: {
      id_paciente: number;
      id_psicologo_responsable:
        number | null;
    },
    user: AuthenticatedUser,
  ) {
    if (user.rol === ROL_ADMINISTRADOR) {
      return;
    }

    if (
      user.rol === ROL_PSICOLOGO &&
      user.userId ===
        expediente.id_psicologo_responsable
    ) {
      return;
    }

    throw new ForbiddenException(
      'No tienes acceso a este expediente',
    );
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

  private async ensurePsychologistAssigned(
    idPaciente: number,
    idPsicologo: number,
  ) {
    const rows = await this.db.executeQuery(
      `SELECT id_asignacion
       FROM dbo.PacientePsicologo
       WHERE id_paciente = @idPaciente
         AND id_psicologo = @idPsicologo
         AND es_principal = 1
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

    if (!rows[0]) {
      throw new BadRequestException(
        'El psicólogo no es el responsable principal del paciente',
      );
    }
  }

  private async ensureAppointmentMatches(
    idCita: number,
    idPaciente: number,
    idPsicologo: number,
  ) {
    const rows = await this.db.executeQuery(
      `SELECT id_cita
       FROM dbo.Citas
       WHERE id_cita = @idCita
         AND id_paciente = @idPaciente
         AND id_psicologo = @idPsicologo`,
      [
        {
          name: 'idCita',
          value: idCita,
        },
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

    if (!rows[0]) {
      throw new BadRequestException(
        'La cita no corresponde al expediente',
      );
    }
  }

  private async ensureEvaluationMatches(
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
        'La evaluación no corresponde al expediente',
      );
    }
  }
}