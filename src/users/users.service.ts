import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { RegisterDto } from './dto/register.dto.js';

const ROL_PACIENTE = 1;
const ROL_PSICOLOGO = 2;

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Usado por AuthService.validateUser(). Incluye password_hash
   * porque es el único método que necesita comparar la contraseña.
   */
  async findByEmail(correo: string): Promise<any | null> {
    const rows = await this.db.executeQuery(
      `SELECT id_usuario, correo, password_hash, nombre, id_rol, activo
       FROM dbo.Usuarios
       WHERE correo = @correo`,
      [{ name: 'correo', value: correo }],
    );
    return rows[0] || null;
  }

  /**
   * Usado por AuthService.refreshTokens(). Mismo motivo que findByEmail:
   * incluye password_hash para no tener que hacer dos consultas distintas,
   * pero el campo nunca sale de este servicio hacia el cliente.
   */
  async findById(idUsuario: number): Promise<any | null> {
    const rows = await this.db.executeQuery(
      `SELECT id_usuario, correo, password_hash, nombre, id_rol, activo
       FROM dbo.Usuarios
       WHERE id_usuario = @idUsuario`,
      [{ name: 'idUsuario', value: idUsuario }],
    );
    return rows[0] || null;
  }

  /** Versión segura para exponer al frontend: nunca incluye password_hash. */
  async findPublicById(idUsuario: number) {
    const rows = await this.db.executeQuery(
      `SELECT id_usuario, correo, nombre, id_rol, activo, fecha_creacion, ultimo_acceso
       FROM dbo.Usuarios
       WHERE id_usuario = @idUsuario`,
      [{ name: 'idUsuario', value: idUsuario }],
    );

    if (!rows[0]) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return rows[0];
  }

  async findAll(idRol?: number) {
    const query = idRol
      ? `SELECT id_usuario, correo, nombre, id_rol, activo, fecha_creacion, ultimo_acceso
         FROM dbo.Usuarios WHERE id_rol = @idRol ORDER BY nombre`
      : `SELECT id_usuario, correo, nombre, id_rol, activo, fecha_creacion, ultimo_acceso
         FROM dbo.Usuarios ORDER BY nombre`;

    return this.db.executeQuery(query, idRol ? [{ name: 'idRol', value: idRol }] : undefined);
  }

  async register(dto: RegisterDto) {
    return this.create({
      correo: dto.correo,
      contrasena: dto.contrasena,
      nombre: dto.nombre,
      idRol: ROL_PACIENTE,
      numControlOEmpleado: dto.numControlOEmpleado,
      tipoPersona: dto.tipoPersona,
    });
  }

  /**
   * Crea el usuario y, según el rol, su fila complementaria en
   * Pacientes o Psicologos, dentro de una sola transacción.
   */
  async create(dto: CreateUserDto) {
    const existente = await this.findByEmail(dto.correo);
    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }

    if (dto.idRol === ROL_PACIENTE && !dto.numControlOEmpleado) {
      throw new BadRequestException('numControlOEmpleado es requerido para pacientes');
    }
    if (dto.idRol === ROL_PSICOLOGO && !dto.cedulaProfesional) {
      throw new BadRequestException('cedulaProfesional es requerida para psicólogos');
    }

    const passwordHash = await bcrypt.hash(dto.contrasena, 10);
    const pool = this.db.getPool();
    const transaction = pool.transaction();

    await transaction.begin();
    try {
      const insertUsuario = await transaction
        .request()
        .input('correo', dto.correo)
        .input('passwordHash', passwordHash)
        .input('nombre', dto.nombre)
        .input('idRol', dto.idRol)
        .query(`
          INSERT INTO dbo.Usuarios (correo, password_hash, nombre, id_rol)
          OUTPUT INSERTED.id_usuario
          VALUES (@correo, @passwordHash, @nombre, @idRol)
        `);

      const idUsuario: number = insertUsuario.recordset[0].id_usuario;

      if (dto.idRol === ROL_PACIENTE) {
        await transaction
          .request()
          .input('idPaciente', idUsuario)
          .input('numControl', dto.numControlOEmpleado)
          .input('tipoPersona', dto.tipoPersona || 'A')
          .query(`
            INSERT INTO dbo.Pacientes (id_paciente, num_control_o_num_empleado, tipo_persona)
            VALUES (@idPaciente, @numControl, @tipoPersona)
          `);

        /*
        const psicologoDisponible = await transaction
          .request()
          .query(`
            SELECT TOP (1)
                ps.id_psicologo
            FROM dbo.Psicologos ps
            INNER JOIN dbo.Usuarios u
                ON u.id_usuario = ps.id_psicologo
            LEFT JOIN dbo.PacientePsicologo pp
                ON pp.id_psicologo = ps.id_psicologo
              AND pp.es_principal = 1
              AND pp.fecha_fin IS NULL
            WHERE ps.activo_para_citas = 1
              AND u.activo = 1
            GROUP BY ps.id_psicologo
            ORDER BY COUNT(pp.id_asignacion) ASC,
                    ps.id_psicologo ASC
          `);

        const idPsicologo =
          psicologoDisponible.recordset[0]?.id_psicologo;

        if (idPsicologo) {
          await transaction
            .request()
            .input('idPaciente', idUsuario)
            .input('idPsicologo', idPsicologo)
            .query(`
              INSERT INTO dbo.PacientePsicologo (
                id_paciente,
                id_psicologo,
                es_principal
              )
              VALUES (
                @idPaciente,
                @idPsicologo,
                1
              )
            `);
        }
        */
      } else if (dto.idRol === ROL_PSICOLOGO) {
        await transaction
          .request()
          .input('idPsicologo', idUsuario)
          .input('cedula', dto.cedulaProfesional)
          .input('especialidad', dto.especialidad ?? null)
          .query(`
            INSERT INTO dbo.Psicologos (id_psicologo, cedula_profesional, especialidad)
            VALUES (@idPsicologo, @cedula, @especialidad)
          `);
      }

      await transaction.commit();
      return this.findPublicById(idUsuario);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async update(idUsuario: number, dto: UpdateUserDto) {
    await this.findPublicById(idUsuario); // lanza NotFoundException si no existe

    if (dto.correo) {
      const existente = await this.findByEmail(dto.correo);
      if (existente && existente.id_usuario !== idUsuario) {
        throw new ConflictException('Ese correo ya está en uso por otro usuario');
      }
    }

    await this.db.executeQuery(
      `UPDATE dbo.Usuarios
       SET correo = COALESCE(@correo, correo),
           nombre = COALESCE(@nombre, nombre)
       WHERE id_usuario = @idUsuario`,
      [
        { name: 'correo', value: dto.correo ?? null },
        { name: 'nombre', value: dto.nombre ?? null },
        { name: 'idUsuario', value: idUsuario },
      ],
    );

    return this.findPublicById(idUsuario);
  }

  async changePassword(idUsuario: number, dto: ChangePasswordDto) {
    const user = await this.findById(idUsuario);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const coincide = await bcrypt.compare(dto.contrasenaActual, user.password_hash);
    if (!coincide) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }

    const nuevoHash = await bcrypt.hash(dto.contrasenaNueva, 10);
    await this.db.executeQuery(
      `UPDATE dbo.Usuarios SET password_hash = @hash WHERE id_usuario = @idUsuario`,
      [
        { name: 'hash', value: nuevoHash },
        { name: 'idUsuario', value: idUsuario },
      ],
    );
  }

  async setActive(idUsuario: number, activo: boolean) {
    await this.findPublicById(idUsuario);

    await this.db.executeQuery(
      `UPDATE dbo.Usuarios SET activo = @activo WHERE id_usuario = @idUsuario`,
      [
        { name: 'activo', value: activo },
        { name: 'idUsuario', value: idUsuario },
      ],
    );

    return this.findPublicById(idUsuario);
  }

  async updateUltimoAcceso(idUsuario: number) {
    await this.db.executeQuery(
      `UPDATE dbo.Usuarios SET ultimo_acceso = SYSUTCDATETIME() WHERE id_usuario = @idUsuario`,
      [{ name: 'idUsuario', value: idUsuario }],
    );
  }
}