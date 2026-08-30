import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { PetBreedRepository } from '../domain/pet-breed.repository';
import type { PetBreed } from '../domain/pet-breed.types';

type PetBreedRecord = Prisma.PetBreedGetPayload<Prisma.PetBreedDefaultArgs>;

@Injectable()
export class PrismaPetBreedRepository implements PetBreedRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async listActive(
    species?: string,
    query?: string,
  ): Promise<PetBreed[]> {
    const rows = await this.prisma.petBreed.findMany({
      where: {
        active: true,
        ...(species ? { species: { in: [species, 'all'] } } : {}),
        ...(query ? { name: { contains: query, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(mapBreed);
  }

  public async findActiveForSpecies(
    id: string,
    species?: string,
  ): Promise<PetBreed | null> {
    const row = await this.prisma.petBreed.findFirst({
      where: {
        id,
        active: true,
        ...(species ? { species: { in: [species, 'all'] } } : {}),
      },
    });
    return row ? mapBreed(row) : null;
  }
}

const mapBreed = (value: PetBreedRecord): PetBreed => ({
  id: value.id,
  species: value.species,
  name: value.name,
  sortOrder: value.sortOrder,
});
