import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  MinLength,
} from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description:
      'Contraseña actual del usuario',
    example: 'ContrasenaActual123!',
    format: 'password',
  })
  @IsString()
  contrasenaActual: string;

  @ApiProperty({
    description:
      'Nueva contraseña del usuario',
    example: 'NuevaContrasena456!',
    minLength: 8,
    format: 'password',
  })
  @IsString()
  @MinLength(8)
  contrasenaNueva: string;
}