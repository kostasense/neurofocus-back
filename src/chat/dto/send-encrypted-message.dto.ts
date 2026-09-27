import {
  ApiProperty,
} from '@nestjs/swagger';
import {
  IsBase64,
  IsIn,
  IsInt,
  Min,
} from 'class-validator';

export class SendEncryptedMessageDto {
  @ApiProperty({
    description:
      'Contenido cifrado del mensaje codificado en Base64',
    example: 'TWVuc2FqZUNpZnJhZG8=',
  })
  @IsBase64()
  mensajeCifrado: string;

  @ApiProperty({
    description:
      'Nonce único utilizado por AES-GCM, codificado en Base64',
    example: 'Tm9uY2VEZURvY2VC',
  })
  @IsBase64()
  nonce: string;

  @ApiProperty({
    description:
      'Etiqueta de autenticación codificada en Base64',
    example: 'RXRpcXVldGFBdXRoMTY=',
  })
  @IsBase64()
  etiquetaAutenticacion: string;

  @ApiProperty({
    description:
      'Versión de la clave del canal utilizada para cifrar',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  versionClave: number;

  @ApiProperty({
    description:
      'Tipo de mensaje: 1 texto o 2 sistema. El tipo 3 se reserva para alertas de pánico',
    enum: [1, 2],
    example: 1,
  })
  @IsInt()
  @IsIn([1, 2])
  tipoMensaje: number;
}