import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CreateNotificationDto } from './dto/create-notification.dto.js';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto.js';

const ROL_ADMINISTRADOR = 3;

interface AuthenticatedUser {
  userId: number;
  correo: string;
  rol: number;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Método reutilizable por otros servicios del backend.
   * Ejemplos: citas, chat, alertas de pánico y avisos del sistema.
   */
  async createForUser(dto: CreateNotificationDto) {
    await this.ensureUserExists(dto.idUsuario);

    const titulo = dto.titulo.trim();
    const cuerpo = dto.cuerpo.trim();

    if (!titulo || !cuerpo) {
      throw new BadRequestException(
        'El título y el cuerpo no pueden estar vacíos',
      );
    }

    const rows = await this.db.executeQuery(
      `INSERT INTO dbo.Notificaciones (
         id_usuario,
         tipo,
         titulo,
         cuerpo,
         referencia_id,
         prioridad
       )
       OUTPUT
         INSERTED.id_notificacion,
         INSERTED.fecha_creacion
       VALUES (
         @idUsuario,
         @tipo,
         @titulo,
         @cuerpo,
         @referenciaId,
         @prioridad
       )`,
      [
        { name: 'idUsuario', value: dto.idUsuario },
        { name: 'tipo', value: dto.tipo },
        { name: 'titulo', value: titulo },
        { name: 'cuerpo', value: cuerpo },
        { name: 'referenciaId', value: dto.referenciaId ?? null },
        { name: 'prioridad', value: dto.prioridad ?? 1 },
      ],
    );

    return this.findRawById(rows[0].id_notificacion);
  }

  /** Endpoint administrativo para crear avisos manuales. */
  async create(dto: CreateNotificationDto, user: AuthenticatedUser) {
    if (user.rol !== ROL_ADMINISTRADOR) {
      throw new ForbiddenException(
        'Solo un administrador puede crear notificaciones manuales',
      );
    }

    return this.createForUser(dto);
  }

  async findMine(
    user: AuthenticatedUser,
    query: ListNotificationsQueryDto,
  ) {
    const limite = query.limite ?? 30;
    const desplazamiento = query.desplazamiento ?? 0;

    return this.db.executeQuery(
      `SELECT
          id_notificacion,
          id_usuario,
          tipo,
          titulo,
          cuerpo,
          referencia_id,
          fecha_creacion,
          fecha_leida,
          prioridad
       FROM dbo.Notificaciones
       WHERE id_usuario = @idUsuario
         AND (@soloNoLeidas = 0 OR fecha_leida IS NULL)
         AND (@tipo IS NULL OR tipo = @tipo)
         AND (@prioridad IS NULL OR prioridad = @prioridad)
       ORDER BY fecha_creacion DESC, id_notificacion DESC
       OFFSET @desplazamiento ROWS
       FETCH NEXT @limite ROWS ONLY`,
      [
        { name: 'idUsuario', value: user.userId },
        { name: 'soloNoLeidas', value: query.soloNoLeidas ?? false },
        { name: 'tipo', value: query.tipo ?? null },
        { name: 'prioridad', value: query.prioridad ?? null },
        { name: 'desplazamiento', value: desplazamiento },
        { name: 'limite', value: limite },
      ],
    );
  }

  async countUnread(user: AuthenticatedUser) {
    const rows = await this.db.executeQuery(
      `SELECT COUNT_BIG(*) AS total
       FROM dbo.Notificaciones
       WHERE id_usuario = @idUsuario
         AND fecha_leida IS NULL`,
      [{ name: 'idUsuario', value: user.userId }],
    );

    return { total: Number(rows[0]?.total ?? 0) };
  }

  async findById(idNotificacion: number, user: AuthenticatedUser) {
    const notification = await this.findRawById(idNotificacion);
    this.ensureOwnerOrAdmin(notification.id_usuario, user);
    return notification;
  }

  async markAsRead(idNotificacion: number, user: AuthenticatedUser) {
    const notification = await this.findRawById(idNotificacion);

    if (notification.id_usuario !== user.userId) {
      throw new ForbiddenException(
        'Solo el destinatario puede marcar la notificación como leída',
      );
    }

    await this.db.executeQuery(
      `UPDATE dbo.Notificaciones
       SET fecha_leida = COALESCE(fecha_leida, SYSUTCDATETIME())
       WHERE id_notificacion = @idNotificacion`,
      [{ name: 'idNotificacion', value: idNotificacion }],
    );

    return this.findRawById(idNotificacion);
  }

  async markAllAsRead(user: AuthenticatedUser) {
    await this.db.executeQuery(
      `UPDATE dbo.Notificaciones
       SET fecha_leida = SYSUTCDATETIME()
       WHERE id_usuario = @idUsuario
         AND fecha_leida IS NULL`,
      [{ name: 'idUsuario', value: user.userId }],
    );

    return { actualizadas: true };
  }

  /**
   * Reabre una notificación leída. Se permite solo al destinatario.
   */
  async markAsUnread(idNotificacion: number, user: AuthenticatedUser) {
    const notification = await this.findRawById(idNotificacion);

    if (notification.id_usuario !== user.userId) {
      throw new ForbiddenException(
        'Solo el destinatario puede modificar esta notificación',
      );
    }

    await this.db.executeQuery(
      `UPDATE dbo.Notificaciones
       SET fecha_leida = NULL
       WHERE id_notificacion = @idNotificacion`,
      [{ name: 'idNotificacion', value: idNotificacion }],
    );

    return this.findRawById(idNotificacion);
  }

  private async findRawById(idNotificacion: number) {
    const rows = await this.db.executeQuery(
      `SELECT
          id_notificacion,
          id_usuario,
          tipo,
          titulo,
          cuerpo,
          referencia_id,
          fecha_creacion,
          fecha_leida,
          prioridad
       FROM dbo.Notificaciones
       WHERE id_notificacion = @idNotificacion`,
      [{ name: 'idNotificacion', value: idNotificacion }],
    );

    if (!rows[0]) {
      throw new NotFoundException(
        'Notificación no encontrada',
      );
    }

    return rows[0];
  }

  private async ensureUserExists(idUsuario: number) {
    const rows = await this.db.executeQuery(
      `SELECT id_usuario
       FROM dbo.Usuarios
       WHERE id_usuario = @idUsuario
         AND activo = 1`,
      [{ name: 'idUsuario', value: idUsuario }],
    );

    if (!rows[0]) {
      throw new NotFoundException(
        'Usuario no encontrado o inactivo',
      );
    }
  }

  private ensureOwnerOrAdmin(
    idUsuario: number,
    user: AuthenticatedUser,
  ) {
    if (
      user.rol !== ROL_ADMINISTRADOR &&
      user.userId !== idUsuario
    ) {
      throw new ForbiddenException(
        'No tienes acceso a esta notificación',
      );
    }
  }
}
