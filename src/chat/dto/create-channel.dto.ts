import {
  ApiProperty,
} from '@nestjs/swagger';
import {
  IsInt,
  Min,
} from 'class-validator';

export class CreateChannelDto {
  @ApiProperty({
    description:
      'Identificador del paciente participante',
    example: 10,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  idPaciente: number;

  @ApiProperty({
    description:
      'Identificador del psicólogo participante',
    example: 5,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  idPsicologo: number;
}