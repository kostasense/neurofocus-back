import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CancelAppointmentDto {
  @ApiProperty({
    description: 'Motivo de cancelación de la cita',
    example: 'No podré asistir en el horario programado.',
    maxLength: 250,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(250)
  motivoCancelacion: string;
}