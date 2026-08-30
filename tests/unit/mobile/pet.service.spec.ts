import { PetService } from '../../../src/modules/pets/application/pet.service';
import type { PetBreedRepository } from '../../../src/modules/pets/domain/pet-breed.repository';
import type { PetRepository } from '../../../src/modules/pets/domain/pet.repository';

describe('PetService Mobile fields', () => {
  it('validates the breed and forwards birthDate, sex and avatarUrl', async () => {
    const repository: jest.Mocked<PetRepository> = {
      list: jest.fn(),
      findOwned: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      listProfile: jest.fn(),
      createProfile: jest.fn(),
      updateProfile: jest.fn(),
    };
    const breeds: jest.Mocked<PetBreedRepository> = {
      listActive: jest.fn(),
      findActiveForSpecies: jest.fn().mockResolvedValue({
        id: 'labrador-retriever',
        species: 'dog',
        name: 'Labrador retriever',
        sortOrder: 10,
      }),
    };
    const expected = {
      id: 'pet-id',
      customerId: 'customer-id',
      name: 'Luna',
      species: 'dog' as const,
      weightKg: '12.5',
      lifeStage: 'adult' as const,
      breed: null,
      breedId: 'labrador-retriever',
      sex: 'female' as const,
      birthDate: new Date('2020-01-02T00:00:00.000Z'),
      avatarUrl: 'https://example.com/luna.jpg',
      breedReference: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    repository.createProfile.mockResolvedValue(expected);
    const service = new PetService(repository, breeds);

    await expect(
      service.createForMobile('customer-id', {
        name: ' Luna ',
        species: 'dog',
        weightKg: '12.5',
        lifeStage: 'adult',
        breedId: 'labrador-retriever',
        sex: 'female',
        birthDate: new Date('2020-01-02T00:00:00.000Z'),
        avatarUrl: 'https://example.com/luna.jpg',
      }),
    ).resolves.toEqual(expected);

    expect(breeds.findActiveForSpecies.mock.calls[0]).toEqual([
      'labrador-retriever',
      'dog',
    ]);
    expect(repository.createProfile.mock.calls[0]).toEqual([
      'customer-id',
      {
        name: 'Luna',
        species: 'dog',
        weightKg: '12.5',
        lifeStage: 'adult',
        breedId: 'labrador-retriever',
        sex: 'female',
        birthDate: new Date('2020-01-02T00:00:00.000Z'),
        avatarUrl: 'https://example.com/luna.jpg',
      },
    ]);
  });
});
