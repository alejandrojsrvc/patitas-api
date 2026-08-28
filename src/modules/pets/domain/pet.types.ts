export type PetSpecies = 'dog' | 'cat';
export type PetLifeStage = 'puppy' | 'adult' | 'senior';

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

export interface CreatePetInput {
  name: string;
  species: PetSpecies;
  weightKg: string;
  lifeStage: PetLifeStage;
  breed?: string | null;
}

export type UpdatePetInput = Partial<CreatePetInput>;
