export type PetSpecies = 'dog' | 'cat';
export type PetLifeStage = 'puppy' | 'adult' | 'senior';
export type PetSex = 'male' | 'female' | 'unknown';

export interface PetCurrentFood {
  source: 'catalog' | 'custom';
  productId: string | null;
  variantId: string | null;
  brand: string;
  name: string;
  weightGrams: number | null;
}

export interface SetPetCurrentFoodInput {
  source: 'catalog' | 'custom' | 'none';
  productId?: string;
  variantId?: string;
  brand?: string;
  name?: string;
  weightGrams?: number | null;
}

export interface PetCurrentFoodWrite {
  productId: string | null;
  variantId: string | null;
  brand: string | null;
  name: string | null;
  weightGrams: number | null;
}

export interface CatalogPetFood extends PetCurrentFoodWrite {
  species: string | null;
}

export interface Pet {
  id: string;
  customerId: string;
  name: string;
  species: PetSpecies;
  weightKg: string;
  lifeStage: PetLifeStage;
  breed: string | null;
  currentFood: PetCurrentFood | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PetBreedSummary {
  id: string;
  species: string;
  name: string;
}

export interface PetProfile extends Pet {
  breedId: string | null;
  sex: PetSex | null;
  birthDate: Date | null;
  avatarUrl: string | null;
  breedReference: PetBreedSummary | null;
}

export interface CreatePetInput {
  name: string;
  species: PetSpecies;
  weightKg: string;
  lifeStage: PetLifeStage;
  breed?: string | null;
  breedId?: string | null;
  sex?: PetSex | null;
  birthDate?: Date | null;
  avatarUrl?: string | null;
}

export type UpdatePetInput = Partial<CreatePetInput>;
