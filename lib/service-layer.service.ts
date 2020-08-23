import { Inject, Injectable, Optional } from '@nestjs/common';
import { ServiceLayerModuleOptions } from './interfaces';
import { ALFAERP_SERVICE_LAYER_OPTIONS } from './service-layer.constants';

@Injectable()
export class ServiceLayerService {
  constructor(
    @Optional()
    @Inject(ALFAERP_SERVICE_LAYER_OPTIONS)
    private readonly options: ServiceLayerModuleOptions = {},
  ) {}

  getBaseUrl(): string {
    return this.options.baseUrl || '';
  }
}
