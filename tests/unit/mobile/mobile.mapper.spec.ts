import {
  calculateAge,
  toMobilePet,
} from '../../../src/modules/mobile/presentation/mobile.mapper';

describe('mobile mapper', () => {
  it('derives the pet age from birthDate without persisting age', () => {
    const today = new Date();
    const birthDate = new Date(
      Date.UTC(
        today.getUTCFullYear() - 4,
        today.getUTCMonth(),
        today.getUTCDate(),
      ),
    );

    expect(calculateAge(birthDate)).toBe(4);
    expect(calculateAge(null)).toBeNull();
  });

  it('maps the breed reference and new pet fields for Mobile', () => {
    const pet = toMobilePet({
      id: 'pet-id',
      customerId: 'customer-id',
      name: 'Luna',
      species: 'dog',
      weightKg: '12.50',
      lifeStage: 'adult',
      breed: null,
      breedId: 'labrador-retriever',
      sex: 'female',
      birthDate: new Date('2020-01-02T00:00:00.000Z'),
      avatarUrl: 'https://example.com/luna.jpg',
      breedReference: {
        id: 'labrador-retriever',
        species: 'dog',
        name: 'Labrador retriever',
      },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(pet).toMatchObject({
      breed: {
        id: 'labrador-retriever',
        name: 'Labrador retriever',
      },
      sex: 'female',
      birthDate: '2020-01-02',
      weightKg: '12.50',
      avatarUrl: 'https://example.com/luna.jpg',
    });
    expect(pet).not.toHaveProperty('customerId');
  });
});
