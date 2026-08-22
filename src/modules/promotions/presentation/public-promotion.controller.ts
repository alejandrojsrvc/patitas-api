import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PromotionService } from '../application/promotion.service';
import { isWithinPeriod } from '../application/promotion.service';

@ApiTags('Public offers')
@Controller('offers')
export class PublicPromotionController {
  public constructor(private readonly promotions: PromotionService) {}

  @Get()
  public async list() {
    const promotions = (await this.promotions.list(true)).filter((promotion) =>
      isWithinPeriod(promotion.startsAt, promotion.endsAt) &&
      (promotion.maxRedemptions === null || promotion.redemptionCount < promotion.maxRedemptions),
    );
    return promotions.map((promotion) => ({
      id: promotion.id,
      name: promotion.name,
      type: promotion.type,
      kind: promotion.kind,
      value: promotion.value,
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
      priority: promotion.priority,
      targets: promotion.targets,
      bundleItems: promotion.bundleItems,
    }));
  }
}
