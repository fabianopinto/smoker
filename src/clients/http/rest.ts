/**
 * REST client for HTTP API interactions
 *
 * Provides functionality to interact with HTTP APIs using standard REST methods.
 * Implements HTTP operations (GET, POST, PUT, PATCH, DELETE) with configurable
 * base URL and headers.
 */
import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios";
import { BaseServiceClient } from "../core/base-client";
import type { ServiceClient } from "../core/interfaces";

/**
 * Interface for REST client operations
 *
 * Defines the contract for REST clients with methods for standard HTTP operations
 */
export interface RestServiceClient extends ServiceClient {
  /**
   * Clean up resources used by the client
   */
  cleanupClient(): Promise<void>;

  /**
   * Send a GET request
   *
   * @template T - Response data type
   * @param url - The URL to request
   * @param config - Optional axios request configuration
   * @returns Promise resolving to Axios response
   * @throws Error if request fails
   */
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;

  /**
   * Send a POST request
   *
   * @template T - Response data type
   * @param url - The URL to request
   * @param data - The data to send in the request body
   * @param config - Optional axios request configuration
   * @returns Promise resolving to Axios response
   * @throws Error if request fails
   */
  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>>;

  /**
   * Send a PUT request
   *
   * @template T - Response data type
   * @param url - The URL to request
   * @param data - The data to send in the request body
   * @param config - Optional axios request configuration
   * @returns Promise resolving to Axios response
   * @throws Error if request fails
   */
  put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>>;

  /**
   * Send a PATCH request
   *
   * @template T - Response data type
   * @param url - The URL to request
   * @param data - The data to send in the request body
   * @param config - Optional axios request configuration
   * @returns Promise resolving to Axios response
   * @throws Error if request fails
   */
  patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>>;

  /**
   * Send a DELETE request
   *
   * @template T - Response data type
   * @param url - The URL to request
   * @param config - Optional axios request configuration
   * @returns Promise resolving to Axios response
   * @throws Error if request fails
   */
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
}

/**
 * REST client implementation for HTTP API interactions
 *
 * Implements the RestServiceClient interface using the Axios HTTP client library.
 * Provides methods for standard HTTP operations with configurable base URL and headers.
 */
export class RestClient extends BaseServiceClient implements RestServiceClient {
  private client: AxiosInstance | null = null;

  /**
   * Create a new REST client
   *
   * @param clientId - Client identifier (defaults to "RestClient")
   * @param config - Optional client configuration with properties:
   *   - baseURL: Base URL for all requests
   *   - timeout: Request timeout in milliseconds (default: 30000)
   *   - headers: Default headers to send with each request
   */
  constructor(clientId = "RestClient", config?: Record<string, unknown>) {
    super(clientId, config);
  }

  /**
   * Initialize the REST client with configuration
   *
   * @throws Error if client creation fails
   */
  protected async initializeClient(): Promise<void> {
    try {
      // Get configuration with defaults
      const baseURL = this.getConfig<string>("baseURL", "");
      const timeout = this.getConfig<number>("timeout", 30000);
      const headers = this.getConfig<Record<string, string>>("headers", {});

      // Optional validation of baseURL
      if (baseURL && !this.isValidUrl(baseURL)) {
        throw new Error(`Invalid baseURL: ${baseURL}`);
      }

      // Create the Axios client instance
      this.client = axios.create({
        baseURL,
        timeout,
        headers,
      });
    } catch (error) {
      throw new Error(
        `Failed to initialize REST client: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Validate a URL string
   *
   * @param url - The URL to validate
   * @returns True if the URL is valid, false otherwise
   */
  private isValidUrl(url: string): boolean {
    try {
      // Simple validation: check if URL can be constructed
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Send a GET request
   *
   * @template T - Response data type
   * @param url - The URL to request
   * @param config - Optional axios request configuration
   * @returns Promise resolving to Axios response
   * @throws Error if request fails or client is not initialized
   */
  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!url) {
      throw new Error("REST GET request requires a URL");
    }

    try {
      return await this.client.get<T>(url, config);
    } catch (error) {
      throw new Error(
        `GET request to ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Send a POST request
   *
   * @template T - Response data type
   * @param url - The URL to request
   * @param data - The data to send in the request body
   * @param config - Optional axios request configuration
   * @returns Promise resolving to Axios response
   * @throws Error if request fails or client is not initialized
   */
  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!url) {
      throw new Error("REST POST request requires a URL");
    }

    try {
      return await this.client.post<T>(url, data, config);
    } catch (error) {
      throw new Error(
        `POST request to ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Send a PUT request
   *
   * @template T - Response data type
   * @param url - The URL to request
   * @param data - The data to send in the request body
   * @param config - Optional axios request configuration
   * @returns Promise resolving to Axios response
   * @throws Error if request fails or client is not initialized
   */
  async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!url) {
      throw new Error("REST PUT request requires a URL");
    }

    try {
      return await this.client.put<T>(url, data, config);
    } catch (error) {
      throw new Error(
        `PUT request to ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Send a PATCH request
   *
   * @template T - Response data type
   * @param url - The URL to request
   * @param data - The data to send in the request body
   * @param config - Optional axios request configuration
   * @returns Promise resolving to Axios response
   * @throws Error if request fails or client is not initialized
   */
  async patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!url) {
      throw new Error("REST PATCH request requires a URL");
    }

    try {
      return await this.client.patch<T>(url, data, config);
    } catch (error) {
      throw new Error(
        `PATCH request to ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Send a DELETE request
   *
   * @template T - Response data type
   * @param url - The URL to request
   * @param config - Optional axios request configuration
   * @returns Promise resolving to Axios response
   * @throws Error if request fails or client is not initialized
   */
  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!url) {
      throw new Error("REST DELETE request requires a URL");
    }

    try {
      return await this.client.delete<T>(url, config);
    } catch (error) {
      throw new Error(
        `DELETE request to ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Client-specific cleanup logic
   * Releases the Axios client resources
   */
  async cleanupClient(): Promise<void> {
    // Axios doesn't need explicit cleanup, just nullify the reference
    this.client = null;
  }
}
