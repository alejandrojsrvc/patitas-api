import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './environment.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.supabase.local', '.env.local', '.env'],
      validate: validateEnvironment,
    }),
  ],
})
export class AppConfigModule {}
