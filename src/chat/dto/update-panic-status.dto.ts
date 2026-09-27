import {
  ApiProperty,
} from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
} from 'class-validator';

export class UpdatePanicStatusDto {
  @ApiProperty({
    description:
      'Estado de la alerta: 2 notificada, 3 vista, 4 atendida o 5 cerrada',
    enum: [2, 3, 4, 5],
    example: 3,
  })
  @IsInt()
  @IsIn([2, 3, 4, 5])
  estado: number;
}