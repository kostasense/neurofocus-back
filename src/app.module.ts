import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { PatientsModule } from './patients/patients.module.js';
import { PsychologistsModule } from './psychologists/psychologists.module.js';
import { AssignmentsModule } from './assignments/assignments.module.js';
import { DatabaseModule } from './database/database.module.js';
import { CryptoModule } from './crypto/crypto.module.js';
import { EvaluationsModule } from './evaluations/evaluations.module.js';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { RecordsModule } from './records/records.module.js';
import { SuggestionsModule } from './suggestions/suggestions.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ChatModule } from './chat/chat.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),

    DatabaseModule,
    CryptoModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    PsychologistsModule,
    AssignmentsModule,
    EvaluationsModule,
    AppointmentsModule,
    RecordsModule,
    SuggestionsModule,
    NotificationsModule,
    ChatModule,
  ],
})
export class AppModule {}