import type {
  MobileAccessRepository,
  RecordMobileAccessInput,
} from '../../../shared/application/ports/mobile-access.repository';

export class MobileAccessService {
  public constructor(private readonly repository: MobileAccessRepository) {}

  public record(input: RecordMobileAccessInput): Promise<void> {
    return this.repository.record({
      ...input,
      deviceId: input.deviceId.trim(),
      platform: input.platform?.trim() || undefined,
      appVersion: input.appVersion?.trim() || undefined,
    });
  }
}
