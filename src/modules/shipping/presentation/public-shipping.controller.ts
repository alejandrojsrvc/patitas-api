import { Controller, Get, Header, Query, UseFilters } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ShippingService } from '../application/shipping.service';
import { ShippingExceptionFilter } from './shipping.exception.filter';
import { PublicShippingQuoteQueryDto } from './shipping.dto';

@ApiTags('Public shipping')
@UseFilters(ShippingExceptionFilter)
@Controller('shipping')
export class PublicShippingController {
  public constructor(private readonly shipping: ShippingService) {}
  @Get('quote')
  @Header('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300')
  public quote(@Query() query: PublicShippingQuoteQueryDto) {
    return this.shipping
      .quote({
        postalCode: query.postalCode,
        neighborhood: query.neighborhood,
        city: query.city,
        province: query.province,
        subtotal: query.subtotal,
        weightGrams: query.weightGrams,
      })
      .then(
        ({
          available,
          cost,
          tariff,
          deliveryCount,
          zoneId,
          zoneName,
          estimate,
          deliverySlots,
          freeShippingFrom,
          eligibleAmount,
          remainingForFreeShipping,
          reasonCode,
          message,
        }) => ({
          available,
          cost,
          tariff,
          deliveryCount,
          zoneId,
          zoneName,
          estimate,
          deliverySlots,
          freeShippingFrom,
          eligibleAmount,
          remainingForFreeShipping,
          reasonCode,
          message,
        }),
      );
  }
}
