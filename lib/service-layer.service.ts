import {
  Inject,
  Injectable,
  Optional,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import {
  ServiceLayerModuleOptions,
  ServiceLayerCompany,
  ServiceLayerToken,
} from './interfaces';
import {
  ALFAERP_SERVICE_LAYER_OPTIONS,
  Endpoints,
} from './service-layer.constants';
import Axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { backOff } from 'exponential-backoff';
import * as https from 'https';
import moment from 'moment';
import { reject } from 'lodash';

@Injectable()
export class ServiceLayerService {
  private readonly axios: AxiosInstance = Axios.create({
    withCredentials: false,
  });
  private PENDING_REQUESTS: number = 0;
  private loginPromises: Record<string, Promise<string | null>> = {};
  private tokens: Record<string, ServiceLayerToken> = {};

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
            this.configureRequest(config).then(newConfig => {
              resolve(newConfig);
            });
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

  async get(
    path: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<any>> {
    return this.axios.get(path, config);
  }

  async post(
    path: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<any>> {
    return this.axios.post(path, data, config);
  }

  async patch(
    path: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<any>> {
    return this.axios.patch(path, data, config);
  }

  async delete(
    path: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<any>> {
    return this.axios.delete(path, config);
  }

  async configureRequest(
    config: AxiosRequestConfig,
  ): Promise<AxiosRequestConfig> {
    if (config.url != Endpoints.Login) {
      let company: ServiceLayerCompany = {
        CompanyDB: config.headers['alfaerp-company'],
        UserName: config.headers['alfaerp-username'],
        Password: config.headers['alfaerp-password'],
      };

      let token = await this.getToken(company);
      config.headers = {
        ...config.headers,
        Cookie: 'B1SESSION=' + token,
      };
    }

    return config;
  }

  async getToken(company: ServiceLayerCompany): Promise<string | null> {
    let loginPromise = this.loginPromises[company.CompanyDB];
    console.log(company.CompanyDB + ' - ' + JSON.stringify(this.tokens));

    if (loginPromise) {
      return loginPromise;
    } else {
      let token = this.tokens[company.CompanyDB];
      if (this.isValidToken(token)) {
        return token.value;
      } else {
        this.loginPromises[company.CompanyDB] = new Promise(
          (resolve, reject) => {
            this.post('Login', company)
              .then(result => {
                if (result.status == 200) {
                  this.tokens[company.CompanyDB] = {
                    value: result.data.SessionId,
                    timestamp: moment(),
                  };
                  resolve(result.data.SessionId);
                }
              })
              .catch(reason => {
                resolve(null);
              });
          },
        );

        return this.loginPromises[company.CompanyDB];
      }
    }
  }

  isValidToken(token: ServiceLayerToken): boolean {
    if (token) {
      let duration = moment
        .duration(moment().diff(token.timestamp))
        .asMinutes();
      if (duration > 10) {
        return false;
      }
    } else {
      return false;
    }

    return true;
  }
}
