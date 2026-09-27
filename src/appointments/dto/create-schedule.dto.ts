import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsMilitaryTime,
  IsOptional,
} from 'class-validator';

export class CreateScheduleDto {
  @ApiProperty({
    description:
      'Día de la semana: 1 lunes, 2 martes, 3 miércoles, 4 jueves, 5 viernes, 6 sábado y 7 domingo',
    enum: [1, 2, 3, 4, 5, 6, 7],
    example: 1,
  })
  @IsInt()
  @IsIn([1, 2, 3, 4, 5, 6, 7])
  diaSemana: number;

  @ApiProperty({
    description:
      'Hora local de inicio en formato HH:mm',
    example: '08:00',
  })
  @IsMilitaryTime()
  horaInicio: string;

  @ApiProperty({
    description:
      'Hora local de finalización en formato HH:mm',
    example: '14:00',
  })
  @IsMilitaryTime()
  horaFin: string;

  @ApiPropertyOptional({
    description:
      'Modalidad: 1 presencial o 2 virtual',
    enum: [1, 2],
    default: 1,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @IsIn([1, 2])
  modalidad?: number;
}