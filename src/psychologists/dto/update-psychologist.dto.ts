import {
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class UpdatePsychologistDto {
  @ApiPropertyOptional({
    description:
      'Cédula profesional del psicólogo',
    example: '12345678',
    minLength: 1,
    maxLength: 30,
  })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  cedulaProfesional?: string;

  @ApiPropertyOptional({
    description:
      'Especialidad o área de atención profesional',
    example: 'Psicología clínica',
    minLength: 1,
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  especialidad?: string;

  @ApiPropertyOptional({
    description:
      'Duración predeterminada de cada cita en minutos',
    example: 50,
    minimum: 10,
    maximum: 240,
  })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(240)
  duracionCitaMinutos?: number;

  @ApiPropertyOptional({
    description:
      'Indica si el psicólogo se encuentra disponible globalmente para usar el chat',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  chatDisponible?: boolean;

  @ApiPropertyOptional({
    description:
      'Indica si el psicólogo puede recibir nuevas citas',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  activoParaCitas?: boolean;
}