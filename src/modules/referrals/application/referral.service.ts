import { randomBytes } from 'node:crypto';
import type { PrismaService } from '../../../infrastructure/database/prisma.service';
import { DomainError } from '../../../shared/domain/domain-error';

export class ReferralValidationError extends DomainError { public constructor(message: string) { super(message, 'REFERRAL_VALIDATION_FAILED'); } }

export class ReferralService {
  public constructor(private readonly prisma: PrismaService) {}
  public async createCampaign(input: { name: string; rewardType: 'PERCENTAGE' | 'FIXED'; rewardValue: string; minimumSubtotal?: string | null; firstOrderOnly?: boolean; expiresAt?: Date | null }) { return (this.prisma as any).referralCampaign.create({ data: input }); }
  public async createCode(customerId: string, campaignId: string) { const db = this.prisma as any; const campaign = await db.referralCampaign.findFirst({ where: { id: campaignId, active: true } }); if (!campaign) throw new ReferralValidationError('La campaña de referidos no existe o está inactiva.'); return db.referralCode.create({ data: { campaignId, referrerId: customerId, code: `PAT-${randomBytes(5).toString('hex').toUpperCase()}` } }); }
  public async attribute(code: string, referredId: string) { const db = this.prisma as any; const referral = await db.referralCode.findFirst({ where: { code: code.trim().toUpperCase(), active: true }, include: { campaign: true } }); if (!referral || !referral.campaign.active || (referral.campaign.expiresAt && referral.campaign.expiresAt < new Date())) throw new ReferralValidationError('El código de referido no es válido.'); if (referral.referrerId === referredId) throw new ReferralValidationError('No puedes referirte a ti mismo.'); return db.referralAttribution.upsert({ where: { referralCodeId_referredId: { referralCodeId: referral.id, referredId } }, create: { referralCodeId: referral.id, referredId }, update: {} }); }
  public async mine(customerId: string) { const db = this.prisma as any; return { codes: await db.referralCode.findMany({ where: { referrerId: customerId }, include: { campaign: true, attributions: true } }), ledger: await db.referralLedgerEntry.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' } }) }; }
}
