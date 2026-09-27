import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseBoolPipe,
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

import { ChatService } from './chat.service.js';
import { CreateChannelDto } from './dto/create-channel.dto.js';
import { RegisterChannelKeyDto } from './dto/register-channel-key.dto.js';
import { SendEncryptedMessageDto } from './dto/send-encrypted-message.dto.js';
import { CreatePanicAlertDto } from './dto/create-panic-alert.dto.js';
import { UpdatePanicStatusDto } from './dto/update-panic-status.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

const ROL_PACIENTE = 1;
const ROL_PSICOLOGO = 2;
const ROL_ADMINISTRADOR = 3;

interface RequestWithUser extends ExpressRequest {
  user: {
    userId: number;
    correo: string;
    rol: number;
  };
}

@ApiTags('Chat')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
  ) {}

  @ApiOperation({
    summary:
      'Crear u obtener un canal entre paciente y psicólogo',
  })
  @Post('channels')
  createChannel(
    @Body() dto: CreateChannelDto,
    @Request() req: RequestWithUser,
  ) {
    return this.chatService.createChannel(
      dto,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Listar los canales del usuario autenticado',
  })
  @Get('channels')
  findMyChannels(
    @Request() req: RequestWithUser,
  ) {
    return this.chatService.findMyChannels(
      req.user,
    );
  }

  @ApiOperation({
    summary: 'Consultar un canal por su identificador',
  })
  @Get('channels/:channelId')
  findChannel(
    @Param('channelId', ParseIntPipe)
    channelId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.chatService.findChannelById(
      channelId,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Habilitar o deshabilitar el chat del canal',
  })
  @Roles(ROL_PSICOLOGO)
  @Patch('channels/:channelId/enabled/:enabled')
  setEnabled(
    @Param('channelId', ParseIntPipe)
    channelId: number,
    @Param('enabled', ParseBoolPipe)
    enabled: boolean,
    @Request() req: RequestWithUser,
  ) {
    return this.chatService.setEnabled(
      channelId,
      enabled,
      req.user,
    );
  }

  @ApiOperation({
    summary: 'Cerrar un canal de chat',
  })
  @Roles(
    ROL_PSICOLOGO,
    ROL_ADMINISTRADOR,
  )
  @Patch('channels/:channelId/close')
  closeChannel(
    @Param('channelId', ParseIntPipe)
    channelId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.chatService.closeChannel(
      channelId,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Registrar un sobre de clave cifrado para el participante',
  })
  @Roles(
    ROL_PACIENTE,
    ROL_PSICOLOGO,
  )
  @Post('channels/:channelId/keys')
  registerKey(
    @Param('channelId', ParseIntPipe)
    channelId: number,
    @Body() dto: RegisterChannelKeyDto,
    @Request() req: RequestWithUser,
  ) {
    return this.chatService.registerKeyEnvelope(
      channelId,
      dto,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Recuperar el sobre de clave del usuario autenticado',
  })
  @Roles(
    ROL_PACIENTE,
    ROL_PSICOLOGO,
  )
  @Get('channels/:channelId/keys/:version')
  getMyKey(
    @Param('channelId', ParseIntPipe)
    channelId: number,
    @Param('version', ParseIntPipe)
    version: number,
    @Request() req: RequestWithUser,
  ) {
    return this.chatService.getMyKeyEnvelope(
      channelId,
      version,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Guardar un mensaje cifrado en el canal',
  })
  @Roles(
    ROL_PACIENTE,
    ROL_PSICOLOGO,
  )
  @Post('channels/:channelId/messages')
  sendMessage(
    @Param('channelId', ParseIntPipe)
    channelId: number,
    @Body() dto: SendEncryptedMessageDto,
    @Request() req: RequestWithUser,
  ) {
    return this.chatService.sendMessage(
      channelId,
      dto,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Consultar los mensajes cifrados de un canal',
  })
  @Roles(
    ROL_PACIENTE,
    ROL_PSICOLOGO,
  )
  @Get('channels/:channelId/messages')
  findMessages(
    @Param('channelId', ParseIntPipe)
    channelId: number,
    @Query('beforeId')
    beforeId: string | undefined,
    @Query(
      'limit',
      new DefaultValuePipe(50),
      ParseIntPipe,
    )
    limit: number,
    @Request() req: RequestWithUser,
  ) {
    return this.chatService.findMessages(
      channelId,
      req.user,
      beforeId
        ? Number(beforeId)
        : undefined,
      limit,
    );
  }

  @ApiOperation({
    summary: 'Marcar un mensaje como entregado',
  })
  @Roles(
    ROL_PACIENTE,
    ROL_PSICOLOGO,
  )
  @Patch('messages/:messageId/delivered')
  markDelivered(
    @Param('messageId', ParseIntPipe)
    messageId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.chatService.markDelivered(
      messageId,
      req.user,
    );
  }

  @ApiOperation({
    summary: 'Marcar un mensaje como leído',
  })
  @Roles(
    ROL_PACIENTE,
    ROL_PSICOLOGO,
  )
  @Patch('messages/:messageId/read')
  markRead(
    @Param('messageId', ParseIntPipe)
    messageId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.chatService.markRead(
      messageId,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Ocultar un mensaje para el usuario autenticado',
  })
  @Roles(
    ROL_PACIENTE,
    ROL_PSICOLOGO,
  )
  @Patch('messages/:messageId/hide')
  hideMessage(
    @Param('messageId', ParseIntPipe)
    messageId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.chatService.hideMessage(
      messageId,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Activar una alerta de pánico y registrar un mensaje cifrado',
  })
  @Roles(ROL_PACIENTE)
  @Post('channels/:channelId/panic')
  createPanicAlert(
    @Param('channelId', ParseIntPipe)
    channelId: number,
    @Body() dto: CreatePanicAlertDto,
    @Request() req: RequestWithUser,
  ) {
    return this.chatService.createPanicAlert(
      channelId,
      dto,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Consultar alertas de pánico',
  })
  @Roles(
    ROL_PSICOLOGO,
    ROL_ADMINISTRADOR,
  )
  @Get('panic-alerts')
  findPanicAlerts(
    @Query('estado')
    estado: string | undefined,
    @Request() req: RequestWithUser,
  ) {
    return this.chatService.findPanicAlerts(
      req.user,
      estado
        ? Number(estado)
        : undefined,
    );
  }

  @ApiOperation({
    summary:
      'Actualizar el estado de una alerta de pánico',
  })
  @Roles(
    ROL_PSICOLOGO,
    ROL_ADMINISTRADOR,
  )
  @Patch('panic-alerts/:alertId/status')
  updatePanicStatus(
    @Param('alertId', ParseIntPipe)
    alertId: number,
    @Body() dto: UpdatePanicStatusDto,
    @Request() req: RequestWithUser,
  ) {
    return this.chatService.updatePanicStatus(
      alertId,
      dto,
      req.user,
    );
  }
}