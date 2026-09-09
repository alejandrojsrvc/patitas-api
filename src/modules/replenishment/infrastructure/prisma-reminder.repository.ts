import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ReplenishmentReminderValidationError } from '../application/reminder.service';
import type { ReplenishmentReminderRepository } from '../domain/reminder.repository';
import type { ReplenishmentReminder, ReplenishmentReminderOwner, ReplenishmentReminderStatus } from '../domain/reminder.types';

const reminderInclude = { estimate: true } as const;
type ReminderRecord = Prisma.ReplenishmentReminderGetPayload<{
  include: typeof reminderInclude;
}>;

@Injectable()
export class PrismaReplenishmentReminderRepository implements ReplenishmentReminderRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async create(input: { estimateId: string; owner: ReplenishmentReminderOwner; email: string; consentVersion: string }) {
    const estimate = await this.prisma.replenishmentEstimate.findFirst({
      where: {
        id: input.estimateId,
        ...(input.owner.customerId ? { customerId: input.owner.customerId } : { guestAccessTokenHash: input.owner.guestTokenHash }),
      },
    });
    if (!estimate) throw new ReplenishmentReminderValidationError('La estimación no existe o no tienes acceso.');
    const existing = await this.prisma.replenishmentReminder.findFirst({
      where: {
        estimateId: input.estimateId,
        email: input.email,
        status: { in: ['ACTIVE', 'PAUSED'] },
        ...(input.owner.customerId ? { customerId: input.owner.customerId } : { guestAccessTokenHash: input.owner.guestTokenHash }),
      },
      include: reminderInclude,
    });
    if (existing) {
      const nextReminderAt = addDays(estimate.estimatedDepletionDate, -5);
      const updated = await this.prisma.replenishmentReminder.update({
        where: { id: existing.id },
        data: {
          status: 'ACTIVE',
          consentAt: new Date(),
          consentVersion: input.consentVersion,
          nextReminderAt,
          unsubscribedAt: null,
        },
        include: reminderInclude,
      });
      return mapReminder(updated);
    }
    const nextReminderAt = addDays(estimate.estimatedDepletionDate, -5);
    const reminder = await this.prisma.replenishmentReminder.create({
      data: {
        estimateId: estimate.id,
        customerId: input.owner.customerId ?? null,
        guestAccessTokenHash: input.owner.guestTokenHash ?? null,
        email: input.email,
        consentAt: new Date(),
        consentVersion: input.consentVersion,
        nextReminderAt,
      },
      include: reminderInclude,
    });
    return mapReminder(reminder);
  }

  public async list(owner: ReplenishmentReminderOwner) {
    if (!owner.customerId && !owner.guestTokenHash)
      throw new ReplenishmentReminderValidationError('Se requiere autenticación o X-Replenishment-Token.');
    const rows = await this.prisma.replenishmentReminder.findMany({
      where: owner.customerId ? { customerId: owner.customerId } : { guestAccessTokenHash: owner.guestTokenHash },
      include: reminderInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapReminder);
  }

  public async setStatus(id: string, owner: ReplenishmentReminderOwner, status: ReplenishmentReminderStatus) {
    const current = await this.prisma.replenishmentReminder.findFirst({
      where: {
        id,
        ...(owner.customerId ? { customerId: owner.customerId } : { guestAccessTokenHash: owner.guestTokenHash }),
      },
    });
    if (!current) throw new ReplenishmentReminderValidationError('El recordatorio no existe o no tienes acceso.');
    return mapReminder(
      await this.prisma.replenishmentReminder.update({
        where: { id },
        data: {
          status,
          unsubscribedAt: status === 'CANCELLED' ? new Date() : null,
        },
        include: reminderInclude,
      }),
    );
  }
}

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const mapReminder = (value: ReminderRecord): ReplenishmentReminder => ({
  id: value.id,
  customerId: value.customerId,
  guestTokenHash: value.guestAccessTokenHash,
  estimateId: value.estimateId,
  email: value.email,
  consentVersion: value.consentVersion,
  nextReminderAt: value.nextReminderAt,
  status: value.status,
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
});
