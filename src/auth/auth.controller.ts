import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type {
  Request as ExpressRequest,
  Response,
} from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { Public } from './decorators/public.decorator.js';

interface RequestWithUser extends ExpressRequest {
  user: {
    userId: number;
    correo: string;
    rol: number;
  };
}

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Res() res: Response,
  ) {
    const result = await this.authService.login(
      loginDto.correo,
      loginDto.contrasena,
    );

    if (!result.success) {
      return res
        .status(result.statusCode)
        .json(result);
    }

    return res
      .status(HttpStatus.OK)
      .json(result);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renovar los tokens de autenticación',
  })
  async refreshTokens(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Res() res: Response,
  ) {
    const result =
      await this.authService.refreshTokens(
        refreshTokenDto.refreshToken,
      );

    if (!result.success) {
      return res
        .status(result.statusCode)
        .json(result);
    }

    return res
      .status(HttpStatus.OK)
      .json(result);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Consultar el perfil del usuario autenticado',
  })
  async getProfile(
    @Request() req: RequestWithUser,
  ) {
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: {
        id: req.user.userId,
        correo: req.user.correo,
        rol: req.user.rol,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Validar el token de acceso actual',
  })
  async validateToken() {
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Token válido',
    };
  }
}