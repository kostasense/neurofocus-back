import {
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class UpdatePatientDto {
  @ApiPropertyOptional({
    description:
      'Número de control del alumno o número de empleado institucional',
    example: '23170001',
    minLength: 1,
    maxLength: 30,
  })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  numControlOEmpleado?: string;

  @ApiPropertyOptional({
    description:
      'Tipo de persona: A alumno, D docente o PA personal administrativo',
    enum: ['A', 'D', 'PA'],
    example: 'A',
  })
  @IsOptional()
  @IsIn(['A', 'D', 'PA'])
  tipoPersona?: 'A' | 'D' | 'PA';

  @ApiPropertyOptional({
    description:
      'Fecha de nacimiento en formato ISO 8601',
    example: '2004-06-15',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @ApiPropertyOptional({
    description:
      'Número de teléfono principal. El backend lo cifra antes de almacenarlo.',
    example: '6671234567',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, {
    message:
      'El teléfono debe contener entre 10 y 15 dígitos y puede iniciar con +',
  })
  telefono?: string;

  @ApiPropertyOptional({
    description:
      'Teléfono de una persona de confianza. El backend lo cifra antes de almacenarlo.',
    example: '6677654321',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, {
    message:
      'El teléfono de confianza debe contener entre 10 y 15 dígitos y puede iniciar con +',
  })
  telefonoConfianza?: string;

  @ApiPropertyOptional({
    description:
      'Medio de contacto preferido: 1 correo, 2 teléfono o 3 notificación dentro de la plataforma',
    enum: [1, 2, 3],
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @IsIn([1, 2, 3])
  contactoPreferido?: number;
}