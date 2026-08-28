import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { PetRepository } from '../domain/pet.repository';
import type { CreatePetInput, Pet, UpdatePetInput } from '../domain/pet.types';

type PetRecord = Prisma.PetGetPayload<Prisma.PetDefaultArgs>;

@Injectable()
export class PrismaPetRepository implements PetRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async list(customerId: string) {
    const rows = await this.prisma.pet.findMany({
      where: { customerId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(mapPet);
  }

  public async findOwned(id: string, customerId: string) {
    const row = await this.prisma.pet.findFirst({ where: { id, customerId } });
    return row ? mapPet(row) : null;
  }

  public async create(customerId: string, input: CreatePetInput) {
    return mapPet(
      await this.prisma.pet.create({
        data: {
          customerId,
          name: input.name,
          species: input.species,
          weightKg: input.weightKg,
          lifeStage: input.lifeStage,
          breed: input.breed ?? null,
        },
      }),
    );
  }

  public async update(id: string, customerId: string, input: UpdatePetInput) {
    return mapPet(
      await this.prisma.pet.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.species !== undefined ? { species: input.species } : {}),
          ...(input.weightKg !== undefined ? { weightKg: input.weightKg } : {}),
          ...(input.lifeStage !== undefined
            ? { lifeStage: input.lifeStage }
            : {}),
          ...(input.breed !== undefined ? { breed: input.breed } : {}),
        },
      }),
    );
  }
}

const mapPet = (value: PetRecord): Pet => ({
  id: value.id,
  customerId: value.customerId,
  name: value.name,
  species: value.species as Pet['species'],
  weightKg: value.weightKg.toString(),
  lifeStage: value.lifeStage as Pet['lifeStage'],
  breed: value.breed,
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
});
