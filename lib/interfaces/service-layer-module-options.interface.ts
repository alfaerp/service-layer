export interface ServiceLayerModuleOptions {
  /**
   * URL to access service layer
   * Defaults to https://hanab1
   */
  baseUrl?: string;

  /**
   * Service layer port
   *  Defaults to 50000
   */
  port?: number;

  /**
   *  Max concurrent calls
   *  Defaults to 8
   */
  maxConcurrentCalls?: number;

  /**
   *  Max queue slots available for concurrent calls
   *  Defaults to Infinity
   */
  maxConcurrentQueue?: number;

  /**
   *  Timeout in milliseconds
   *  Defaults to 60000
   */
  timeout?: number;

  /**
   *   OData case insensitive option
   *   Defaults to true
   */
  caseInsensitive?: boolean;
}
