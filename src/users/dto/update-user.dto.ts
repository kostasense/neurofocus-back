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
}