import { Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service.js';
import * as bcrypt from 'bcrypt';
import { AuthResponse } from './interfaces/auth-response.interface.js';
import { TokenPayload } from './interfaces/token-payload.interface.js';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtExpiration: JwtSignOptions['expiresIn'];
  private readonly jwtRefreshExpiration: JwtSignOptions['expiresIn'];

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    const jwtRefreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');

    if (!jwtSecret || !jwtRefreshSecret) {
      throw new Error(
        'JWT_SECRET y JWT_REFRESH_SECRET deben estar definidos en las variables de entorno',
      );
    }

    this.jwtSecret = jwtSecret;
    this.jwtRefreshSecret = jwtRefreshSecret;
    this.jwtExpiration = (this.configService.get<string>('JWT_EXPIRATION') ||
      '2h') as JwtSignOptions['expiresIn'];
    this.jwtRefreshExpiration = (this.configService.get<string>('JWT_REFRESH_EXPIRATION') ||
      '5h') as JwtSignOptions['expiresIn'];
  }

  async validateUser(correo: string, contrasena: string): Promise<any> {
    const user = await this.usersService.findByEmail(correo);

    if (!user || !user.activo) {
      return null;
    }

    if (await bcrypt.compare(contrasena, user.password_hash)) {
      const { password_hash, ...result } = user;
      return result;
    }

    return null;
  }

  async login(correo: string, contrasena: string): Promise<AuthResponse> {
    const user = await this.validateUser(correo, contrasena);

    if (!user) {
      return {
        success: false,
        statusCode: 401,
        message: 'Credenciales inválidas',
        error: 'INVALID_CREDENTIALS',
        data: null,
      };
    }

    const tokens = await this.generateTokens(user);

    return {
      success: true,
      statusCode: 200,
      data: {
        ...tokens,
        user: {
          idUsuario: user.id_usuario,
          correo: user.correo,
          rol: user.id_rol,
        },
      },
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    try {
      // Verificar el refresh token
      const payload = await this.verifyRefreshToken(refreshToken);

      // Buscar el usuario por id_usuario (payload.sub)
      const user = await this.usersService.findById(payload.sub);

      if (!user || !user.activo) {
        return {
          success: false,
          statusCode: 401,
          message: 'Usuario no encontrado o inactivo',
          error: 'USER_NOT_FOUND',
          requiresLogin: true,
          data: null,
        };
      }

      // Generar nuevos tokens
      const tokens = await this.generateTokens(user);

      return {
        success: true,
        statusCode: 200,
        data: {
          ...tokens,
          user: {
            idUsuario: user.id_usuario,
            correo: user.correo,
            rol: user.id_rol,
          },
        },
      };
    } catch (error) {
      // Si el refresh token está expirado o es inválido
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        return {
          success: false,
          statusCode: 401,
          message: 'El token de actualización ha expirado. Por favor inicie sesión nuevamente',
          error: 'REFRESH_TOKEN_EXPIRED',
          requiresLogin: true,
          data: null,
        };
      }

      return {
        success: false,
        statusCode: 401,
        message: 'Token de actualización inválido',
        error: 'INVALID_REFRESH_TOKEN',
        requiresLogin: true,
        data: null,
      };
    }
  }

  private async generateTokens(user: any) {
    const payload: TokenPayload = {
      correo: user.correo,
      sub: user.id_usuario,
      rol: user.id_rol,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: this.jwtExpiration,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.jwtRefreshSecret,
      expiresIn: this.jwtRefreshExpiration,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 7200, // 2 horas en segundos
      tokenType: 'Bearer',
    };
  }

  private verifyRefreshToken(token: string): any {
    return this.jwtService.verify(token, {
      secret: this.jwtRefreshSecret,
    });
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      this.jwtService.verify(token, {
        secret: this.jwtSecret,
      });
      return true;
    } catch {
      return false;
    }
  }

  // Método adicional para obtener información del token
  decodeToken(token: string): any {
    try {
      return this.jwtService.decode(token);
    } catch {
      return null;
    }
  }
}