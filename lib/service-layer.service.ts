import {
  Inject,
  Injectable,
  Optional,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import {
  ServiceLayerModuleOptions,
  ServiceLayerToken,
  ServiceLayerRequestConfig,
} from './interfaces';
import {
  ALFAERP_SERVICE_LAYER_OPTIONS,
  Endpoints,
} from './service-layer.constants';
import Axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  BatchRequest,
  BatchResponse,
  ODataBatchResponse,
} from './interfaces/service-layer-batch.interface';
import {
  ServiceLayerResponse,
  ServiceLayerStatusCode,
} from './interfaces/service-layer-request-response.interface';
import { backOff } from 'exponential-backoff';
import * as https from 'https';
import * as _ from 'lodash';
import dayjs from 'dayjs';

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
      const serviceLayerConfig: ServiceLayerRequestConfig = {
        credentials: { CompanyDB: '', Password: '', UserName: '' },
        retries: 0,
        shouldRetry: async () => true,
        ...config,
      };

      return new Promise((resolve, reject) => {
        if (config.url != Endpoints.Login) {
          if (
            serviceLayerConfig.credentials.CompanyDB == '' ||
            serviceLayerConfig.credentials.Password == '' ||
            serviceLayerConfig.credentials.UserName == ''
          ) {
            reject(
              new HttpException(
                'Invalid credentials.',
                HttpStatus.UNAUTHORIZED,
              ),
            );
          }
        }

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
            this.configureRequest(serviceLayerConfig)
              .then(newConfig => {
                resolve(newConfig);
              })
              .catch(reason => {
                reject(
                  new HttpException(
                    'Failed to login.',
                    HttpStatus.UNAUTHORIZED,
                  ),
                );
              });
          }
        }, 100 * this.PENDING_REQUESTS);
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

  async parallel<T>(
    data: Array<T>,
    iteratee: (item: T) => Promise<ServiceLayerResponse<T>>,
  ): Promise<ServiceLayerResponse<T>[]> {
    let promises = [];
    for (let index = 0; index < data.length; index++) {
      const item = data[index];
      const promise = new Promise<ServiceLayerResponse<T>>(
        (resolve, reject) => {
          setTimeout(() => {
            iteratee(item)
              .then(result => {
                resolve(result);
              })
              .catch(ex => {
                const res: ServiceLayerResponse<T> = {
                  status: ServiceLayerStatusCode.SERVICE_LAYER_ERROR,
                  error: {
                    code: '500',
                    message: 'Error',
                  },
                };
                resolve(res);
              });
          }, index * 100);
        },
      );
      promises.push(promise);
    }

    return Promise.all<ServiceLayerResponse<T>>(promises);
  }

  async get<T>(
    path: string,
    config: ServiceLayerRequestConfig,
  ): Promise<ServiceLayerResponse<T>> {
    return this.execute<T>(this.axios.get(path, config), path, null, config);
  }

  async post<T>(
    path: string,
    data: any,
    config: ServiceLayerRequestConfig,
  ): Promise<ServiceLayerResponse<T>> {
    return this.execute<T>(
      this.axios.post(path, data, config),
      path,
      data,
      config,
    );
  }

  async patch<T>(
    path: string,
    data?: any,
    config?: ServiceLayerRequestConfig,
  ): Promise<ServiceLayerResponse<T>> {
    return this.execute<T>(
      this.axios.patch(path, data, config),
      path,
      data,
      config,
    );
  }

  async delete<T>(
    path: string,
    config: ServiceLayerRequestConfig,
  ): Promise<ServiceLayerResponse<T>> {
    return this.execute<T>(this.axios.delete(path, config), path, null, config);
  }

  private execute<T>(
    req: Promise<AxiosResponse>,
    path: string,
    data?: any,
    config?: ServiceLayerRequestConfig,
  ): Promise<ServiceLayerResponse<T>> {
    const retries = _.get(config, 'retries', 0);
    const shouldRetry = _.get(config, 'shouldRetry', async () => true);

    const fn = async () => {
      try {
        const response = await req;
        return this.resolveResponse<T>(response);
      } catch (exception) {
        const response = this.resolveError<T>(exception);
        if (
          retries > 0 &&
          response.status == ServiceLayerStatusCode.SERVICE_LAYER_ERROR
        ) {
          throw response;
        } else {
          return response;
        }
      }
    };

    if (retries > 0) {
      return backOff(() => fn(), {
        numOfAttempts: retries,
        retry: (e, a) => shouldRetry(path, data, e, a),
        delayFirstAttempt: true,
      });
    } else {
      return fn();
    }
  }

  private resolveError<T>(exception: any): ServiceLayerResponse<T> {
    let code = _.get(exception, 'code', null);
    let status = _.get(exception, 'status', null);
    let message = _.get(exception, 'message', null);
    let axiosError = _.get(exception, 'isAxiosError', false);

    let result: ServiceLayerResponse<T>;

    if (code == 'ECONNRESET' || code == 'ETIMEDOUT' || code == 'ECONNABORTED') {
      result = {
        status: ServiceLayerStatusCode.SERVICE_LAYER_ERROR,
        error: {
          code,
          message: code,
        },
      };
    } else {
      if (axiosError) {
        const odataErrorCode = _.get(
          exception,
          'response.data.error.code',
          null,
        );
        const odataErrorMessage = _.get(
          exception,
          'response.data.error.message.value',
          null,
        );

        const axiosErrorCode = _.get(exception, 'response.status', null);
        const axiosErrorMessage = _.get(exception, 'response.statusText', null);

        result = {
          status: ServiceLayerStatusCode.BUSINESS_ERROR,
          error: {
            code: odataErrorCode || axiosErrorCode || code || status || '500',
            message:
              odataErrorMessage || axiosErrorMessage || message || 'Error',
          },
        };
      } else {
        result = {
          status: ServiceLayerStatusCode.BUSINESS_ERROR,
          error: {
            code: code || status || '500',
            message: message || 'Error',
          },
        };
      }
    }

    return result;
  }

  private resolveResponse<T>(response: AxiosResponse): ServiceLayerResponse<T> {
    if (
      response.status == 200 ||
      response.status == 201 ||
      response.status == 202 ||
      response.status == 204
    ) {
      let noContent = response.status == 204;
      let dataArray = _.get(response, 'data.value', null);
      let dataSingle = _.get(response, 'data', null);

      if (dataSingle) {
        delete dataSingle['odata.metadata'];
      }

      const result: ServiceLayerResponse<T> = {
        data: noContent ? null : dataArray || dataSingle,
        status: ServiceLayerStatusCode.SUCCESS,
      };
      return result;
    } else {
      const odataErrorCode = _.get(response, 'data.error.code', null);
      const odataErrorMessage = _.get(
        response,
        'data.error.message.value',
        null,
      );

      const axiosErrorCode = _.get(response, 'status', null);
      const axiosErrorMessage = _.get(response, 'statusText', null);

      return {
        status: ServiceLayerStatusCode.BUSINESS_ERROR,
        error: {
          code: odataErrorCode || axiosErrorCode || '500',
          message: odataErrorMessage || axiosErrorMessage || 'Error',
        },
      };
    }
  }

  async batch(
    data: BatchRequest,
    config: ServiceLayerRequestConfig,
  ): Promise<BatchResponse> {
    config.headers = config.headers || {};
    config.headers['Content-Type'] =
      'multipart/mixed;boundary=' + data.batchId();
    if (data.replaceCollections) {
      config.headers['B1S-ReplaceCollectionsOnPatch'] = true;
    }

    const response = new BatchResponse();
    try {
      let result = await this.axios.post('$batch', data.raw(), config);
      response.rawResponse = result;
      if (
        result.status == 200 ||
        result.status == 202 ||
        result.status == 204
      ) {
        response.statusCode = 200;
        response.responses = this.batchResponseHandler(result);
      }
    } catch (ex) {
      response.rawResponse = ex;
    }

    return response;
  }

  private async login(data: any): Promise<AxiosResponse<any>> {
    return this.axios.post('Login', data);
  }

  private async configureRequest(
    config: ServiceLayerRequestConfig,
  ): Promise<ServiceLayerRequestConfig> {
    if (config.url != Endpoints.Login) {
      let token = await backOff(() => this.getToken(config), {
        delayFirstAttempt: true,
        maxDelay: 500,
        numOfAttempts: 3,
      });
      if (token) {
        config.headers = {
          ...config.headers,
          Cookie: 'B1SESSION=' + token,
        };
      } else {
        throw 'Login failed.';
      }
    }
    return config;
  }

  private async getToken(
    config: ServiceLayerRequestConfig,
  ): Promise<string | null> {
    const credentials = config.credentials;
    const loginPromise = this.loginPromises[credentials.CompanyDB];
    if (loginPromise) {
      return loginPromise;
    } else {
      let token = this.tokens[credentials.CompanyDB];
      if (this.isValidToken(token)) {
        return token.value;
      } else {
        this.loginPromises[credentials.CompanyDB] = new Promise(
          (resolve, reject) => {
            this.login(credentials)
              .then(result => {
                if (result.status == 200) {
                  this.tokens[credentials.CompanyDB] = {
                    value: result.data.SessionId,
                    timestamp: dayjs(),
                  };
                  resolve(result.data.SessionId);
                  delete this.loginPromises[credentials.CompanyDB];
                } else {
                  reject(null);
                }
              })
              .catch(reason => {
                reject(null);
                delete this.loginPromises[credentials.CompanyDB];
              });
          },
        );
        return this.loginPromises[credentials.CompanyDB];
      }
    }
  }

  private isValidToken(token: ServiceLayerToken): boolean {
    if (token) {
      let duration = dayjs().diff(token.timestamp, 'minute');
      if (duration > 10) {
        return false;
      }
    } else {
      return false;
    }
    return true;
  }

  private batchResponseHandler(r: AxiosResponse): ODataBatchResponse[] {
    const batchResponses: ODataBatchResponse[] = [];

    const headerContentType = r.headers['content-type'];
    const boundary = headerContentType.replace('multipart/mixed;boundary=', '');

    const batchPartRegex = RegExp('--' + boundary + '(?:\r\n)?(?:--\r\n)?');
    const batchParts = r.data
      .split(batchPartRegex)
      .filter((p: string) => p.trim() != '')
      .map((p: string) => p.trim());
    const contentTypeRegExp = RegExp('^content-type', 'i');

    for (let i = 0; i < batchParts.length; i++) {
      const batchPart = batchParts[i];
      if (contentTypeRegExp.test(batchPart)) {
        const rawResponse = batchPart.split('\r\n\r\n');

        const httpResponseWithHeaders = rawResponse[1].split('\r\n');
        const responseRegex = RegExp('HTTP/1.1 ([0-9]{3}) (.+)');
        const httpCodeAndDesc = httpResponseWithHeaders[0].match(responseRegex);
        const httpCode = parseInt(httpCodeAndDesc[1]);
        const httpDesc = httpCodeAndDesc[2];

        if (httpCode == 200 || httpCode == 201 || httpCode == 202) {
          const result: ODataBatchResponse = {
            statusCode: 200,
            statusText: 'OK',
            data: JSON.parse(rawResponse[2]),
          };
          batchResponses.push(result);
        } else if (httpCode == 204) {
          const result: ODataBatchResponse = {
            statusCode: 200,
            statusText: 'OK',
            data: null,
          };
          batchResponses.push(result);
        } else {
          const errorData = JSON.parse(rawResponse[2]);
          if (httpCode == 400 && errorData.error && errorData.error.message) {
            const result: ODataBatchResponse = {
              statusCode: 400,
              statusText: errorData.error.message.value.toString(),
              data: null,
            };
            batchResponses.push(result);
          } else {
            const result: ODataBatchResponse = {
              statusCode: 400,
              statusText: httpDesc,
              data: null,
            };
            batchResponses.push(result);
          }
        }
      }
    }

    return batchResponses;
  }
}
