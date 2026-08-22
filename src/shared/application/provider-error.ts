export class ProviderOperationError extends Error {
  public constructor(
    public readonly provider: string,
    public readonly operation: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = ProviderOperationError.name;
  }
}

export class ProviderAuthenticationError extends ProviderOperationError {
  public constructor(
    provider: string,
    operation: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(provider, operation, message, options);
    this.name = ProviderAuthenticationError.name;
  }
}
