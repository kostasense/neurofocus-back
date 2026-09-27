import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description:
      'Correo electrónico del usuario',
    example: 'usuario@institucion.edu.mx',
    format: 'email',
  })
  @IsEmail()
  correo: string;

  @ApiProperty({
    description:
      'Contraseña inicial de la cuenta',
    example: 'ContrasenaSegura123!',
    minLength: 8,
    format: 'password',
  })
  @IsString()
  @MinLength(8)
  contrasena: string;

  @ApiProperty({
    description:
      'Nombre completo o nombre mostrado del usuario',
    example: 'María López García',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @ApiProperty({
    description:
      'Rol del usuario: 1 paciente, 2 psicólogo o 3 administrador',
    enum: [1, 2, 3],
    example: 1,
  })
  @IsIn([1, 2, 3])
  idRol: number;

  @ApiPropertyOptional({
    description:
      'Número de control o empleado. Es obligatorio cuando idRol es 1.',
    example: '23170001',
    maxLength: 30,
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  numControlOEmpleado?: string;

  @ApiPropertyOptional({
    description:
      'Tipo de paciente: A alumno, D docente o PA personal administrativo. Aplica cuando idRol es 1.',
    enum: ['A', 'D', 'PA'],
    example: 'A',
  })
  @IsOptional()
  @IsIn(['A', 'D', 'PA'])
  tipoPersona?: 'A' | 'D' | 'PA';

  @ApiPropertyOptional({
    description:
      'Cédula profesional. Es obligatoria cuando idRol es 2.',
    example: '12345678',
    maxLength: 30,
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  cedulaProfesional?: string;

  @ApiPropertyOptional({
    description:
      'Especialidad del psicólogo. Aplica cuando idRol es 2.',
    example: 'Psicología clínica',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  especialidad?: string;
}