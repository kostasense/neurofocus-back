import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CreateChannelDto } from './dto/create-channel.dto.js';
import { RegisterChannelKeyDto } from './dto/register-channel-key.dto.js';
import { SendEncryptedMessageDto } from './dto/send-encrypted-message.dto.js';
import { CreatePanicAlertDto } from './dto/create-panic-alert.dto.js';
import { UpdatePanicStatusDto } from './dto/update-panic-status.dto.js';

const ROL_PACIENTE = 1;
const ROL_PSICOLOGO = 2;
const ROL_ADMINISTRADOR = 3;

interface AuthenticatedUser {
  userId: number;
  correo: string;
  rol: number;
}

@Injectable()
export class ChatService {
  constructor(private readonly db: DatabaseService) {}

  async createChannel(dto: CreateChannelDto, user: AuthenticatedUser) {
    this.ensurePairAccess(dto.idPaciente, dto.idPsicologo, user);
    await this.ensureActiveAssignment(dto.idPaciente, dto.idPsicologo);

    const existing = await this.db.executeQuery(
      `SELECT id_canal
       FROM dbo.CanalesChat
       WHERE id_paciente = @idPaciente
         AND id_psicologo = @idPsicologo`,
      [
        { name: 'idPaciente', value: dto.idPaciente },
        { name: 'idPsicologo', value: dto.idPsicologo },
      ],
    );

    if (existing[0]) {
      return this.findChannelById(existing[0].id_canal, user);
    }

    const rows = await this.db.executeQuery(
      `INSERT INTO dbo.CanalesChat (id_paciente, id_psicologo)
       OUTPUT INSERTED.id_canal
       VALUES (@idPaciente, @idPsicologo)`,
      [
        { name: 'idPaciente', value: dto.idPaciente },
        { name: 'idPsicologo', value: dto.idPsicologo },
      ],
    );

    return this.findChannelById(rows[0].id_canal, user);
  }

  async findMyChannels(user: AuthenticatedUser) {
    if (user.rol === ROL_ADMINISTRADOR) {
      return this.db.executeQuery(
        `SELECT c.*, paciente.nombre AS paciente, psicologo.nombre AS psicologo
         FROM dbo.CanalesChat c
         INNER JOIN dbo.Usuarios paciente ON paciente.id_usuario = c.id_paciente
         INNER JOIN dbo.Usuarios psicologo ON psicologo.id_usuario = c.id_psicologo
         ORDER BY COALESCE(c.ultima_actividad, c.fecha_creacion) DESC`,
      );
    }

    const column = user.rol === ROL_PACIENTE ? 'id_paciente' : 'id_psicologo';
    if (![ROL_PACIENTE, ROL_PSICOLOGO].includes(user.rol)) {
      throw new ForbiddenException('No tienes acceso al chat');
    }

    return this.db.executeQuery(
      `SELECT c.*, paciente.nombre AS paciente, psicologo.nombre AS psicologo
       FROM dbo.CanalesChat c
       INNER JOIN dbo.Usuarios paciente ON paciente.id_usuario = c.id_paciente
       INNER JOIN dbo.Usuarios psicologo ON psicologo.id_usuario = c.id_psicologo
       WHERE c.${column} = @idUsuario
       ORDER BY COALESCE(c.ultima_actividad, c.fecha_creacion) DESC`,
      [{ name: 'idUsuario', value: user.userId }],
    );
  }

  async findChannelById(idCanal: number, user: AuthenticatedUser) {
    const channel = await this.getChannelRaw(idCanal);
    this.ensureChannelAccess(channel, user);
    return channel;
  }

  async setEnabled(idCanal: number, enabled: boolean, user: AuthenticatedUser) {
    const channel = await this.getChannelRaw(idCanal);

    if (user.rol !== ROL_PSICOLOGO || user.userId !== channel.id_psicologo) {
      throw new ForbiddenException('Solo el psicólogo del canal puede habilitarlo');
    }

    if (!channel.abierto && enabled) {
      throw new BadRequestException('No se puede habilitar un canal cerrado');
    }

    await this.db.executeQuery(
      `UPDATE dbo.CanalesChat
       SET habilitado_por_psicologo = @enabled
       WHERE id_canal = @idCanal`,
      [
        { name: 'enabled', value: enabled },
        { name: 'idCanal', value: idCanal },
      ],
    );

    return this.findChannelById(idCanal, user);
  }

