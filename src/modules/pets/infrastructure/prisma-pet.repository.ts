import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../infrastructure/database/generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { PetRepository } from '../domain/pet.repository';
import type {
  CreatePetInput,
  Pet,
  PetProfile,
  UpdatePetInput,
} from '../domain/pet.types';

type PetRecord = Prisma.PetGetPayload<Prisma.PetDefaultArgs>;
type PetProfileRecord = Prisma.PetGetPayload<{
  include: { breedReference: true };
}>;

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
        data: toCreateData(customerId, input),
      }),
    );
  }

  public async listProfile(customerId: string): Promise<PetProfile[]> {
    const rows = await this.prisma.pet.findMany({
      where: { customerId },
      include: { breedReference: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(mapPetProfile);
  }

  public async createProfile(
    customerId: string,
    input: CreatePetInput,
  ): Promise<PetProfile> {
    return mapPetProfile(
      await this.prisma.pet.create({
        data: toCreateData(customerId, input),
        include: { breedReference: true },
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
          ...(input.breedId !== undefined ? { breedId: input.breedId } : {}),
          ...(input.sex !== undefined ? { sex: input.sex } : {}),
          ...(input.birthDate !== undefined
            ? { birthDate: input.birthDate }
            : {}),
          ...(input.avatarUrl !== undefined
            ? { avatarUrl: input.avatarUrl }
            : {}),
        },
      }),
    );
  }

  public async updateProfile(
    id: string,
    customerId: string,
    input: UpdatePetInput,
  ): Promise<PetProfile> {
    return mapPetProfile(
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
          ...(input.breedId !== undefined ? { breedId: input.breedId } : {}),
          ...(input.sex !== undefined ? { sex: input.sex } : {}),
          ...(input.birthDate !== undefined
            ? { birthDate: input.birthDate }
            : {}),
          ...(input.avatarUrl !== undefined
            ? { avatarUrl: input.avatarUrl }
            : {}),
        },
        include: { breedReference: true },
      }),
    );
  }
}

const toCreateData = (customerId: string, input: CreatePetInput) => ({
  customerId,
  name: input.name,
  species: input.species,
  weightKg: input.weightKg,
  lifeStage: input.lifeStage,
  breed: input.breed ?? null,
  breedId: input.breedId ?? null,
  sex: input.sex ?? null,
  birthDate: input.birthDate ?? null,
  avatarUrl: input.avatarUrl ?? null,
});

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

const mapPetProfile = (value: PetProfileRecord): PetProfile => ({
  ...mapPet(value),
  breedId: value.breedId,
  sex: value.sex as PetProfile['sex'],
  birthDate: value.birthDate,
  avatarUrl: value.avatarUrl,
  breedReference: value.breedReference
    ? {
        id: value.breedReference.id,
        species: value.breedReference.species,
        name: value.breedReference.name,
      }
    : null,
});
