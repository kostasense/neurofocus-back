import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
} from 'class-validator';

export class CloseRecordDto {
  @ApiProperty({
    description:
      'Estado final del expediente: 2 cerrado o 3 archivado',
    enum: [2, 3],
    example: 2,
  })
  @IsInt()
  @IsIn([2, 3])
  estado: number;
}