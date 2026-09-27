import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({
    description:
      'Indica si deben mostrarse únicamente las notificaciones no leídas',
    example: true,
    default: false,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return value;
  })
  @IsBoolean()
  soloNoLeidas?: boolean;

  @ApiPropertyOptional({
    description:
      'Tipo de notificación: 1 cita, 2 chat, 3 pánico o 4 sistema',
    enum: [1, 2, 3, 4],
    example: 1,
    type: Number,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @IsIn([1, 2, 3, 4])
  tipo?: number;

  @ApiPropertyOptional({
    description:
      'Prioridad de la notificación: 1 normal, 2 alta o 3 crítica',
    enum: [1, 2, 3],
    example: 2,
    type: Number,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @IsIn([1, 2, 3])
  prioridad?: number;

  @ApiPropertyOptional({
    description:
      'Cantidad máxima de notificaciones que se devolverán',
    example: 30,
    default: 30,
    minimum: 1,
    maximum: 100,
    type: Number,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number;

  @ApiPropertyOptional({
    description:
      'Cantidad de notificaciones que se omitirán antes de devolver resultados',
    example: 0,
    default: 0,
    minimum: 0,
    type: Number,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  desplazamiento?: number;
}