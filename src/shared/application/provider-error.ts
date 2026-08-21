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
