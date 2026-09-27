import {
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateEvaluationDto {
  @ApiPropertyOptional({
    description:
      'Identificador del paciente. Si el usuario autenticado es paciente, se utiliza automáticamente su identificador.',
    example: 10,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  idPaciente?: number;
}