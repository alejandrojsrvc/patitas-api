import type {
  CreatePetInput,
  Pet,
  PetProfile,
  UpdatePetInput,
} from './pet.types';

export const PET_REPOSITORY = Symbol('PET_REPOSITORY');

export interface PetRepository {
  list(customerId: string): Promise<Pet[]>;
  findOwned(id: string, customerId: string): Promise<Pet | null>;
  create(customerId: string, input: CreatePetInput): Promise<Pet>;
  update(id: string, customerId: string, input: UpdatePetInput): Promise<Pet>;
  listProfile(customerId: string): Promise<PetProfile[]>;
  createProfile(customerId: string, input: CreatePetInput): Promise<PetProfile>;
  updateProfile(
    id: string,
    customerId: string,
    input: UpdatePetInput,
  ): Promise<PetProfile>;
}
