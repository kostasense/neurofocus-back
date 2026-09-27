import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { UpdatePatientDto } from './dto/update-patient.dto.js';

@Injectable()
export class PatientsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly cryptoService: CryptoService,
  ) {}

  async exists(idPaciente: number): Promise<boolean> {
    const rows = await this.db.executeQuery(
      `SELECT 1 AS existe
       FROM dbo.Pacientes
       WHERE id_paciente = @idPaciente`,
      [{ name: 'idPaciente', value: idPaciente }],
    );

    return Boolean(rows[0]);
  }

  async findById(idPaciente: number) {
    const rows = await this.db.executeQuery(
      `SELECT
          p.id_paciente,
          u.correo,
          u.nombre,
          u.activo,
          p.num_control_o_num_empleado,
          p.tipo_persona,
          p.fecha_nacimiento,
          p.telefono_cifrado,
          p.telefono_confianza_cifrado,
          p.contacto_preferido
       FROM dbo.Pacientes p
       INNER JOIN dbo.Usuarios u
         ON u.id_usuario = p.id_paciente
       WHERE p.id_paciente = @idPaciente`,
      [{ name: 'idPaciente', value: idPaciente }],
    );

    const paciente = rows[0];

    if (!paciente) {
      throw new NotFoundException('Paciente no encontrado');
    }

    return {
      idPaciente: paciente.id_paciente,
      correo: paciente.correo,
      nombre: paciente.nombre,
      activo: paciente.activo,
      numControlOEmpleado: paciente.num_control_o_num_empleado,
      tipoPersona: paciente.tipo_persona,
      fechaNacimiento: paciente.fecha_nacimiento,
      telefono: paciente.telefono_cifrado
        ? this.cryptoService.decrypt(paciente.telefono_cifrado)
        : null,
      telefonoConfianza: paciente.telefono_confianza_cifrado
        ? this.cryptoService.decrypt(
            paciente.telefono_confianza_cifrado,
          )
        : null,
      contactoPreferido: paciente.contacto_preferido,
    };
  }

  async findAll() {
    return this.db.executeQuery(
      `SELECT
          p.id_paciente,
          u.nombre,
          u.correo,
          u.activo,
          p.num_control_o_num_empleado,
          p.tipo_persona,
          p.fecha_nacimiento,
          p.contacto_preferido
       FROM dbo.Pacientes p
       INNER JOIN dbo.Usuarios u
         ON u.id_usuario = p.id_paciente
       ORDER BY u.nombre`,
    );
  }

  async update(idPaciente: number, dto: UpdatePatientDto) {
    await this.findById(idPaciente);

    if (dto.numControlOEmpleado) {
      const duplicados = await this.db.executeQuery(
        `SELECT id_paciente
         FROM dbo.Pacientes
         WHERE num_control_o_num_empleado = @identificador
           AND id_paciente <> @idPaciente`,
        [
          {
            name: 'identificador',
            value: dto.numControlOEmpleado,
          },
          {
            name: 'idPaciente',
            value: idPaciente,
          },
        ],
      );

      if (duplicados[0]) {
        throw new ConflictException(
          'El número de control o empleado ya está registrado',
        );
      }
    }

    const telefonoCifrado =
      dto.telefono !== undefined
        ? dto.telefono
          ? this.cryptoService.encrypt(dto.telefono)
          : null
        : undefined;

    const telefonoConfianzaCifrado =
      dto.telefonoConfianza !== undefined
        ? dto.telefonoConfianza
          ? this.cryptoService.encrypt(dto.telefonoConfianza)
          : null
        : undefined;

    await this.db.executeQuery(
      `UPDATE dbo.Pacientes
       SET
         num_control_o_num_empleado =
           COALESCE(
             @numControlOEmpleado,
             num_control_o_num_empleado
           ),

         tipo_persona =
           COALESCE(
             @tipoPersona,
             tipo_persona
           ),

         fecha_nacimiento =
           CASE
             WHEN @actualizarFecha = 1
               THEN @fechaNacimiento
             ELSE fecha_nacimiento
           END,

         telefono_cifrado =
           CASE
             WHEN @actualizarTelefono = 1
               THEN @telefonoCifrado
             ELSE telefono_cifrado
           END,

         telefono_confianza_cifrado =
           CASE
             WHEN @actualizarTelefonoConfianza = 1
               THEN @telefonoConfianzaCifrado
             ELSE telefono_confianza_cifrado
           END,

         contacto_preferido =
           CASE
             WHEN @actualizarContacto = 1
               THEN @contactoPreferido
             ELSE contacto_preferido
           END

       WHERE id_paciente = @idPaciente`,
      [
        {
          name: 'numControlOEmpleado',
          value: dto.numControlOEmpleado ?? null,
        },
        {
          name: 'tipoPersona',
          value: dto.tipoPersona ?? null,
        },
        {
          name: 'actualizarFecha',
          value: dto.fechaNacimiento !== undefined,
        },
        {
          name: 'fechaNacimiento',
          value: dto.fechaNacimiento ?? null,
        },
        {
          name: 'actualizarTelefono',
          value: dto.telefono !== undefined,
        },
        {
          name: 'telefonoCifrado',
          value: telefonoCifrado ?? null,
        },
        {
          name: 'actualizarTelefonoConfianza',
          value: dto.telefonoConfianza !== undefined,
        },
        {
          name: 'telefonoConfianzaCifrado',
          value: telefonoConfianzaCifrado ?? null,
        },
        {
          name: 'actualizarContacto',
          value: dto.contactoPreferido !== undefined,
        },
        {
          name: 'contactoPreferido',
          value: dto.contactoPreferido ?? null,
        },
        {
          name: 'idPaciente',
          value: idPaciente,
        },
      ],
    );

    return this.findById(idPaciente);
  }
}