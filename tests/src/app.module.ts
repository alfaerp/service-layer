import { DynamicModule, Inject, Module, Optional } from '@nestjs/common';
import { ServiceLayerModule } from '../../lib/service-layer.module';
import { ServiceLayerService } from '../../lib/service-layer.service';

@Module({})
export class AppModule {
  constructor(private readonly serviceLayerService: ServiceLayerService) {}

  static withForRoot(): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ServiceLayerModule.forRoot({
          baseUrl: 'https://177.85.35.34',
          port: 50000,
        }),
      ],
    };
  }

  getBaseUrl() {
    return this.serviceLayerService.getBaseUrl();
  }
}
