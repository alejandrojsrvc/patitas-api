import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ShippingValidationError } from '../application/shipping.service';
import type { ShippingRepository } from '../domain/shipping.repository';
import type { ShippingOption, ShippingOptionInput, ShippingQuote, ShippingZone, ShippingZoneInput } from '../domain/shipping.types';

@Injectable()
export class PrismaShippingRepository implements ShippingRepository {
  public constructor(private readonly prisma: PrismaService) {}
  public async list(activeOnly = false) { const rows = await this.prisma.shippingOption.findMany({ where: activeOnly ? { active: true } : undefined, orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] }); return rows.map(mapOption); }
  public async find(id: string) { const row = await this.prisma.shippingOption.findUnique({ where: { id } }); return row ? mapOption(row) : null; }
  public async create(input: ShippingOptionInput) { return mapOption(await this.prisma.shippingOption.create({ data: input })); }
  public async update(id: string, input: Partial<ShippingOptionInput>) {
    try { return mapOption(await this.prisma.shippingOption.update({ where: { id }, data: input })); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new ShippingValidationError('La opción de envío no existe.'); throw error; }
  }
  public async listZones(activeOnly = false) { const rows = await (this.prisma as any).shippingZone.findMany({ where: activeOnly ? { active: true } : undefined, orderBy: [{ priority: 'desc' }, { name: 'asc' }] }); return rows.map(mapZone); }
  public async createZone(input: ShippingZoneInput) { return mapZone(await (this.prisma as any).shippingZone.create({ data: input })); }
  public async updateZone(id: string, input: Partial<ShippingZoneInput>) { try { return mapZone(await (this.prisma as any).shippingZone.update({ where: { id }, data: input })); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new ShippingValidationError('La zona de cobertura no existe.'); throw error; } }
  public async quote(input: { postalCode?: string; neighborhood?: string; subtotal: string; weightGrams?: number }): Promise<ShippingQuote> {
    const zones = await (this.prisma as any).shippingZone.findMany({ where: { active: true }, orderBy: [{ priority: 'desc' }, { name: 'asc' }] });
    const postalCode = input.postalCode?.trim().toUpperCase();
    const neighborhood = input.neighborhood?.trim().toLowerCase();
    const zone = zones.find((candidate: any) => (!candidate.maxWeightGrams || !input.weightGrams || input.weightGrams <= candidate.maxWeightGrams) && ((postalCode && candidate.postalCodes.some((value: string) => value.toUpperCase() === postalCode)) || (neighborhood && candidate.neighborhoods.some((value: string) => value.toLowerCase() === neighborhood))));
    if (!zone) return { available: false, zoneId: null, zoneName: null, cost: '0.00', estimate: null, message: 'La dirección está fuera de cobertura.' };
    const cost = zone.freeShippingFrom !== null && Number(input.subtotal) >= Number(zone.freeShippingFrom) ? 0 : Number(zone.cost);
    return { available: true, zoneId: zone.id, zoneName: zone.name, cost: cost.toFixed(2), estimate: `${zone.estimatedDaysMin}-${zone.estimatedDaysMax} días hábiles`, message: 'Envío disponible.' };
  }
}
const mapOption = (value: any): ShippingOption => ({ id: value.id, name: value.name, description: value.description, cost: value.cost.toString(), active: value.active, displayOrder: value.displayOrder });
const mapZone = (value: any): ShippingZone => ({ id: value.id, name: value.name, type: value.type, active: value.active, priority: value.priority, postalCodes: value.postalCodes ?? [], neighborhoods: value.neighborhoods ?? [], polygon: value.polygon ?? null, cost: value.cost.toString(), freeShippingFrom: value.freeShippingFrom?.toString() ?? null, maxWeightGrams: value.maxWeightGrams ?? null, estimatedDaysMin: value.estimatedDaysMin, estimatedDaysMax: value.estimatedDaysMax, deliveryWindows: value.deliveryWindows ?? null });
