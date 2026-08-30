import type { PetBreedRepository } from '../domain/pet-breed.repository';

export class PetBreedService {
  public constructor(private readonly repository: PetBreedRepository) {}

  public listActive(species?: string, query?: string) {
    return this.repository.listActive(species, query?.trim() || undefined);
  }
}
