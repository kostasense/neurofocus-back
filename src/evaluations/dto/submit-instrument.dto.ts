import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InstrumentAnswerDto {
  @ApiProperty({
    description:
      'Número del reactivo respondido',
    example: 1,
    minimum: 1,
    maximum: 20,
  })
  @IsInt()
  @Min(1)
  @Max(20)
  numeroReactivo: number;

  @ApiProperty({
    description:
      'Valor seleccionado para el reactivo. El rango exacto depende del instrumento.',
    example: 2,
    minimum: 0,
    maximum: 4,
  })
  @IsInt()
  @Min(0)
  @Max(4)
  valor: number;
}

export class SubmitInstrumentDto {
  @ApiProperty({
    description:
      'Lista completa de respuestas del instrumento',
    type: [InstrumentAnswerDto],
    example: [
      {
        numeroReactivo: 1,
        valor: 2,
      },
      {
        numeroReactivo: 2,
        valor: 1,
      },
      {
        numeroReactivo: 3,
        valor: 0,
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InstrumentAnswerDto)
  respuestas: InstrumentAnswerDto[];

  @ApiPropertyOptional({
    description:
      'Dificultad funcional adicional del PHQ-9: 0 ninguna, 1 algo difícil, 2 muy difícil o 3 extremadamente difícil',
    enum: [0, 1, 2, 3],
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1, 2, 3])
  dificultadFuncional?: number;
}