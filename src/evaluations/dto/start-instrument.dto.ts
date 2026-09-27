import {
  ApiProperty,
} from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
} from 'class-validator';

export class StartInstrumentDto {
  @ApiProperty({
    description:
      'Instrumento que se iniciará: 1 PSS-14, 2 GAD-7 o 3 PHQ-9',
    enum: [1, 2, 3],
    example: 1,
  })
  @IsInt()
  @IsIn([1, 2, 3])
  idInstrumento: number;
}