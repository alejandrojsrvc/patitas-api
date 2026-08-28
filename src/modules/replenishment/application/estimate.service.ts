import { DomainError } from '../../../shared/domain/domain-error';
import { CatalogService } from '../../catalog/application/catalog.service';
import type { ReplenishmentEstimateRepository } from '../domain/estimate.repository';
import type { CreateEstimateInput } from '../domain/estimate.types';

export class EstimateValidationError extends DomainError {
  public constructor(message: string) {
    super(message, 'REPLENISHMENT_ESTIMATE_VALIDATION_FAILED');
  }
}

export class EstimateService {
  public constructor(
    private readonly repository: ReplenishmentEstimateRepository,
    private readonly catalog: CatalogService,
  ) {}

  public async create(customerId: string, input: CreateEstimateInput) {
    validate(input);
    const result = input.food.custom
      ? this.catalog.calculateCustomFoodDuration({
          species: input.pet.species,
          petWeightKg: input.pet.weightKg,
          presentationGrams: input.food.custom.weightGrams,
          lifeStage: input.pet.lifeStage,
        })
      : await this.catalog.calculateFoodDurationByIds({
          productId: input.food.productId!,
          variantId: input.food.variantId!,
          petWeightKg: input.pet.weightKg,
          lifeStage: input.pet.lifeStage,
        });
    const estimatedDepletionDate = new Date();
    estimatedDepletionDate.setUTCDate(
      estimatedDepletionDate.getUTCDate() + Math.ceil(result.durationDays.max),
    );
    return this.repository.create({
      customerId,
      petId: input.pet.id ?? null,
      request: input,
      result: { ...result, estimatedDepletionDate },
    });
  }

  public async findOwned(id: string, customerId: string) {
    const result = await this.repository.findOwned(id, customerId);
    if (!result)
      throw new EstimateValidationError(
        'La estimación no existe o no tienes acceso.',
      );
    return result;
  }
}

const validate = (input: CreateEstimateInput): void => {
  if (
    !input.pet.name.trim() ||
    !input.pet.species.trim() ||
    !input.pet.lifeStage.trim()
  )
    throw new EstimateValidationError(
      'Los datos de la mascota son obligatorios.',
    );
  if (!Number.isFinite(input.pet.weightKg) || input.pet.weightKg <= 0)
    throw new EstimateValidationError(
      'El peso de la mascota debe ser mayor que cero.',
    );
  const hasCatalogFood = Boolean(input.food.productId && input.food.variantId);
  const hasCustomFood = Boolean(input.food.custom);
  if (hasCatalogFood === hasCustomFood)
    throw new EstimateValidationError(
      'Indica un alimento del catálogo o uno personalizado.',
    );
  if (
    input.food.custom &&
    (!input.food.custom.brand.trim() ||
      !input.food.custom.name.trim() ||
      input.food.custom.weightGrams <= 0)
  )
    throw new EstimateValidationError(
      'Los datos del alimento personalizado no son válidos.',
    );
};
