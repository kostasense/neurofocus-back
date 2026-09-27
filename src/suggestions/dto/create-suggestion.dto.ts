import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateSuggestionDto {
  @ApiProperty({
    description:
      'Indica si la sugerencia se registrará sin asociarla al usuario autenticado',
    example: false,
  })
  @IsBoolean()
  anonima: boolean;

  @ApiPropertyOptional({
    description:
      'Identificador del psicólogo relacionado con la sugerencia',
    example: 5,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  idPsicologoReferido?: number;

  @ApiPropertyOptional({
    description:
      'Identificador de la cita relacionada con la sugerencia',
    example: 24,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  idCita?: number;

  @ApiProperty({
    description:
      'Categoría: 1 sistema, 2 atención psicológica, 3 citas, 4 privacidad o 5 otro',
    enum: [1, 2, 3, 4, 5],
    example: 2,
  })
  @IsInt()
  @IsIn([1, 2, 3, 4, 5])
  categoria: number;

  @ApiPropertyOptional({
    description:
      'Calificación opcional entre 1 y 5',
    enum: [1, 2, 3, 4, 5],
    example: 4,
  })
  @IsOptional()
  @IsInt()
  @IsIn([1, 2, 3, 4, 5])
  calificacion?: number;

  @ApiProperty({
    description:
      'Comentario o contenido de la sugerencia',
    example:
      'La atención fue adecuada, pero sería útil disponer de más horarios.',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  comentario: string;
}