import { Module } from '@nestjs/common';
import { AppConfigModule } from './infrastructure/config/config.module';
import { IdentityModule } from './infrastructure/identity/identity.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [AppConfigModule, IdentityModule, StorageModule, UsersModule],
})
export class AppModule {}
