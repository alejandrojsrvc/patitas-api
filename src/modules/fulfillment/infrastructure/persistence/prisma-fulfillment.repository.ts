import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import type {
  FulfillmentRepository,
  FulfillmentSettings,
  FulfillmentSettingsInput,
} from '../../domain/fulfillment.types';

@Injectable()
export class PrismaFulfillmentRepository implements FulfillmentRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async getSettings(): Promise<FulfillmentSettings> {
    const existing = await this.prisma.fulfillmentSettings.findFirst();
    if (existing) return mapSettings(existing);
    return mapSettings(
      await this.prisma.fulfillmentSettings.create({ data: {} }),
    );
  }

  public async updateSettings(
    input: FulfillmentSettingsInput,
  ): Promise<FulfillmentSettings> {
    const current = await this.getSettings();
    return mapSettings(
      await this.prisma.fulfillmentSettings.update({
        where: { id: current.id },
        data: input,
      }),
    );
  }
}

const mapSettings = (value: {
  id: string;
  timezone: string;
  depotCutoff: string;
  sameDayEnabled: boolean;
  depotHandlingMinutes: number;
  updatedAt: Date;
}): FulfillmentSettings => ({
  id: value.id,
  timezone: value.timezone,
  depotCutoff: value.depotCutoff,
  sameDayEnabled: value.sameDayEnabled,
  depotHandlingMinutes: value.depotHandlingMinutes,
  updatedAt: value.updatedAt,
});
