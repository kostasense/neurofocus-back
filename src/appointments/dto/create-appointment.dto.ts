import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAppointmentDto {
  @ApiPropertyOptional({
    description:
      'Paciente de la cita. Si quien agenda es el paciente, se utiliza su identificador del token.',
    example: 10,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  idPaciente?: number;

  @ApiProperty({
    description: 'Identificador del psicólogo',
    example: 5,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  idPsicologo: number;

  @ApiPropertyOptional({
    description:
      'Evaluación relacionada con la cita',
    example: 24,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  idEvaluacion?: number;

  @ApiProperty({
    description:
      'Fecha y hora de inicio en formato ISO 8601 UTC',
    example: '2026-10-01T18:00:00.000Z',
    format: 'date-time',
  })
  @IsDateString()
  inicio: string;

  @ApiProperty({
    description:
      'Fecha y hora de finalización en formato ISO 8601 UTC',
    example: '2026-10-01T18:50:00.000Z',
    format: 'date-time',
  })
  @IsDateString()
  fin: string;

  @ApiProperty({
    description: 'Modalidad de la cita',
    enum: [1, 2],
    example: 1,
    examples: {
      presencial: {
        value: 1,
        description: 'Presencial',
      },
      virtual: {
        value: 2,
        description: 'Virtual',
      },
    },
  })
  @IsInt()
  @IsIn([1, 2])
  modalidad: number;

  @ApiPropertyOptional({
    description:
      'Nota operativa relacionada con la cita. No debe contener información clínica.',
    example: 'Presentarse diez minutos antes.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notasAgenda?: string;
}