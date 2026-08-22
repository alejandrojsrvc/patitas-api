import { randomBytes } from 'node:crypto';
import { DomainError } from '../../../shared/domain/domain-error';
import type { ReferralRepository } from '../domain/referral.repository';

export class ReferralValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'REFERRAL_VALIDATION_FAILED');
  }
}

export class ReferralService {
  public constructor(private readonly repository: ReferralRepository) {}
  public async createCampaign(input: {
    name: string;
    rewardType: 'PERCENTAGE' | 'FIXED';
    rewardValue: string;
    minimumSubtotal?: string | null;
    firstOrderOnly?: boolean;
    expiresAt?: Date | null;
  }) {
    return this.repository.createCampaign(input);
  }
  public async createCode(customerId: string, campaignId: string) {
    const campaign = await this.repository.findActiveCampaign(campaignId);
    if (!campaign)
      throw new ReferralValidationError(
        'La campaña de referidos no existe o está inactiva.',
      );
    return this.repository.createCode(
      customerId,
      campaignId,
      `PAT-${randomBytes(5).toString('hex').toUpperCase()}`,
    );
  }
  public async attribute(code: string, referredId: string) {
    const referral = await this.repository.findActiveCode(
      code.trim().toUpperCase(),
    );
    if (
      !referral ||
      !referral.campaign.active ||
      (referral.campaign.expiresAt && referral.campaign.expiresAt < new Date())
    )
      throw new ReferralValidationError('El código de referido no es válido.');
    if (referral.referrerId === referredId)
      throw new ReferralValidationError('No puedes referirte a ti mismo.');
    return this.repository.attribute(referral.id, referredId);
  }
  public async mine(customerId: string) {
    return this.repository.mine(customerId);
  }
}
