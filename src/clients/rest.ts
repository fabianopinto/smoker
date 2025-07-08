/**
 * REST client for HTTP API interactions
 */
import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios";
import { BaseServiceClient } from "./clients";

/**
 * Interface for REST client operations
 */
export interface RestServiceClient {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>>;
  put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>>;
  patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>>;
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
}

/**
 * REST client implementation for HTTP API interactions
 */
export class RestClient extends BaseServiceClient implements RestServiceClient {
  private client: AxiosInstance | null = null;

  /**
   * Create a new REST client
   */
  constructor() {
    super("RestClient");
  }

  /**
   * Initialize the REST client with configuration
   */
  protected async initializeClient(): Promise<void> {
    const baseURL = this.getConfig<string>("baseURL", "");
    const timeout = this.getConfig<number>("timeout", 30000);
    const headers = this.getConfig<Record<string, string>>("headers", {});

    this.client = axios.create({
      baseURL,
      timeout,
      headers,
    });
  }

  /**
   * Send a GET request
   * @param url The URL to request
   * @param config Optional axios request configuration
   */
  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    this.ensureInitialized();
    this.assertNotNull(this.client);
    return this.client.get<T>(url, config);
  }

  /**
   * Send a POST request
   * @param url The URL to request
   * @param data The data to send
   * @param config Optional axios request configuration
   */
  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    this.ensureInitialized();
    this.assertNotNull(this.client);
    return this.client.post<T>(url, data, config);
  }

  /**
   * Send a PUT request
   * @param url The URL to request
   * @param data The data to send
   * @param config Optional axios request configuration
   */
  async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    this.ensureInitialized();
    this.assertNotNull(this.client);
    return this.client.put<T>(url, data, config);
  }

  /**
   * Send a PATCH request
   * @param url The URL to request
   * @param data The data to send
   * @param config Optional axios request configuration
   */
  async patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    this.ensureInitialized();
    this.assertNotNull(this.client);
    return this.client.patch<T>(url, data, config);
  }

  /**
   * Send a DELETE request
   * @param url The URL to request
   * @param config Optional axios request configuration
   */
  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    this.ensureInitialized();
    this.assertNotNull(this.client);
    return this.client.delete<T>(url, config);
  }

  /**
   * Client-specific destroy logic
   */
  protected async destroyClient(): Promise<void> {
    this.client = null;
  }
}
