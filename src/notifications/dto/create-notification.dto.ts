import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({
    description:
      'Identificador del usuario que recibirá la notificación',
    example: 10,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  idUsuario: number;

  @ApiProperty({
    description:
      'Tipo de notificación: 1 cita, 2 chat, 3 pánico o 4 sistema',
    enum: [1, 2, 3, 4],
    example: 4,
  })
  @IsInt()
  @IsIn([1, 2, 3, 4])
  tipo: number;

  @ApiProperty({
    description:
      'Título breve de la notificación',
    example: 'Actualización del sistema',
    minLength: 1,
    maxLength: 120,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  titulo: string;

  @ApiProperty({
    description:
      'Contenido de la notificación',
    example:
      'La plataforma estará en mantenimiento esta noche.',
    minLength: 1,
    maxLength: 500,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  cuerpo: string;

  @ApiPropertyOptional({
    description:
      'Identificador del recurso relacionado. Su significado depende del tipo de notificación.',
    example: 45,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  referenciaId?: number;

  @ApiPropertyOptional({
    description:
      'Prioridad: 1 normal, 2 alta o 3 crítica',
    enum: [1, 2, 3],
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @IsIn([1, 2, 3])
  prioridad?: number;
}