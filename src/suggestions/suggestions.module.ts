import { Module } from '@nestjs/common';
import { SuggestionsController } from './suggestions.controller.js';
import { SuggestionsService } from './suggestions.service.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [SuggestionsController],
  providers: [SuggestionsService],
  exports: [SuggestionsService],
})
export class SuggestionsModule {}