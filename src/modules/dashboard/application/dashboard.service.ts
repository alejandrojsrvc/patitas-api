import type { PricingService } from '../../pricing/application/pricing.service';
import type { DashboardRepository } from '../domain/dashboard.types';

export class DashboardService {
  public constructor(
    private readonly repository: DashboardRepository,
    private readonly pricing: PricingService,
  ) {}

  public async summary() {
    const { active } = await this.pricing.getRules();
    return this.repository.summary(active);
  }
}
