import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  Min,
} from 'class-validator';

export class ChangeResponsibleDto {
  @ApiProperty({
    description:
      'Identificador del nuevo psicólogo responsable',
    example: 5,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  idPsicologoResponsable: number;
}