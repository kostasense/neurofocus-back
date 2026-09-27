import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CryptoService } from './crypto.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

const ROL_ADMINISTRADOR = 3;

@ApiTags('Cifrado')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROL_ADMINISTRADOR)
@Controller('crypto')
export class CryptoController {
  constructor(
    private readonly cryptoService: CryptoService,
  ) {}

  @ApiOperation({
    summary:
      'Consultar el estado del servicio de cifrado',
  })
  @Get('status')
  getStatus() {
    return {
      configured:
        this.cryptoService.isConfigured(),
      keyVersion:
        this.cryptoService.getCurrentKeyVersion(),
      algorithm: 'AES-256-GCM',
    };
  }
}