import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { RecordsService } from './records.service.js';
import { CreateRecordDto } from './dto/create-record.dto.js';
import { CreateRecordEntryDto } from './dto/create-record-entry.dto.js';
import { CancelRecordEntryDto } from './dto/cancel-record-entry.dto.js';
import { CreateAttachmentDto } from './dto/create-attachment.dto.js';
import { CloseRecordDto } from './dto/close-record.dto.js';
import { ChangeResponsibleDto } from './dto/change-responsible.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

const ROL_PSICOLOGO = 2;
const ROL_ADMINISTRADOR = 3;

interface RequestWithUser extends ExpressRequest {
  user: {
    userId: number;
    correo: string;
    rol: number;
  };
}

@ApiTags('Expedientes')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('records')
export class RecordsController {
  constructor(
    private readonly recordsService: RecordsService,
  ) {}

  @ApiOperation({
    summary: 'Crear el expediente de un paciente',
  })
  @Roles(ROL_PSICOLOGO, ROL_ADMINISTRADOR)
  @Post()
  create(
    @Body() dto: CreateRecordDto,
    @Request() req: RequestWithUser,
  ) {
    return this.recordsService.create(
      dto,
      req.user,
    );
  }

  @ApiOperation({
    summary: 'Consultar el expediente de un paciente',
  })
  @Get('patient/:patientId')
  findByPatient(
    @Param('patientId', ParseIntPipe)
    patientId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.recordsService.findByPatient(
      patientId,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Listar los expedientes asignados a un psicólogo',
  })
  @Roles(ROL_PSICOLOGO, ROL_ADMINISTRADOR)
  @Get('psychologist/:psychologistId')
  findByPsychologist(
    @Param('psychologistId', ParseIntPipe)
    psychologistId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.recordsService.findByPsychologist(
      psychologistId,
      req.user,
    );
  }

  @ApiOperation({
    summary: 'Consultar una entrada del expediente',
  })
  @Get('entries/:entryId')
  findEntry(
    @Param('entryId', ParseIntPipe)
    entryId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.recordsService.findEntryById(
      entryId,
      req.user,
    );
  }

  @ApiOperation({
    summary: 'Anular una entrada del expediente',
  })
  @Roles(ROL_PSICOLOGO)
  @Patch('entries/:entryId/cancel')
  cancelEntry(
    @Param('entryId', ParseIntPipe)
    entryId: number,
    @Body() dto: CancelRecordEntryDto,
    @Request() req: RequestWithUser,
  ) {
    return this.recordsService.cancelEntry(
      entryId,
      dto,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Listar los archivos adjuntos de una entrada',
  })
  @Get('entries/:entryId/attachments')
  findAttachments(
    @Param('entryId', ParseIntPipe)
    entryId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.recordsService.findAttachments(
      entryId,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Registrar los metadatos de un archivo adjunto',
  })
  @Roles(ROL_PSICOLOGO, ROL_ADMINISTRADOR)
  @Post('entries/:entryId/attachments')
  createAttachment(
    @Param('entryId', ParseIntPipe)
    entryId: number,
    @Body() dto: CreateAttachmentDto,
    @Request() req: RequestWithUser,
  ) {
    return this.recordsService.createAttachment(
      entryId,
      dto,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Consultar los metadatos de un archivo adjunto',
  })
  @Get('attachments/:attachmentId')
  findAttachment(
    @Param('attachmentId', ParseIntPipe)
    attachmentId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.recordsService.findAttachmentById(
      attachmentId,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Consultar la línea de tiempo de un expediente',
  })
  @Get(':recordId/entries')
  findEntries(
    @Param('recordId', ParseIntPipe)
    recordId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.recordsService.findEntries(
      recordId,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Crear una entrada cifrada en el expediente',
  })
  @Roles(ROL_PSICOLOGO)
  @Post(':recordId/entries')
  createEntry(
    @Param('recordId', ParseIntPipe)
    recordId: number,
    @Body() dto: CreateRecordEntryDto,
    @Request() req: RequestWithUser,
  ) {
    return this.recordsService.createEntry(
      recordId,
      dto,
      req.user,
    );
  }

  @ApiOperation({
    summary:
      'Cambiar al psicólogo responsable del expediente',
  })
  @Roles(ROL_ADMINISTRADOR)
  @Patch(':recordId/responsible')
  changeResponsible(
    @Param('recordId', ParseIntPipe)
    recordId: number,
    @Body() dto: ChangeResponsibleDto,
    @Request() req: RequestWithUser,
  ) {
    return this.recordsService.changeResponsible(
      recordId,
      dto,
      req.user,
    );
  }

  @ApiOperation({
    summary: 'Cerrar o archivar un expediente',
  })
  @Roles(ROL_PSICOLOGO, ROL_ADMINISTRADOR)
  @Patch(':recordId/close')
  close(
    @Param('recordId', ParseIntPipe)
    recordId: number,
    @Body() dto: CloseRecordDto,
    @Request() req: RequestWithUser,
  ) {
    return this.recordsService.close(
      recordId,
      dto,
      req.user,
    );
  }

  @ApiOperation({
    summary: 'Reabrir un expediente',
  })
  @Roles(ROL_ADMINISTRADOR)
  @Patch(':recordId/reopen')
  reopen(
    @Param('recordId', ParseIntPipe)
    recordId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.recordsService.reopen(
      recordId,
      req.user,
    );
  }

  /*
   * La ruta genérica permanece al final para evitar
   * conflictos con /patient, /psychologist,
   * /entries y /attachments.
   */
  @ApiOperation({
    summary:
      'Consultar un expediente por su identificador',
  })
  @Get(':recordId')
  findOne(
    @Param('recordId', ParseIntPipe)
    recordId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.recordsService.findById(
      recordId,
      req.user,
    );
  }
}