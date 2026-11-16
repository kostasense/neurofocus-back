import { ApiProperty } from '@nestjs/swagger';
import { IsBase64 } from 'class-validator';

export class PublishIdentityDto {
  @ApiProperty({
    description:
      'Clave pública X25519 del usuario (32 bytes) codificada en Base64',
  })
  @IsBase64()
  clavePublica: string;

  @ApiProperty({
    description:
      'Clave privada cifrada en el cliente con una frase del usuario (respaldo), Base64. El servidor no puede abrirla',
  })
  @IsBase64()
  respaldoClavePrivada: string;
}