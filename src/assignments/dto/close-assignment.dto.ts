import {
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CloseAssignmentDto {
  @ApiPropertyOptional({
    description:
      'Motivo por el que finaliza la asignación entre el paciente y el psicólogo',
    example:
      'El paciente fue reasignado a otro psicólogo.',
    maxLength: 250,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(250)
  motivoFin?: string;
}