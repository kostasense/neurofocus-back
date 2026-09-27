import { Module } from '@nestjs/common';
import { PsychologistsController } from './psychologists.controller.js';
import { PsychologistsService } from './psychologists.service.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [PsychologistsController],
  providers: [PsychologistsService],
  exports: [PsychologistsService],
})
export class PsychologistsModule {}