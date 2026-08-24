import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './environment.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath:
        process.env['NODE_ENV'] === 'test'
          ? ['.env.test', '.env.local', '.env.dist']
          : ['.env.local', '.env.dist'],
      validate: validateEnvironment,
    }),
  ],
})
export class AppConfigModule {}
