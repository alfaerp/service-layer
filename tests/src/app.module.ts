import { DynamicModule, Inject, Module, Optional } from '@nestjs/common';
import { ServiceLayerModule } from '../../lib/service-layer.module';
import { ServiceLayerService } from '../../lib/service-layer.service';
import asyncPool from 'tiny-async-pool';

@Module({})
export class AppModule {
  constructor(private readonly serviceLayerService: ServiceLayerService) {}

  static withForRoot(): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ServiceLayerModule.forRoot({
          baseUrl: '',
          port: 50000,
        }),
      ],
    };
  }

  async doLoginMultipleTimes() {
    let values = [];
    for (let index = 0; index < 500; index++) {
      values.push({
        CompanyDB: 'SBO_ALFA_TST',
        UserName: 'manager',
        Password: '1234',
      });
    }

    const results = await asyncPool(10, values, company =>
      this.serviceLayerService.login(company),
    );

    return true;
  }
}