  async closeChannel(idCanal: number, user: AuthenticatedUser) {
    const channel = await this.getChannelRaw(idCanal);
    this.ensurePsychologistOrAdmin(channel, user);

    await this.db.executeQuery(
      `UPDATE dbo.CanalesChat
       SET abierto = 0,
           habilitado_por_psicologo = 0,
           fecha_cierre = COALESCE(fecha_cierre, SYSUTCDATETIME())
       WHERE id_canal = @idCanal`,
      [{ name: 'idCanal', value: idCanal }],
    );

    return this.findChannelById(idCanal, user);
  }

  async registerKeyEnvelope(
    idCanal: number,
    dto: RegisterChannelKeyDto,
    user: AuthenticatedUser,
  ) {
    const channel = await this.getChannelRaw(idCanal);
    this.ensureParticipant(channel, user);

    const envelope = Buffer.from(dto.sobreClaveCifrado, 'base64');
    if (!envelope.length || envelope.length > 8000) {
      throw new BadRequestException('El sobre de clave no es válido');
    }

    const existing = await this.db.executeQuery(
      `SELECT 1 AS existe
       FROM dbo.ClavesCanalParticipante
       WHERE id_canal = @idCanal
         AND id_usuario = @idUsuario
         AND version_clave = @versionClave`,
      [
        { name: 'idCanal', value: idCanal },
        { name: 'idUsuario', value: user.userId },
        { name: 'versionClave', value: dto.versionClave },
      ],
    );

    if (existing[0]) {
      throw new ConflictException('La versión de clave ya está registrada');
    }

    await this.db.executeQuery(
      `INSERT INTO dbo.ClavesCanalParticipante (
         id_canal, id_usuario, sobre_clave_cifrado, version_clave
       ) VALUES (
         @idCanal, @idUsuario, @sobreClave, @versionClave
       )`,
      [
        { name: 'idCanal', value: idCanal },
        { name: 'idUsuario', value: user.userId },
        { name: 'sobreClave', value: envelope },
        { name: 'versionClave', value: dto.versionClave },
      ],
    );

    return { idCanal, versionClave: dto.versionClave, registrada: true };
  }

  async getMyKeyEnvelope(
    idCanal: number,
    versionClave: number,
    user: AuthenticatedUser,
  ) {
    const channel = await this.getChannelRaw(idCanal);
    this.ensureParticipant(channel, user);

    const rows = await this.db.executeQuery(
      `SELECT sobre_clave_cifrado, version_clave, fecha_creacion
       FROM dbo.ClavesCanalParticipante
       WHERE id_canal = @idCanal
         AND id_usuario = @idUsuario
         AND version_clave = @versionClave`,
      [
        { name: 'idCanal', value: idCanal },
        { name: 'idUsuario', value: user.userId },
        { name: 'versionClave', value: versionClave },
      ],
    );

    if (!rows[0]) {
      throw new NotFoundException('Sobre de clave no encontrado');
    }

    return {
      sobreClaveCifrado: Buffer.from(rows[0].sobre_clave_cifrado).toString('base64'),
      versionClave: rows[0].version_clave,
      fechaCreacion: rows[0].fecha_creacion,
    };
  }

  async sendMessage(
    idCanal: number,
    dto: SendEncryptedMessageDto,
    user: AuthenticatedUser,
  ) {
    const channel = await this.getChannelRaw(idCanal);
    this.ensureParticipant(channel, user);
    await this.ensureChannelUsable(channel);
    await this.ensureKeyVersionForBothParticipants(channel, dto.versionClave);

    return this.insertEncryptedMessage(idCanal, user.userId, dto, dto.tipoMensaje);
  }

  async findMessages(
    idCanal: number,
    user: AuthenticatedUser,
    beforeId?: number,
    limit = 50,
  ) {
    const channel = await this.getChannelRaw(idCanal);
    this.ensureParticipant(channel, user);

    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const rows = await this.db.executeQuery(
      `SELECT TOP (@limit)
          id_mensaje, id_canal, id_emisor, fecha_envio,
          mensaje_cifrado, nonce, etiqueta_autenticacion,
          version_clave, tipo_mensaje, entregado, leido
       FROM dbo.MensajesChat
       WHERE id_canal = @idCanal
         AND (@beforeId IS NULL OR id_mensaje < @beforeId)
         AND (
           (id_emisor = @idUsuario AND eliminado_emisor = 0)
           OR
           (id_emisor <> @idUsuario AND eliminado_receptor = 0)
         )
       ORDER BY id_mensaje DESC`,
      [
        { name: 'limit', value: safeLimit },
        { name: 'idCanal', value: idCanal },
        { name: 'beforeId', value: beforeId ?? null },
        { name: 'idUsuario', value: user.userId },
      ],
    );

    return rows.map((row) => this.mapEncryptedMessage(row)).reverse();
  }

