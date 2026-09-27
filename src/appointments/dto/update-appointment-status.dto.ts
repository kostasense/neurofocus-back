import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
} from 'class-validator';

export class UpdateAppointmentStatusDto {
  @ApiProperty({
    description:
      'Nuevo estado: 2 confirmada, 3 realizada o 5 no asistió',
    enum: [2, 3, 5],
    example: 2,
  })
  @IsInt()
  @IsIn([2, 3, 5])
  estado: number;
}