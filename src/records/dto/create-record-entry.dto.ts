import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRecordEntryDto {
  @ApiPropertyOptional({
    description:
      'Identificador de la cita relacionada con la entrada',
    example: 24,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  idCita?: number;

  @ApiPropertyOptional({
    description:
      'Identificador de la evaluación relacionada con la entrada',
    example: 18,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  idEvaluacion?: number;

  @ApiProperty({
    description:
      'Tipo de entrada: 1 nota de sesión, 2 valoración, 3 plan, 4 seguimiento, 5 referencia o 6 cierre',
    enum: [1, 2, 3, 4, 5, 6],
    example: 1,
  })
  @IsInt()
  @IsIn([1, 2, 3, 4, 5, 6])
  tipo: number;

  @ApiProperty({
    description:
      'Contenido clínico de la entrada. El backend lo cifra con AES-256-GCM antes de almacenarlo.',
    example:
      'Contenido de la nota profesional de la sesión.',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  contenido: string;
}