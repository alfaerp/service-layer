import {
  Inject,
  Injectable,
  Optional,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ServiceLayerModuleOptions, ServiceLayerCompany } from './interfaces';
import {
  ALFAERP_SERVICE_LAYER_OPTIONS,
  Endpoints,
} from './service-layer.constants';
import Axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { backOff } from 'exponential-backoff';
import * as https from 'https';

@Injectable()
export class ServiceLayerService {
  private readonly axios: AxiosInstance = Axios.create({
    withCredentials: false,
  });
  private PENDING_REQUESTS: number = 0;

  constructor(
    @Optional()
    @Inject(ALFAERP_SERVICE_LAYER_OPTIONS)
    private readonly options: ServiceLayerModuleOptions = {},
  ) {
    this.axios.defaults.baseURL = `${this.options.baseUrl}:${this.options.port}/b1s/v1/`;
    this.axios.defaults.httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    });
    this.axios.defaults.timeout = this.options.timeout;
    this.axios.defaults.headers = {
      'B1S-CaseInsensitive': this.options.caseInsensitive,
    };

    this.axios.interceptors.request.use(config => {
      return new Promise((resolve, reject) => {
        if (this.options.maxConcurrentQueue != Infinity) {
          if (
            this.PENDING_REQUESTS > (this.options.maxConcurrentQueue || 1000)
          ) {
            reject(
              new HttpException(
                'No more concurrent slots available.',
                HttpStatus.TOO_MANY_REQUESTS,
              ),
            );
          }
        }

        let interval = setInterval(() => {
          if (this.PENDING_REQUESTS < (this.options.maxConcurrentCalls || 8)) {
            this.PENDING_REQUESTS++;
            clearInterval(interval);
            resolve(config);
          }
        }, 10);
      });
    });

    this.axios.interceptors.response.use(
      response => {
        this.PENDING_REQUESTS = Math.max(0, this.PENDING_REQUESTS - 1);
        return Promise.resolve(response);
      },
      error => {
        this.PENDING_REQUESTS = Math.max(0, this.PENDING_REQUESTS - 1);
        return Promise.reject(error);
      },
    );
  }

  get(
    path: string,
    company: ServiceLayerCompany,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<any>> {
    return this.axios.get(path, config);
  }

  post(
    path: string,
    company: ServiceLayerCompany,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<any>> {
    return this.axios.post(path, data, config);
  }

  patch(
    path: string,
    company: ServiceLayerCompany,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<any>> {
    return this.axios.patch(path, data, config);
  }

  delete(
    path: string,
    company: ServiceLayerCompany,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<any>> {
    return this.axios.delete(path, config);
  }

  async login(company: ServiceLayerCompany) {
    try {
      const result = await this.post('Login', company, company);
      if (result.status !== 200) {
        console.log(result.status);
        console.log(result.statusText);
      } else {
      }
    } catch (ex) {
      console.log(ex);
    }
  }
}
