import { DynamicModule, Inject, Module, Optional } from '@nestjs/common';
import { ServiceLayerModule } from '../../lib/service-layer.module';
import { ServiceLayerService } from '../../lib/service-layer.service';
import asyncPool from 'tiny-async-pool';
import { Endpoints } from '../../lib/service-layer.constants';
import * as _ from 'lodash';

@Module({})
export class AppModule {
  constructor(private readonly serviceLayerService: ServiceLayerService) {}

  static withForRoot(): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ServiceLayerModule.forRoot({
          baseUrl: 'https://hanab1',
          port: 50000,
          maxConcurrentCalls: 10,
        }),
      ],
    };
  }

  async login(): Promise<boolean> {
    let company = {
      CompanyDB: 'SBO_ALFA_TST',
      Password: '1234',
      UserName: 'manager',
    };
    let result = await this.serviceLayerService.post(Endpoints.Login, company);
    return result && result.data && result.data.SessionId;
  }

  async getPath(): Promise<string> {
    let config = {
      headers: {
        'alfaerp-company': '',
        'alfaerp-password': '',
        'alfaerp-username': '',
      },
    };

    let result = await this.serviceLayerService.post(
      Endpoints.CompanyService_GetPathAdmin,
      null,
      config,
    );
    return result && result.data && result.data.PrintId;
  }
}

//   await asyncPool(10, values, async (item) => {
//     try {
//       let result =
//       counting++;
//       if (result.status != 201) {
//         errors++;
//         console.log('Erro diff 201;' + result.status);
//         throw 'Erro diff 201;' + result.status;
//       } else {
//         return result;
//       }
//     }
//     catch (ex) {
//       counting++;
//       errors++;
//       if (ex.code == 'ECONNRESET' || ex.code == 'ETIMEDOUT' || ex.code == 'ECONNABORTED') {
//         console.log('Erro de connection;' + ex.code);
//         return null;
//       } else {
//         console.log(ex);
//         throw ex;
//       }
//     }
//   });
