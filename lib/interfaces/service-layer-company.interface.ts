import moment from 'moment';

export interface ServiceLayerCompany {
  CompanyDB: string;
  UserName: string;
  Password: string;
}

export interface ServiceLayerToken {
  value: string;
  timestamp: moment.Moment;
}
