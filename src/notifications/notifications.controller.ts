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

import { NotificationsService } from './notifications.service.js';
import { CreateNotificationDto } from './dto/create-notification.dto.js';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto.js';
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

@ApiTags('Notificaciones')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService:
      NotificationsService,
  ) {}

  @ApiOperation({
    summary:
      'Crear manualmente una notificación para un usuario',
  })
  @Roles(ROL_ADMINISTRADOR)
  @Post()
  create(
    @Body() dto: CreateNotificationDto,
    @Request() req: RequestWithUser,
  ) {
    return this.notificationsService.create(
      dto,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Consultar las notificaciones del usuario autenticado',
  })
  @Get('mine')
  findMine(
    @Query() query: ListNotificationsQueryDto,
    @Request() req: RequestWithUser,
  ) {
    return this.notificationsService.findMine(
      req.user,
      query,
    );
  }

  @ApiOperation({
    summary:
      'Contar las notificaciones no leídas del usuario autenticado',
  })
  @Get('mine/unread-count')
  countUnread(
    @Request() req: RequestWithUser,
  ) {
    return this.notificationsService.countUnread(
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Marcar todas las notificaciones propias como leídas',
  })
  @Patch('mine/read-all')
  markAllAsRead(
    @Request() req: RequestWithUser,
  ) {
    return this.notificationsService.markAllAsRead(
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Consultar una notificación por su identificador',
  })
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe)
    id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.notificationsService.findById(
      id,
      req.user,
    );
  }

  @ApiOperation({
    summary: 'Marcar una notificación como leída',
  })
  @Patch(':id/read')
  markAsRead(
    @Param('id', ParseIntPipe)
    id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.notificationsService.markAsRead(
      id,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Marcar una notificación como no leída',
  })
  @Patch(':id/unread')
  markAsUnread(
    @Param('id', ParseIntPipe)
    id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.notificationsService.markAsUnread(
      id,
      req.user,
    );
  }
}