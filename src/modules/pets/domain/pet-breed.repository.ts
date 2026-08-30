import type { PetBreed } from './pet-breed.types';

export const PET_BREED_REPOSITORY = Symbol('PET_BREED_REPOSITORY');

export interface PetBreedRepository {
  listActive(species?: string, query?: string): Promise<PetBreed[]>;
  findActiveForSpecies(id: string, species?: string): Promise<PetBreed | null>;
}