  async markDelivered(idMensaje: number, user: AuthenticatedUser) {
    const message = await this.getMessageRaw(idMensaje);
    const channel = await this.getChannelRaw(message.id_canal);
    this.ensureReceiver(channel, message.id_emisor, user);

    await this.db.executeQuery(
      `UPDATE dbo.MensajesChat
       SET entregado = COALESCE(entregado, SYSUTCDATETIME())
       WHERE id_mensaje = @idMensaje`,
      [{ name: 'idMensaje', value: idMensaje }],
    );

    return { idMensaje, entregado: true };
  }

  async markRead(idMensaje: number, user: AuthenticatedUser) {
    const message = await this.getMessageRaw(idMensaje);
    const channel = await this.getChannelRaw(message.id_canal);
    this.ensureReceiver(channel, message.id_emisor, user);

    await this.db.executeQuery(
      `UPDATE dbo.MensajesChat
       SET entregado = COALESCE(entregado, SYSUTCDATETIME()),
           leido = COALESCE(leido, SYSUTCDATETIME())
       WHERE id_mensaje = @idMensaje`,
      [{ name: 'idMensaje', value: idMensaje }],
    );

    return { idMensaje, leido: true };
  }

  async hideMessage(idMensaje: number, user: AuthenticatedUser) {
    const message = await this.getMessageRaw(idMensaje);
    const channel = await this.getChannelRaw(message.id_canal);
    this.ensureParticipant(channel, user);

    const column = message.id_emisor === user.userId
      ? 'eliminado_emisor'
      : 'eliminado_receptor';

    await this.db.executeQuery(
      `UPDATE dbo.MensajesChat
       SET ${column} = 1
       WHERE id_mensaje = @idMensaje`,
      [{ name: 'idMensaje', value: idMensaje }],
    );

    return { idMensaje, oculto: true };
  }

