import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { SuggestionsService } from './suggestions.service.js';
import { CreateSuggestionDto } from './dto/create-suggestion.dto.js';
import { UpdateSuggestionDto } from './dto/update-suggestion.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

const ROL_ADMINISTRADOR = 3;

interface RequestWithUser extends ExpressRequest {
  user: {
    userId: number;
    correo: string;
    rol: number;
  };
}

@ApiTags('Sugerencias')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('suggestions')
export class SuggestionsController {
  constructor(
    private readonly suggestionsService:
      SuggestionsService,
  ) {}

  @ApiOperation({
    summary:
      'Registrar una sugerencia identificada o anónima',
  })
  @Post()
  create(
    @Body() dto: CreateSuggestionDto,
    @Request() req: RequestWithUser,
  ) {
    return this.suggestionsService.create(
      dto,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Consultar las sugerencias identificadas del usuario autenticado',
  })
  @Get('mine')
  findOwn(
    @Request() req: RequestWithUser,
  ) {
    return this.suggestionsService.findOwn(
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Consultar y filtrar el buzón administrativo de sugerencias',
  })
  @Roles(ROL_ADMINISTRADOR)
  @Get()
  findAll(
    @Query('estado')
    estado?: string,

    @Query('categoria')
    categoria?: string,

    @Query('idPsicologo')
    idPsicologo?: string,
  ) {
    return this.suggestionsService.findAll(
      estado
        ? Number(estado)
        : undefined,
      categoria
        ? Number(categoria)
        : undefined,
      idPsicologo
        ? Number(idPsicologo)
        : undefined,
    );
  }

  @ApiOperation({
    summary:
      'Consultar una sugerencia por su identificador',
  })
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe)
    id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.suggestionsService.findById(
      id,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Actualizar el estado o respuesta interna de una sugerencia',
  })
  @Roles(ROL_ADMINISTRADOR)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe)
    id: number,
    @Body() dto: UpdateSuggestionDto,
    @Request() req: RequestWithUser,
  ) {
    return this.suggestionsService.update(
      id,
      dto,
      req.user,
    );
  }
}