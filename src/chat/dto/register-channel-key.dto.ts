import {
  ApiProperty,
} from '@nestjs/swagger';
import {
  IsBase64,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export class RegisterChannelKeyDto {
  @ApiProperty({
    description:
      'Sobre de clave cifrado para el participante, codificado en Base64',
    example: 'Q2xhdmVDaWZyYWRh...',
  })
  @IsBase64()
  sobreClaveCifrado: string;

  @ApiProperty({
    description:
      'Versión de la clave registrada',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  versionClave: number;

  @ApiProperty({
    description:
      'Participante dueño del sobre. Si se omite es el usuario autenticado; permite entregar la clave al otro participante',
    required: false,
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  idUsuario?: number;
}