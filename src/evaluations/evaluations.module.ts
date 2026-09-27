import { Module } from '@nestjs/common';
import { EvaluationsController } from './evaluations.controller.js';
import { EvaluationsService } from './evaluations.service.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [EvaluationsController],
  providers: [EvaluationsService],
  exports: [EvaluationsService],
})
export class EvaluationsModule {}