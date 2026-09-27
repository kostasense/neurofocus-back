import {
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsMilitaryTime,
  IsOptional,
} from 'class-validator';

export class UpdateScheduleDto {
  @ApiPropertyOptional({
    description:
      'Día de la semana, entre 1 y 7',
    enum: [1, 2, 3, 4, 5, 6, 7],
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @IsIn([1, 2, 3, 4, 5, 6, 7])
  diaSemana?: number;

  @ApiPropertyOptional({
    description:
      'Nueva hora local de inicio en formato HH:mm',
    example: '09:00',
  })
  @IsOptional()
  @IsMilitaryTime()
  horaInicio?: string;

  @ApiPropertyOptional({
    description:
      'Nueva hora local de finalización en formato HH:mm',
    example: '15:00',
  })
  @IsOptional()
  @IsMilitaryTime()
  horaFin?: string;

  @ApiPropertyOptional({
    description:
      'Modalidad: 1 presencial o 2 virtual',
    enum: [1, 2],
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @IsIn([1, 2])
  modalidad?: number;

  @ApiPropertyOptional({
    description:
      'Indica si el bloque de horario está activo',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}