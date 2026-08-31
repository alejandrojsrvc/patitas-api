import { ResolveAccessTokenUseCase } from '../../../src/modules/auth/application/use-cases/resolve-access-token.use-case';
import type { AuthAccountRepository } from '../../../src/modules/auth/domain/repositories/auth-account.repository';
import type { IdentityProvider } from '../../../src/shared/application/ports/identity-provider.interface';
import { User } from '../../../src/modules/users/domain/entities/user.entity';

const identity = {
  provider: 'supabase',
  providerUserId: 'provider-user-1',
  email: 'customer@example.com',
  emailVerified: true,
};

describe('ResolveAccessTokenUseCase', () => {
  it('resolves an existing account without provisioning it again', async () => {
    const user = User.create(identity.email, 'user-1');
    const verifyToken = jest.fn().mockResolvedValue(identity);
    const resolve = jest.fn().mockResolvedValue(user);
    const provision = jest.fn();
    const useCase = new ResolveAccessTokenUseCase(
      { verifyToken } as unknown as IdentityProvider,
      { resolve, provision } as unknown as AuthAccountRepository,
    );

    await expect(useCase.execute('access-token')).resolves.toBe(user);
    expect(resolve).toHaveBeenCalledWith(identity);
    expect(provision).not.toHaveBeenCalled();
  });

  it('provisions once when a valid provider identity is not linked locally', async () => {
    const user = User.create(identity.email, 'user-1');
    const resolve = jest.fn().mockResolvedValue(null);
    const provision = jest.fn().mockResolvedValue(user);
    const useCase = new ResolveAccessTokenUseCase(
      {
        verifyToken: jest.fn().mockResolvedValue(identity),
      } as unknown as IdentityProvider,
      { resolve, provision } as unknown as AuthAccountRepository,
    );

    await expect(useCase.execute('access-token')).resolves.toBe(user);
    expect(provision).toHaveBeenCalledWith(identity);
  });
});
