import { v4 as uuidv4 } from 'uuid';
import { HttpStatus } from '@nestjs/common';

export enum RequestMethodType {
  'GET' = 'GET',
  'POST' = 'POST',
  'PATCH' = 'PATCH',
  'PUT' = 'PUT',
  'DELETE' = 'DELETE',
}

export interface ODataBatchRequest {
  id?: string;
  data?: any;
  method: RequestMethodType;
  path: string;
}

export interface ODataBatchResponse {
  statusCode: HttpStatus;
  statusText: string;
  data?: any;
}

export class BatchResponse {
  public rawResponse: any;
  public statusCode: HttpStatus = 400;
  public responses: ODataBatchResponse[] = [];
  constructor() {}
  hasErrors(): boolean {
    return (
      this.statusCode == 400 ||
      this.responses.filter(r => ![200, 202, 204].includes(r.statusCode))
        .length > 0
    );
  }

  firstError(): ODataBatchResponse | null {
    if (this.hasErrors()) {
      return this.responses.filter(
        r => ![200, 202, 204].includes(r.statusCode),
      )[0];
    } else {
      return null;
    }
  }
}

export class BatchRequest {
  private _requests: ODataBatchRequest[] = [];
  private _changesets: ODataBatchChangeset[] = [];
  private _id: string;
  private _batchId: string;
  replaceCollections: any;

  constructor(
    requests: ODataBatchRequest[] = [],
    changesets: ODataBatchChangeset[] = [],
  ) {
    this._id = uuidv4();
    this._batchId = 'batch_' + this._id;

    if (requests) {
      requests.forEach(r => {
        this._requests.push(r);
      });
    }

    if (changesets) {
      changesets.forEach(r => {
        this._changesets.push(r);
      });
    }
  }

  addRequest(request: ODataBatchRequest) {
    this._requests.push(request);
  }

  batchId() {
    return this._batchId;
  }

  id() {
    return this._id;
  }

  changesets(): ODataBatchChangeset[] {
    return this._changesets;
  }

  requests(): ODataBatchRequest[] {
    return this._requests;
  }

  hasChanges(): boolean {
    return this._requests.length > 0 || this._changesets.length > 0;
  }

  raw() {
    return `
${this.getRawRequests()}
${this.getRawChangesets()}
--${this._batchId}--
`;
  }

  getRawRequests() {
    return this._requests
      .map(r => {
        if (r.method == RequestMethodType.GET) {
          return `--${this._batchId}
Content-Type: application/http
Content-Transfer-Encoding:binary

${r.method.toString()} /b1s/v1/${r.path};

`;
        } else {
          return `--${this._batchId}
Content-Type: application/http
Content-Transfer-Encoding:binary

${r.method.toString()} /b1s/v1/${r.path}${r.id ? `(${r.id})` : ''}
${
  r.data
    ? `
${JSON.stringify(r.data)}
`
    : ``
}
`;
        }
      })
      .join('');
  }

  getRawChangesets() {
    return `
${this._changesets
  .map(c => {
    return `--${this._batchId}
Content-Type: multipart/mixed;boundary=${c.id()}

${c.getRawRequests()}
--${c.id()}--`;
  })
  .join('')}`;
  }
}

export class ODataBatchChangeset {
  private _requests: ODataBatchRequest[] = [];
  private _id: string;

  constructor() {
    this._id = uuidv4();
  }

  id(): string {
    return this._id;
  }

  requests(): ODataBatchRequest[] {
    return this._requests;
  }

  addRequest(request: ODataBatchRequest) {
    this._requests.push(request);
  }

  getRawRequests() {
    return this._requests
      .map(r => {
        if (r.method == RequestMethodType.GET) {
          return `--${this.id()}
Content-Type: application/http
Content-Transfer-Encoding:binary

${r.method.toString()} /b1s/v1/${r.path};

`;
        } else {
          return `--${this.id()}
Content-Type: application/http
Content-Transfer-Encoding:binary

${r.method.toString()} /b1s/v1/${r.path}${r.id ? `(${r.id})` : ''}
${
  r.data
    ? `
${JSON.stringify(r.data)}
`
    : ``
}
`;
        }
      })
      .join('');
  }
}
