import {
  ApiProperty,
} from '@nestjs/swagger';
import {
  IsBase64,
  IsInt,
  Min,
} from 'class-validator';

export class CreatePanicAlertDto {
  @ApiProperty({
    description:
      'Contenido cifrado del mensaje de pánico codificado en Base64',
    example: 'U2FsdGVkX1...',
  })
  @IsBase64()
  mensajeCifrado: string;

  @ApiProperty({
    description:
      'Nonce único utilizado durante el cifrado, codificado en Base64',
    example: 'ZGF0YU5vbmNlMTI=',
  })
  @IsBase64()
  nonce: string;

  @ApiProperty({
    description:
      'Etiqueta de autenticación del mensaje codificada en Base64',
    example: 'YXV0aFRhZzEyMzQ1Ng==',
  })
  @IsBase64()
  etiquetaAutenticacion: string;

  @ApiProperty({
    description:
      'Versión de la clave de canal utilizada',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  versionClave: number;
}