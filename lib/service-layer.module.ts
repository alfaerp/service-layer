import { DynamicModule, Module, Global } from '@nestjs/common';
import { ALFAERP_SERVICE_LAYER_OPTIONS } from './service-layer.constants';
import { ServiceLayerModuleOptions } from './interfaces';
import { ServiceLayerService } from './service-layer.service';

@Global()
@Module({})
export class ServiceLayerModule {
  /**
   * Loads service layer options with default values
   * @param options
   */
  static forRoot(options: ServiceLayerModuleOptions = {}): DynamicModule {
    let defaultOptions: Record<string, any> | undefined = {
      port: 50000,
      baseUrl: 'https://hanab1',
    };

    let config = {
      ...defaultOptions,
      ...options,
    };

    return {
      module: ServiceLayerModule,
      providers: [
        {
          provide: ALFAERP_SERVICE_LAYER_OPTIONS,
          useValue: config,
        },
        ServiceLayerService,
      ],
      exports: [ServiceLayerService],
    };
  }
}
