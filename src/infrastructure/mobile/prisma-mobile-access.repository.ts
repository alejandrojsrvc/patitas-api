import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { UserRole as PrismaUserRole } from '../database/generated/prisma/enums';
import { PrismaService } from '../database/prisma.service';
import type {
  MobileAccessRepository,
  RecordMobileAccessInput,
} from '../../shared/application/ports/mobile-access.repository';

@Injectable()
export class PrismaMobileAccessRepository implements MobileAccessRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async record(input: RecordMobileAccessInput): Promise<void> {
    const now = new Date();
    const accessDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const deviceIdHash = createHash('sha256')
      .update(input.deviceId)
      .digest('hex');
    const unique = {
      userId_accessDate_deviceIdHash: {
        userId: input.userId,
        accessDate,
        deviceIdHash,
      },
    };

    await this.prisma.mobileAccessDaily.upsert({
      where: unique,
      create: {
        userId: input.userId,
        accessDate,
        deviceIdHash,
        platform: input.platform ?? null,
        appVersion: input.appVersion ?? null,
        role: input.role as PrismaUserRole,
      },
      update: {
        accessCount: { increment: 1 },
        platform: input.platform ?? null,
        appVersion: input.appVersion ?? null,
        role: input.role as PrismaUserRole,
        lastSeenAt: now,
      },
    });
  }
}
