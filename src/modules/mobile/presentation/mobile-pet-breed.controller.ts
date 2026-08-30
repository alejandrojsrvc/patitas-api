import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PetBreedService } from '../../pets/application/pet-breed.service';
import { MobilePetBreedsQueryDto } from './mobile.dto';
import { toMobileBreed } from './mobile.mapper';

@ApiTags('Mobile pet breeds')
@Controller('mobile/pet-breeds')
export class MobilePetBreedController {
  public constructor(private readonly breeds: PetBreedService) {}

  @Get()
  public async list(@Query() query: MobilePetBreedsQueryDto) {
    return {
      items: (await this.breeds.listActive(query.species, query.query)).map(
        toMobileBreed,
      ),
      nextCursor: null,
    };
  }
}
