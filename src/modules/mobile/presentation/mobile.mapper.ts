import type { IdentitySession } from '../../../shared/application/ports/identity-provider.interface';
import type {
  CustomerAddress,
  CustomerProfile,
} from '../../customers/domain/customer.types';
import type { PetProfile, PetSex } from '../../pets/domain/pet.types';
import type { User } from '../../users/domain/entities/user.entity';

export const toMobileCustomer = (customer: CustomerProfile) => ({
  id: customer.id,
  fullName: customer.fullName,
  email: customer.email,
  phone: customer.phone,
  avatarUrl: customer.avatarUrl,
});

export const toMobileUser = (
  user: Pick<User, 'id' | 'email' | 'role'>,
  customer: CustomerProfile,
) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  fullName: customer.fullName,
  phone: customer.phone,
  avatarUrl: customer.avatarUrl,
});

export const toMobileSession = (session: IdentitySession) => ({
  accessToken: session.accessToken,
  refreshToken: session.refreshToken,
  expiresAt: session.expiresAt,
});

export const toMobileAddress = (address: CustomerAddress) => ({
  id: address.id,
  label: address.label,
  recipientName: address.recipientName,
  phone: address.phone,
  street: address.street,
  number: address.number,
  apartment: address.apartment,
  city: address.city,
  province: address.province,
  postalCode: address.postalCode,
  reference: address.reference,
  isDefault: address.isDefault,
});

export const toMobilePet = (pet: PetProfile) => ({
  id: pet.id,
  name: pet.name,
  species: pet.species,
  weightKg: Number(pet.weightKg).toFixed(2),
  lifeStage: pet.lifeStage,
  breed: pet.breedId
    ? {
        id: pet.breedId,
        name: pet.breedReference?.name ?? pet.breed ?? pet.breedId,
      }
    : null,
  sex: pet.sex,
  birthDate: pet.birthDate?.toISOString().slice(0, 10) ?? null,
  age: toMobileAge(pet.birthDate),
  avatarUrl: pet.avatarUrl,
  createdAt: pet.createdAt.toISOString(),
  updatedAt: pet.updatedAt.toISOString(),
});

export const toMobileBreed = (breed: {
  id: string;
  species: string;
  name: string;
  sortOrder: number;
}) => ({
  id: breed.id,
  species: breed.species,
  name: breed.name,
  sortOrder: breed.sortOrder,
});

export const normalizePetSex = (
  sex: string | null | undefined,
): PetSex | null => (sex ? (sex.toLowerCase() as PetSex) : null);

export const calculateAge = (birthDate: Date | null): number | null => {
  if (!birthDate) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayNotReached =
    today.getUTCMonth() < birthDate.getUTCMonth() ||
    (today.getUTCMonth() === birthDate.getUTCMonth() &&
      today.getUTCDate() < birthDate.getUTCDate());
  if (birthdayNotReached) age -= 1;
  return Math.max(0, age);
};

const toMobileAge = (
  birthDate: Date | null,
): { value: number; unit: 'months' | 'years' } | null => {
  if (!birthDate) return null;
  const today = new Date();
  let months =
    (today.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 +
    today.getUTCMonth() -
    birthDate.getUTCMonth();
  if (today.getUTCDate() < birthDate.getUTCDate()) months -= 1;
  months = Math.max(0, months);
  return months < 24
    ? { value: months, unit: 'months' }
    : { value: Math.floor(months / 12), unit: 'years' };
};
