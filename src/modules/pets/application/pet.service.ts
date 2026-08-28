import { DomainError } from '../../../shared/domain/domain-error';
import type { PetRepository } from '../domain/pet.repository';
import type { CreatePetInput, UpdatePetInput } from '../domain/pet.types';

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
  public constructor(private readonly repository: PetRepository) {}

  public list(customerId: string) {
    return this.repository.list(customerId);
  }

  public async create(customerId: string, input: CreatePetInput) {
    validate(input);
    return this.repository.create(customerId, normalize(input));
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
    return this.repository.update(id, customerId, normalize(input));
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
};

const normalize = <T extends CreatePetInput | UpdatePetInput>(input: T): T => ({
  ...input,
  ...(input.name !== undefined ? { name: input.name.trim() } : {}),
  ...(input.weightKg !== undefined ? { weightKg: input.weightKg.trim() } : {}),
  ...(input.breed !== undefined ? { breed: input.breed?.trim() || null } : {}),
});
