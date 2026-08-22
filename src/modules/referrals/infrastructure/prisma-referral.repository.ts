import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  ReferralCampaignRecord,
  ReferralCodeRecord,
  ReferralLedgerRecord,
  ReferralRepository,
} from '../domain/referral.repository';

const campaignSelect = {
  id: true,
  name: true,
  rewardType: true,
  rewardValue: true,
  minimumSubtotal: true,
  firstOrderOnly: true,
  active: true,
  expiresAt: true,
  createdAt: true,
} as const;
const codeInclude = {
  campaign: { select: campaignSelect },
  attributions: { select: { id: true, referredId: true, createdAt: true } },
} as const;
type CampaignRecord = Prisma.ReferralCampaignGetPayload<{
  select: typeof campaignSelect;
}>;
type CodeRecord = Prisma.ReferralCodeGetPayload<{
  include: typeof codeInclude;
}>;

@Injectable()
export class PrismaReferralRepository implements ReferralRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async createCampaign(input: {
    name: string;
    rewardType: 'PERCENTAGE' | 'FIXED';
    rewardValue: string;
    minimumSubtotal?: string | null;
    firstOrderOnly?: boolean;
    expiresAt?: Date | null;
  }): Promise<ReferralCampaignRecord> {
    return mapCampaign(
      await this.prisma.referralCampaign.create({
        data: input,
        select: campaignSelect,
      }),
    );
  }

  public async findActiveCampaign(
    id: string,
  ): Promise<ReferralCampaignRecord | null> {
    const campaign = await this.prisma.referralCampaign.findFirst({
      where: { id, active: true },
      select: campaignSelect,
    });
    return campaign ? mapCampaign(campaign) : null;
  }

  public async findActiveCode(
    code: string,
  ): Promise<ReferralCodeRecord | null> {
    const record = await this.prisma.referralCode.findFirst({
      where: { code, active: true },
      include: codeInclude,
    });
    return record ? mapCode(record) : null;
  }

  public async createCode(
    customerId: string,
    campaignId: string,
    code: string,
  ): Promise<ReferralCodeRecord> {
    return mapCode(
      await this.prisma.referralCode.create({
        data: { campaignId, referrerId: customerId, code },
        include: codeInclude,
      }),
    );
  }

  public async attribute(codeId: string, referredId: string) {
    return this.prisma.referralAttribution.upsert({
      where: {
        referralCodeId_referredId: { referralCodeId: codeId, referredId },
      },
      create: { referralCodeId: codeId, referredId },
      update: {},
      select: { id: true, referralCodeId: true, referredId: true },
    });
  }

  public async mine(customerId: string) {
    const [codes, ledger] = await Promise.all([
      this.prisma.referralCode.findMany({
        where: { referrerId: customerId },
        include: codeInclude,
      }),
      this.prisma.referralLedgerEntry.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          customerId: true,
          orderId: true,
          amount: true,
          reason: true,
          expiresAt: true,
          reversedEntryId: true,
          createdAt: true,
        },
      }),
    ]);
    return { codes: codes.map(mapCode), ledger: ledger.map(mapLedger) };
  }
}

const mapCampaign = (value: CampaignRecord): ReferralCampaignRecord => ({
  id: value.id,
  name: value.name,
  rewardType: value.rewardType,
  rewardValue: value.rewardValue.toString(),
  minimumSubtotal: value.minimumSubtotal?.toString() ?? null,
  firstOrderOnly: value.firstOrderOnly,
  active: value.active,
  expiresAt: value.expiresAt,
  createdAt: value.createdAt,
});
const mapCode = (value: CodeRecord): ReferralCodeRecord => ({
  id: value.id,
  campaignId: value.campaignId,
  referrerId: value.referrerId,
  code: value.code,
  active: value.active,
  createdAt: value.createdAt,
  campaign: mapCampaign(value.campaign),
  attributions: value.attributions,
});
const mapLedger = (value: {
  id: string;
  customerId: string;
  orderId: string | null;
  amount: Prisma.Decimal;
  reason: string;
  expiresAt: Date | null;
  reversedEntryId: string | null;
  createdAt: Date;
}): ReferralLedgerRecord => ({ ...value, amount: value.amount.toString() });
