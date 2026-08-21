export abstract class Entity {
  protected constructor(public readonly id: string) {}

  public equals(other: Entity | null | undefined): boolean {
    return other !== null && other !== undefined && this.id === other.id;
  }
}
