import {
  ApiProperty,
} from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Correo registrado del usuario',
    example: 'usuario@institucion.edu.mx',
  })
  @IsEmail()
  correo: string;

  @ApiProperty({
    description: 'Contraseña de la cuenta',
    example: 'ContrasenaSegura123!',
    minLength: 8,
    format: 'password',
  })
  @IsString()
  @MinLength(8)
  contrasena: string;
}