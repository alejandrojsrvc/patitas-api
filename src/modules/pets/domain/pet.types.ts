export type PetSpecies = 'dog' | 'cat';
export type PetLifeStage = 'puppy' | 'adult' | 'senior';
export type PetSex = 'male' | 'female' | 'unknown';

export interface Pet {
  id: string;
  customerId: string;
  name: string;
  species: PetSpecies;
  weightKg: string;
  lifeStage: PetLifeStage;
  breed: string | null;
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
