import {
  ApiProperty,
} from '@nestjs/swagger';
import {
  IsJWT,
  IsString,
} from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description:
      'Refresh token obtenido durante el inicio de sesión',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsJWT()
  refreshToken: string;
}