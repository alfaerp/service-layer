import { AxiosRequestConfig } from 'axios';
import { ServiceLayerCompany } from './service-layer-company.interface';

export interface ServiceLayerRequestConfig extends AxiosRequestConfig {
  credentials: ServiceLayerCompany;
  retries?: number;
  shouldRetry?: (
    path: string,
    data: any,
    ex: any,
    attemptNumber: number,
  ) => Promise<boolean>;
}

export enum ServiceLayerStatusCode {
  'SUCCESS' = 'SUCCESS',
  'BUSINESS_ERROR' = 'BUSINESS_ERROR',
  'SERVICE_LAYER_ERROR' = 'SERVICE_LAYER_ERROR',
}

export interface ServiceLayerError {
  code?: string;
  message?: string;
}

export interface ServiceLayerResponse<T> {
  status: ServiceLayerStatusCode;
  error?: ServiceLayerError;
  data?: T;
}
