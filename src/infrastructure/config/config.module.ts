import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './environment.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: process.env['NODE_ENV'] === 'production' ? [] : process.env['NODE_ENV'] === 'test' ? ['.env.test', '.env.local'] : ['.env.local'],
      validate: validateEnvironment,
    }),
  ],
})
export class AppConfigModule {}
