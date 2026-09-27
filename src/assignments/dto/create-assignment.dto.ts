import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateAssignmentDto {
  @ApiProperty({
    description:
      'Identificador del paciente que será asignado',
    example: 10,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  idPaciente: number;

  @ApiProperty({
    description:
      'Identificador del psicólogo que atenderá al paciente',
    example: 5,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  idPsicologo: number;

  @ApiPropertyOptional({
    description:
      'Indica si el psicólogo será el responsable principal del paciente',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  esPrincipal?: boolean;
}