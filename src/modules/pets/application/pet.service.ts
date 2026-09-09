import { DomainError } from '../../../shared/domain/domain-error';
import type { PetRepository } from '../domain/pet.repository';
import type { CreatePetInput, PetCurrentFoodWrite, PetProfile, SetPetCurrentFoodInput, UpdatePetInput } from '../domain/pet.types';
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

  public async updateForMobile(id: string, customerId: string, input: UpdatePetInput) {
    const current = await this.repository.findOwned(id, customerId);
    if (!current) throw new PetNotFoundError();
    const next = { ...current, ...input } as CreatePetInput;
    validate(next);
    await this.validateBreed(input, next.species);
    return this.repository.updateProfile(id, customerId, normalize(input));
  }

  public async setCurrentFood(id: string, customerId: string, input: SetPetCurrentFoodInput) {
    const current = await this.repository.findOwned(id, customerId);
    if (!current) throw new PetNotFoundError();
    let food: PetCurrentFoodWrite;
    if (input.source === 'none') {
      food = { productId: null, variantId: null, brand: null, name: null, weightGrams: null };
    } else if (input.source === 'catalog') {
      if (!input.productId || !input.variantId) throw new PetValidationError('Elegí un alimento y una presentación válidos.');
      const catalogFood = await this.repository.resolveCatalogFood(input.productId, input.variantId);
      if (!catalogFood) throw new PetValidationError('El alimento seleccionado ya no está disponible.');
      if (catalogFood.species && normalizeSpecies(catalogFood.species) !== current.species)
        throw new PetValidationError(`Ese alimento no corresponde a ${current.name}. Revisá si elegiste la presentación correcta.`);
      food = catalogFood;
    } else {
      const brand = input.brand?.trim() ?? '';
      const name = input.name?.trim() ?? '';
      const weightGrams = input.weightGrams ?? null;
      if (!brand || !name || !weightGrams || !Number.isInteger(weightGrams) || weightGrams <= 0)
        throw new PetValidationError('Completá marca, alimento y presentación.');
      food = { productId: null, variantId: null, brand, name, weightGrams };
    }
    const pet = await this.repository.setCurrentFood(id, customerId, food);
    if (!pet) throw new PetNotFoundError();
    return pet;
  }

  private async validateBreed(input: UpdatePetInput, species?: CreatePetInput['species']): Promise<void> {
    if (!input.breedId || !this.breeds) return;
    const breed = await this.breeds.findActiveForSpecies(input.breedId, species);
    if (!breed) throw new PetValidationError('La raza no es válida.');
  }
}

const validate = (input: CreatePetInput): void => {
  if (!input.name.trim()) throw new PetValidationError('El nombre es obligatorio.');
  if (!['dog', 'cat'].includes(input.species)) throw new PetValidationError('La especie no es válida.');
  if (!['puppy', 'adult', 'senior'].includes(input.lifeStage)) throw new PetValidationError('La etapa de vida no es válida.');
  if (!/^\d+(\.\d{1,2})?$/.test(input.weightKg) || Number(input.weightKg) <= 0) throw new PetValidationError('El peso debe ser mayor que cero.');
  if (input.birthDate && input.birthDate > startOfToday()) throw new PetValidationError('La fecha de nacimiento no puede ser futura.');
};

const normalize = <T extends CreatePetInput | UpdatePetInput>(input: T): T => ({
  ...input,
  ...(input.name !== undefined ? { name: input.name.trim() } : {}),
  ...(input.weightKg !== undefined ? { weightKg: input.weightKg.trim() } : {}),
  ...(input.breed !== undefined ? { breed: input.breed?.trim() || null } : {}),
  ...(input.breedId !== undefined ? { breedId: input.breedId || null } : {}),
  ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl?.trim() || null } : {}),
});

const startOfToday = (): Date => {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
};

const normalizeSpecies = (value: string): 'dog' | 'cat' | null => {
  const normalized = value.trim().toLowerCase();
  if (['dog', 'perro'].includes(normalized)) return 'dog';
  if (['cat', 'gato'].includes(normalized)) return 'cat';
  return null;
};
