export const MOBILE_ACCESS_REPOSITORY = Symbol('MOBILE_ACCESS_REPOSITORY');

export interface RecordMobileAccessInput {
  userId: string;
  deviceId: string;
  platform?: string;
  appVersion?: string;
  role: string;
}

export interface MobileAccessRepository {
  record(input: RecordMobileAccessInput): Promise<void>;
}
