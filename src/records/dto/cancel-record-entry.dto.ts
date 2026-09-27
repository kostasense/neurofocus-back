import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CancelRecordEntryDto {
  @ApiProperty({
    description:
      'Justificación para anular la entrada sin eliminarla del historial',
    example:
      'La entrada fue registrada en el expediente equivocado.',
    minLength: 1,
    maxLength: 250,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(250)
  motivoAnulacion: string;
}