import { v4 as uuidv4 } from 'uuid';

export enum RequestMethodType {
  'GET' = 'GET',
  'POST' = 'POST',
  'PATCH' = 'PATCH',
  'PUT' = 'PUT',
  'DELETE' = 'DELETE',
}

export interface Request {
  id?: string;
  data?: any;
  method: RequestMethodType;
  path: string;
}

export class BatchRequest {
  private _requests: Request[] = [];
  private _changesets: Changeset[] = [];
  private _id: string;
  private _batchId: string;
  replaceCollections: any;

  constructor(requests: Request[] = [], changesets: Changeset[] = []) {
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

  addRequest(request: Request) {
    this._requests.push(request);
  }

  batchId() {
    return this._batchId;
  }

  id() {
    return this._id;
  }

  changesets(): Changeset[] {
    return this._changesets;
  }

  requests(): Request[] {
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
    return `--${c.id()}
Content-Type: multipart/mixed;boundary=${c.id()}

${c.getRawRequests()}
--${c.id()}--
  `;
  })
  .join('')}`;
  }
}

class Changeset {
  private _requests: Request[] = [];
  private _id: string;

  constructor() {
    this._id = uuidv4();
  }

  id(): string {
    return this._id;
  }

  requests(): Request[] {
    return this._requests;
  }

  addRequest(request: Request) {
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
