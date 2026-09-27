import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAttachmentDto {
  @ApiProperty({
    description:
      'Nombre original del archivo. El backend lo cifra antes de almacenarlo.',
    example: 'valoracion-inicial.pdf',
    maxLength: 255,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  nombreArchivo: string;

  @ApiProperty({
    description: 'Tipo MIME del archivo',
    example: 'application/pdf',
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  tipoMime: string;

  @ApiProperty({
    description:
      'Tamaño del archivo expresado en bytes',
    example: 524288,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  tamanoBytes: number;

  @ApiProperty({
    description:
      'Clave interna del archivo dentro del almacenamiento externo',
    example:
      'expedientes/15/entradas/42/archivo-uuid.pdf.enc',
    maxLength: 500,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  ubicacionObjeto: string;

  @ApiProperty({
    description:
      'Hash SHA-256 del archivo expresado mediante 64 caracteres hexadecimales',
    example:
      'a3f5c4d2e9187b6a5f40312233445566778899aabbccddeeff00112233445566',
    minLength: 64,
    maxLength: 64,
  })
  @IsString()
  @Length(64, 64)
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message:
      'hashSha256 debe contener exactamente 64 caracteres hexadecimales',
  })
  hashSha256: string;
}