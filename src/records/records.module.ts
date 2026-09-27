import { Module } from '@nestjs/common';
import { RecordsController } from './records.controller.js';
import { RecordsService } from './records.service.js';
import { DatabaseModule } from '../database/database.module.js';
import { CryptoModule } from '../crypto/crypto.module.js';

@Module({
  imports: [
    DatabaseModule,
    CryptoModule,
  ],
  controllers: [RecordsController],
  providers: [RecordsService],
  exports: [RecordsService],
})
export class RecordsModule {}