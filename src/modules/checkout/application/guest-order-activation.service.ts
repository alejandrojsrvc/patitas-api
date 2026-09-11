import type { IdentityProvider, IdentitySession } from '../../../shared/application/ports/identity-provider.interface';
import { hashAnonymousToken } from '../../../shared/application/anonymous-token';
import type { GuestOrderActivationRepository } from '../domain/guest-order-activation.repository';

export class GuestOrderActivationService {
  public constructor(
    private readonly repository: GuestOrderActivationRepository,
    private readonly identity: IdentityProvider,
  ) {}
  public async activate(input: { token: string; password: string; fullName?: string }): Promise<{ session: IdentitySession; orderId: string }> {
    if (!input.token.trim() || input.password.length < 8) throw new Error('El enlace o la contraseña no son válidos.');
    const tokenHash = hashAnonymousToken(input.token);
    const record = await this.repository.findActive(tokenHash);
    if (!record) throw new Error('El enlace de activación no es válido, venció o ya fue utilizado.');
    const session = await this.identity.activateGuest({ email: record.email, password: input.password, displayName: input.fullName });
    await this.repository.consumeAndLink({ tokenHash, userId: session.identity.providerUserId, orderId: record.orderId, email: record.email });
    return { session, orderId: record.orderId };
  }
}
