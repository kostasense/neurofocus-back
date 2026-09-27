import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description:
      'Correo electrónico del paciente',
    example: 'paciente@institucion.edu.mx',
    format: 'email',
  })
  @IsEmail()
  correo: string;

  @ApiProperty({
    description:
      'Contraseña de la nueva cuenta',
    example: 'ContrasenaSegura123!',
    minLength: 8,
    format: 'password',
  })
  @IsString()
  @MinLength(8)
  contrasena: string;

  @ApiProperty({
    description:
      'Nombre completo o nombre mostrado del paciente',
    example: 'Ángel Vizcaíno Rodríguez',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @ApiProperty({
    description:
      'Número de control o número institucional de empleado',
    example: '23170001',
    maxLength: 30,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  numControlOEmpleado: string;

  @ApiProperty({
    description:
      'Tipo de persona: A alumno, D docente o PA personal administrativo',
    enum: ['A', 'D', 'PA'],
    example: 'A',
  })
  @IsIn(['A', 'D', 'PA'])
  tipoPersona: 'A' | 'D' | 'PA';
}