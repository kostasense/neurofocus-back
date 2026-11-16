import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** L + 8 dígitos (los dígitos 3 y 4 son 17, plantel Culiacán) en el dominio institucional. */
export const CORREO_INSTITUCIONAL = /^[lL]\d{2}17\d{4}@culiacan\.tecnm\.mx$/i;

export class RegisterDto {
  @ApiProperty({
    description:
      'Correo institucional del paciente con el formato L**17****@culiacan.tecnm.mx',
    example: 'L24170001@culiacan.tecnm.mx',
    format: 'email',
  })
  @IsEmail()
  @Matches(CORREO_INSTITUCIONAL, {
    message:
      'El correo debe ser institucional con el formato L**17****@culiacan.tecnm.mx',
  })
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