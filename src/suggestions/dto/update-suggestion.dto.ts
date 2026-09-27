import {
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateSuggestionDto {
  @ApiPropertyOptional({
    description:
      'Estado de la sugerencia: 1 nueva, 2 en revisión, 3 atendida o 4 cerrada',
    enum: [1, 2, 3, 4],
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @IsIn([1, 2, 3, 4])
  estado?: number;

  @ApiPropertyOptional({
    description:
      'Respuesta o nota administrativa interna sobre la sugerencia',
    example:
      'La sugerencia fue revisada y se enviará al área correspondiente.',
    minLength: 1,
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  respuestaInterna?: string;
}