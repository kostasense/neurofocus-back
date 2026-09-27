import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
} from 'class-validator';

export class RescheduleAppointmentDto {
  @ApiProperty({
    description:
      'Nueva fecha y hora de inicio en formato ISO 8601 UTC',
    example: '2026-10-05T17:00:00.000Z',
    format: 'date-time',
  })
  @IsDateString()
  inicio: string;

  @ApiProperty({
    description:
      'Nueva fecha y hora de finalización en formato ISO 8601 UTC',
    example: '2026-10-05T17:50:00.000Z',
    format: 'date-time',
  })
  @IsDateString()
  fin: string;

  @ApiPropertyOptional({
    description:
      'Nueva modalidad: 1 presencial o 2 virtual',
    enum: [1, 2],
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @IsIn([1, 2])
  modalidad?: number;
}