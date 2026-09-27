import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenPayload } from '../interfaces/token-payload.interface.js';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private configService: ConfigService) {
    const jwtRefreshSecret = configService.get<string>('JWT_REFRESH_SECRET');
    
    if (!jwtRefreshSecret) {
      throw new Error('JWT_REFRESH_SECRET debe estar definido en las variables de entorno');
    }
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtRefreshSecret,
    });
  }

  async validate(payload: TokenPayload) {
    return { 
      userId: payload.sub, 
      correo: payload.correo,
      rol: payload.rol,
    };
  }
}