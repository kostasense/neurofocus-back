import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRecordDto {
  @ApiProperty({
    description:
      'Identificador del paciente propietario del expediente',
    example: 10,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  idPaciente: number;

  @ApiPropertyOptional({
    description:
      'Identificador del psicólogo responsable. Para psicólogos autenticados se utiliza su propio identificador.',
    example: 5,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  idPsicologoResponsable?: number;

  @ApiPropertyOptional({
    description:
      'Descripción inicial y breve del motivo de consulta',
    example:
      'El paciente solicita acompañamiento por dificultades académicas.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  motivoConsulta?: string;
}