  async createPanicAlert(
    idCanal: number,
    dto: CreatePanicAlertDto,
    user: AuthenticatedUser,
  ) {
    const channel = await this.getChannelRaw(idCanal);

    if (user.rol !== ROL_PACIENTE || user.userId !== channel.id_paciente) {
      throw new ForbiddenException('Solo el paciente puede activar la alerta');
    }

    await this.ensureChannelUsable(channel);
    await this.ensureKeyVersionForBothParticipants(channel, dto.versionClave);

    const payload = this.decodeEncryptedPayload(dto);
    const pool = this.db.getPool();
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      const alertResult = await transaction
        .request()
        .input('idCanal', idCanal)
        .input('idPaciente', channel.id_paciente)
        .input('idPsicologo', channel.id_psicologo)
        .query(`
          INSERT INTO dbo.AlertasPanico (
            id_canal, id_paciente, id_psicologo, estado
          )
          OUTPUT INSERTED.id_alerta
          VALUES (@idCanal, @idPaciente, @idPsicologo, 2)
        `);

      const messageResult = await transaction
        .request()
        .input('idCanal', idCanal)
        .input('idEmisor', user.userId)
        .input('mensajeCifrado', payload.ciphertext)
        .input('nonce', payload.nonce)
        .input('etiqueta', payload.authTag)
        .input('versionClave', dto.versionClave)
        .query(`
          INSERT INTO dbo.MensajesChat (
            id_canal, id_emisor, mensaje_cifrado, nonce,
            etiqueta_autenticacion, version_clave, tipo_mensaje
          )
          OUTPUT INSERTED.id_mensaje
          VALUES (
            @idCanal, @idEmisor, @mensajeCifrado, @nonce,
            @etiqueta, @versionClave, 3
          )
        `);

      await transaction
        .request()
        .input('idCanal', idCanal)
        .query(`
          UPDATE dbo.CanalesChat
          SET ultima_actividad = SYSUTCDATETIME()
          WHERE id_canal = @idCanal
        `);

      await transaction.commit();

      return {
        idAlerta: alertResult.recordset[0].id_alerta,
        idMensaje: messageResult.recordset[0].id_mensaje,
        estado: 2,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async findPanicAlerts(user: AuthenticatedUser, estado?: number) {
    if (![ROL_PSICOLOGO, ROL_ADMINISTRADOR].includes(user.rol)) {
      throw new ForbiddenException('No tienes acceso a las alertas');
    }

    return this.db.executeQuery(
      `SELECT a.*, paciente.nombre AS paciente
       FROM dbo.AlertasPanico a
       INNER JOIN dbo.Usuarios paciente ON paciente.id_usuario = a.id_paciente
       WHERE (@idPsicologo IS NULL OR a.id_psicologo = @idPsicologo)
         AND (@estado IS NULL OR a.estado = @estado)
       ORDER BY a.fecha_alerta DESC`,
      [
        {
          name: 'idPsicologo',
          value: user.rol === ROL_PSICOLOGO ? user.userId : null,
        },
        { name: 'estado', value: estado ?? null },
      ],
    );
  }

  async updatePanicStatus(
    idAlerta: number,
    dto: UpdatePanicStatusDto,
    user: AuthenticatedUser,
  ) {
    const alert = await this.getPanicAlertRaw(idAlerta);

    if (
      user.rol !== ROL_ADMINISTRADOR &&
      !(user.rol === ROL_PSICOLOGO && user.userId === alert.id_psicologo)
    ) {
      throw new ForbiddenException('No puedes modificar esta alerta');
    }

    if (dto.estado < alert.estado) {
      throw new BadRequestException('No se puede retroceder el estado');
    }

    await this.db.executeQuery(
      `UPDATE dbo.AlertasPanico
       SET estado = @estado,
           fecha_vista = CASE
             WHEN @estado >= 3 THEN COALESCE(fecha_vista, SYSUTCDATETIME())
             ELSE fecha_vista
           END,
           fecha_atencion = CASE
             WHEN @estado >= 4 THEN COALESCE(fecha_atencion, SYSUTCDATETIME())
             ELSE fecha_atencion
           END
       WHERE id_alerta = @idAlerta`,
      [
        { name: 'estado', value: dto.estado },
        { name: 'idAlerta', value: idAlerta },
      ],
    );

    return this.getPanicAlertRaw(idAlerta);
  }

  private async insertEncryptedMessage(
    idCanal: number,
    idEmisor: number,
    dto: SendEncryptedMessageDto,
    tipoMensaje: number,
  ) {
    const payload = this.decodeEncryptedPayload(dto);
    const rows = await this.db.executeQuery(
      `INSERT INTO dbo.MensajesChat (
         id_canal, id_emisor, mensaje_cifrado, nonce,
         etiqueta_autenticacion, version_clave, tipo_mensaje
       )
       OUTPUT INSERTED.id_mensaje, INSERTED.fecha_envio
       VALUES (
         @idCanal, @idEmisor, @mensajeCifrado, @nonce,
         @etiqueta, @versionClave, @tipoMensaje
       );
       UPDATE dbo.CanalesChat
       SET ultima_actividad = SYSUTCDATETIME()
       WHERE id_canal = @idCanal;`,
      [
        { name: 'idCanal', value: idCanal },
        { name: 'idEmisor', value: idEmisor },
        { name: 'mensajeCifrado', value: payload.ciphertext },
        { name: 'nonce', value: payload.nonce },
        { name: 'etiqueta', value: payload.authTag },
        { name: 'versionClave', value: dto.versionClave },
        { name: 'tipoMensaje', value: tipoMensaje },
      ],
    );

    return {
      idMensaje: rows[0].id_mensaje,
      fechaEnvio: rows[0].fecha_envio,
    };
  }

  private decodeEncryptedPayload(dto: {
    mensajeCifrado: string;
    nonce: string;
    etiquetaAutenticacion: string;
  }) {
    const ciphertext = Buffer.from(dto.mensajeCifrado, 'base64');
    const nonce = Buffer.from(dto.nonce, 'base64');
    const authTag = Buffer.from(dto.etiquetaAutenticacion, 'base64');

    if (!ciphertext.length) {
      throw new BadRequestException('El mensaje cifrado está vacío');
    }
    if (!nonce.length || nonce.length > 24) {
      throw new BadRequestException('El nonce no es válido');
    }
    if (!authTag.length || authTag.length > 32) {
      throw new BadRequestException('La etiqueta no es válida');
    }

    return { ciphertext, nonce, authTag };
  }

  private mapEncryptedMessage(row: any) {
    return {
      idMensaje: row.id_mensaje,
      idCanal: row.id_canal,
      idEmisor: row.id_emisor,
      fechaEnvio: row.fecha_envio,
      mensajeCifrado: Buffer.from(row.mensaje_cifrado).toString('base64'),
      nonce: Buffer.from(row.nonce).toString('base64'),
      etiquetaAutenticacion: Buffer.from(row.etiqueta_autenticacion).toString('base64'),
      versionClave: row.version_clave,
      tipoMensaje: row.tipo_mensaje,
      entregado: row.entregado,
      leido: row.leido,
    };
  }

  private async getChannelRaw(idCanal: number) {
    const rows = await this.db.executeQuery(
      `SELECT c.*, ps.chat_disponible
       FROM dbo.CanalesChat c
       INNER JOIN dbo.Psicologos ps ON ps.id_psicologo = c.id_psicologo
       WHERE c.id_canal = @idCanal`,
      [{ name: 'idCanal', value: idCanal }],
    );

    if (!rows[0]) {
      throw new NotFoundException('Canal no encontrado');
    }
    return rows[0];
  }

  private async getMessageRaw(idMensaje: number) {
    const rows = await this.db.executeQuery(
      `SELECT id_mensaje, id_canal, id_emisor
       FROM dbo.MensajesChat
       WHERE id_mensaje = @idMensaje`,
      [{ name: 'idMensaje', value: idMensaje }],
    );
    if (!rows[0]) {
      throw new NotFoundException('Mensaje no encontrado');
    }
    return rows[0];
  }

  private async getPanicAlertRaw(idAlerta: number) {
    const rows = await this.db.executeQuery(
      `SELECT * FROM dbo.AlertasPanico WHERE id_alerta = @idAlerta`,
      [{ name: 'idAlerta', value: idAlerta }],
    );
    if (!rows[0]) {
      throw new NotFoundException('Alerta no encontrada');
    }
    return rows[0];
  }

  private async ensureActiveAssignment(idPaciente: number, idPsicologo: number) {
    const rows = await this.db.executeQuery(
      `SELECT 1 AS existe
       FROM dbo.PacientePsicologo
       WHERE id_paciente = @idPaciente
         AND id_psicologo = @idPsicologo
         AND fecha_fin IS NULL`,
      [
        { name: 'idPaciente', value: idPaciente },
        { name: 'idPsicologo', value: idPsicologo },
      ],
    );
    if (!rows[0]) {
      throw new BadRequestException('No existe una asignación activa');
    }
  }

  private async ensureChannelUsable(channel: any) {
    if (!channel.abierto) {
      throw new BadRequestException('El canal está cerrado');
    }
    if (!channel.habilitado_por_psicologo || !channel.chat_disponible) {
      throw new BadRequestException('El chat no está disponible');
    }
  }

  private async ensureKeyVersionForBothParticipants(channel: any, version: number) {
    const rows = await this.db.executeQuery(
      `SELECT COUNT(*) AS total
       FROM dbo.ClavesCanalParticipante
       WHERE id_canal = @idCanal
         AND version_clave = @versionClave
         AND id_usuario IN (@idPaciente, @idPsicologo)`,
      [
        { name: 'idCanal', value: channel.id_canal },
        { name: 'versionClave', value: version },
        { name: 'idPaciente', value: channel.id_paciente },
        { name: 'idPsicologo', value: channel.id_psicologo },
      ],
    );
    if (Number(rows[0]?.total) !== 2) {
      throw new BadRequestException('La versión de clave no está registrada para ambos participantes');
    }
  }

  private ensurePairAccess(idPaciente: number, idPsicologo: number, user: AuthenticatedUser) {
    if (user.rol === ROL_ADMINISTRADOR) return;
    if (user.rol === ROL_PACIENTE && user.userId === idPaciente) return;
    if (user.rol === ROL_PSICOLOGO && user.userId === idPsicologo) return;
    throw new ForbiddenException('No puedes crear este canal');
  }

  private ensureChannelAccess(channel: any, user: AuthenticatedUser) {
    if (user.rol === ROL_ADMINISTRADOR) return;
    this.ensureParticipant(channel, user);
  }

  private ensureParticipant(channel: any, user: AuthenticatedUser) {
    if (
      user.userId !== channel.id_paciente &&
      user.userId !== channel.id_psicologo
    ) {
      throw new ForbiddenException('No perteneces a este canal');
    }
  }

  private ensureReceiver(channel: any, idEmisor: number, user: AuthenticatedUser) {
    this.ensureParticipant(channel, user);
    if (user.userId === idEmisor) {
      throw new ForbiddenException('El emisor no puede marcar su propio mensaje');
    }
  }

  private ensurePsychologistOrAdmin(channel: any, user: AuthenticatedUser) {
    if (user.rol === ROL_ADMINISTRADOR) return;
    if (user.rol === ROL_PSICOLOGO && user.userId === channel.id_psicologo) return;
    throw new ForbiddenException('No puedes administrar este canal');
  }
}
