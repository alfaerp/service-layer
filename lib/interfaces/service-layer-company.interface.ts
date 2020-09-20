import { AxiosRequestConfig } from 'axios';
import dayjs from 'dayjs';

export interface ServiceLayerCompany {
  CompanyDB: string;
  UserName: string;
  Password: string;
}

export interface ServiceLayerToken {
  value: string;
  timestamp: dayjs.Dayjs;
}
