import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CryptoService } from './crypto.service.js';
import { CryptoController } from './crypto.controller.js';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [CryptoController],
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}