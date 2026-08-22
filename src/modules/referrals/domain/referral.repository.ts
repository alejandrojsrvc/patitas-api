export const REFERRAL_REPOSITORY = Symbol('REFERRAL_REPOSITORY');

export interface ReferralCampaignRecord {
  id: string;
  name: string;
  rewardType: 'PERCENTAGE' | 'FIXED';
  rewardValue: string;
  minimumSubtotal: string | null;
  firstOrderOnly: boolean;
  active: boolean;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface ReferralCodeRecord {
  id: string;
  campaignId: string;
  referrerId: string;
  code: string;
  active: boolean;
  createdAt: Date;
  campaign: ReferralCampaignRecord;
  attributions: Array<{ id: string; referredId: string; createdAt: Date }>;
}

export interface ReferralLedgerRecord {
  id: string;
  customerId: string;
  orderId: string | null;
  amount: string;
  reason: string;
  expiresAt: Date | null;
  reversedEntryId: string | null;
  createdAt: Date;
}

export interface ReferralRepository {
  createCampaign(input: {
    name: string;
    rewardType: 'PERCENTAGE' | 'FIXED';
    rewardValue: string;
    minimumSubtotal?: string | null;
    firstOrderOnly?: boolean;
    expiresAt?: Date | null;
  }): Promise<ReferralCampaignRecord>;
  findActiveCampaign(id: string): Promise<ReferralCampaignRecord | null>;
  findActiveCode(code: string): Promise<ReferralCodeRecord | null>;
  createCode(
    customerId: string,
    campaignId: string,
    code: string,
  ): Promise<ReferralCodeRecord>;
  attribute(
    codeId: string,
    referredId: string,
  ): Promise<{ id: string; referralCodeId: string; referredId: string }>;
  mine(customerId: string): Promise<{
    codes: ReferralCodeRecord[];
    ledger: ReferralLedgerRecord[];
  }>;
}
