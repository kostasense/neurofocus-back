import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller.js';
import { PatientsService } from './patients.service.js';
import { DatabaseModule } from '../database/database.module.js';
import { CryptoModule } from '../crypto/crypto.module.js';

@Module({
  imports: [
    DatabaseModule,
    CryptoModule,
  ],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}