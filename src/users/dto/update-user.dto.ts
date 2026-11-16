import {
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description:
      'Nuevo correo electrónico del usuario',
    example: 'nuevo.correo@institucion.edu.mx',
    format: 'email',
  })
  @IsOptional()
  @IsEmail()
  correo?: string;

  @ApiPropertyOptional({
    description:
      'Nuevo nombre mostrado del usuario',
    example: 'María López García',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre?: string;

  @ApiPropertyOptional({
    description:
      'Contraseña actual. Es obligatoria cuando el propio usuario cambia su correo.',
    maxLength: 128,
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  contrasenaActual?: string;
}