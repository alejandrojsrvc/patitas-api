import { Module } from '@nestjs/common';
import { AppConfigModule } from './infrastructure/config/config.module';
import { IdentityModule } from './infrastructure/identity/identity.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { CustomersModule } from './modules/customers/customers.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AuditModule } from './infrastructure/audit/audit.module';
import { CartModule } from './modules/cart/cart.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReplenishmentModule } from './modules/replenishment/replenishment.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { PetsModule } from './modules/pets/pets.module';

@Module({
  imports: [
    AppConfigModule,
    IdentityModule,
    StorageModule,
    UsersModule,
    AuthModule,
    CatalogModule,
    SuppliersModule,
    PricingModule,
    CustomersModule,
    OrdersModule,
    AuditModule,
    PromotionsModule,
    ShippingModule,
    CartModule,
    CheckoutModule,
    PaymentsModule,
    ReplenishmentModule,
    NotificationsModule,
    MarketingModule,
    ReferralsModule,
    InventoryModule,
    DashboardModule,
    AnalyticsModule,
    PetsModule,
  ],
})
export class AppModule {}
