import { DomainError } from '../../../shared/domain/domain-error';
import type { PetRepository } from '../domain/pet.repository';
import type {
  CreatePetInput,
  PetProfile,
  UpdatePetInput,
} from '../domain/pet.types';
import type { PetBreedRepository } from '../domain/pet-breed.repository';

export class PetValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'PET_VALIDATION_FAILED');
  }
}

export class PetNotFoundError extends DomainError {
  public constructor() {
    super('La mascota no existe o no tienes acceso.', 'PET_NOT_FOUND');
  }
}

export class PetService {
  public constructor(
    private readonly repository: PetRepository,
    private readonly breeds?: PetBreedRepository,
  ) {}

  public list(customerId: string) {
    return this.repository.list(customerId);
  }

  public async create(customerId: string, input: CreatePetInput) {
    validate(input);
    await this.validateBreed(input, input.species);
    return this.repository.create(customerId, normalize(input));
  }

  public listForMobile(customerId: string): Promise<PetProfile[]> {
    return this.repository.listProfile(customerId);
  }

  public async createForMobile(customerId: string, input: CreatePetInput) {
    validate(input);
    await this.validateBreed(input, input.species);
    return this.repository.createProfile(customerId, normalize(input));
  }

  public async findOwned(id: string, customerId: string) {
    const pet = await this.repository.findOwned(id, customerId);
    if (!pet) throw new PetNotFoundError();
    return pet;
  }

  public async update(id: string, customerId: string, input: UpdatePetInput) {
    const current = await this.repository.findOwned(id, customerId);
    if (!current) throw new PetNotFoundError();
    const next = { ...current, ...input } as CreatePetInput;
    validate(next);
    await this.validateBreed(input, next.species);
    return this.repository.update(id, customerId, normalize(input));
  }

  public async updateForMobile(
    id: string,
    customerId: string,
    input: UpdatePetInput,
  ) {
    const current = await this.repository.findOwned(id, customerId);
    if (!current) throw new PetNotFoundError();
    const next = { ...current, ...input } as CreatePetInput;
    validate(next);
    await this.validateBreed(input, next.species);
    return this.repository.updateProfile(id, customerId, normalize(input));
  }

  private async validateBreed(
    input: UpdatePetInput,
    species?: CreatePetInput['species'],
  ): Promise<void> {
    if (!input.breedId || !this.breeds) return;
    const breed = await this.breeds.findActiveForSpecies(
      input.breedId,
      species,
    );
    if (!breed) throw new PetValidationError('La raza no es válida.');
  }
}

const validate = (input: CreatePetInput): void => {
  if (!input.name.trim())
    throw new PetValidationError('El nombre es obligatorio.');
  if (!['dog', 'cat'].includes(input.species))
    throw new PetValidationError('La especie no es válida.');
  if (!['puppy', 'adult', 'senior'].includes(input.lifeStage))
    throw new PetValidationError('La etapa de vida no es válida.');
  if (!/^\d+(\.\d{1,2})?$/.test(input.weightKg) || Number(input.weightKg) <= 0)
    throw new PetValidationError('El peso debe ser mayor que cero.');
  if (input.birthDate && input.birthDate > startOfToday())
    throw new PetValidationError('La fecha de nacimiento no puede ser futura.');
};

const normalize = <T extends CreatePetInput | UpdatePetInput>(input: T): T => ({
  ...input,
  ...(input.name !== undefined ? { name: input.name.trim() } : {}),
  ...(input.weightKg !== undefined ? { weightKg: input.weightKg.trim() } : {}),
  ...(input.breed !== undefined ? { breed: input.breed?.trim() || null } : {}),
  ...(input.breedId !== undefined ? { breedId: input.breedId || null } : {}),
  ...(input.avatarUrl !== undefined
    ? { avatarUrl: input.avatarUrl?.trim() || null }
    : {}),
});

const startOfToday = (): Date => {
  const today = new Date();
  return new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
};
