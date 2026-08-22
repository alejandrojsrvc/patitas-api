import { Controller, Get, Query, UseFilters } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ShippingService } from '../application/shipping.service';
import { ShippingExceptionFilter } from './shipping.exception.filter';

@ApiTags('Public shipping')
@UseFilters(ShippingExceptionFilter)
@Controller('shipping')
export class PublicShippingController {
  public constructor(private readonly shipping: ShippingService) {}
  @Get('quote') public quote(@Query('postalCode') postalCode?: string, @Query('neighborhood') neighborhood?: string, @Query('subtotal') subtotal = '0', @Query('weightGrams') weight?: string) { return this.shipping.quote({ postalCode, neighborhood, subtotal, weightGrams: weight ? Number(weight) : undefined }); }
}
