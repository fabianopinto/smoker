/**
 * @fileoverview REST Client Module
 *
 * This module provides interfaces and implementations for HTTP REST service clients.
 * It defines the contract for REST operations such as GET, POST, PUT, PATCH, and DELETE
 * with configurable base URL, headers, and request options.
 *
 * The module includes functionality to interact with HTTP APIs using standard REST methods,
 * supporting features like automatic request retries, response parsing, and error handling.
 */

import { AppError, ValidationError } from "@fabianopinto/errors";
import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios";
import { BaseServiceClient, type ServiceClient } from "../core";

/**
 * Interface for REST client operations
 *
 * Defines the contract for REST clients with methods for standard HTTP operations
 * such as GET, POST, PUT, PATCH, and DELETE. Extends the base ServiceClient interface
 * to ensure consistent lifecycle management.
 *
 * This interface provides a comprehensive API for making HTTP requests to REST endpoints,
 * with support for different HTTP methods, request/response body handling, and configuration
 * options. It uses TypeScript generics to provide type-safe response handling, allowing
 * consumers to specify the expected response data structure for each request.
 *
 * @extends {ServiceClient} The base service client interface
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
   * @param {string} url - The URL to request
   * @param {AxiosRequestConfig} [config] - Optional axios request configuration
   * @returns {Promise<AxiosResponse<T>>} Promise resolving to Axios response
   * @throws {ValidationError} if input is invalid
   * @throws {AppError} if request fails
   */
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;

  /**
   * Send a POST request
   *
   * @template T - Response data type
   * @param {string} url - The URL to request
   * @param {unknown} [data] - The data to send in the request body
   * @param {AxiosRequestConfig} [config] - Optional axios request configuration
   * @returns {Promise<AxiosResponse<T>>} Promise resolving to Axios response
   * @throws {ValidationError} if input is invalid
   * @throws {AppError} if request fails
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
   * @param {string} url - The URL to request
   * @param {unknown} [data] - The data to send in the request body
   * @param {AxiosRequestConfig} [config] - Optional axios request configuration
   * @returns {Promise<AxiosResponse<T>>} Promise resolving to Axios response
   * @throws {ValidationError} if input is invalid
   * @throws {AppError} if request fails
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
   * @param {string} url - The URL to request
   * @param {unknown} [data] - The data to send in the request body
   * @param {AxiosRequestConfig} [config] - Optional axios request configuration
   * @returns {Promise<AxiosResponse<T>>} Promise resolving to Axios response
   * @throws {ValidationError} if input is invalid
   * @throws {AppError} if request fails
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
   * @param {string} url - The URL to request
   * @param {AxiosRequestConfig} [config] - Optional axios request configuration
   * @returns {Promise<AxiosResponse<T>>} Promise resolving to Axios response
   * @throws {ValidationError} if input is invalid
   * @throws {AppError} if request fails
   */
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
}

/**
 * REST client implementation for HTTP API interactions
 *
 * This class provides methods to interact with HTTP APIs using standard REST operations,
 * including GET, POST, PUT, PATCH, and DELETE. It implements the RestServiceClient interface
 * and extends BaseServiceClient for consistent lifecycle management.
 *
 * The client uses the Axios HTTP library to handle requests and responses, with support for
 * configurable base URLs, headers, and request timeouts. It includes proper error handling
 * with detailed error messages and URL validation to ensure valid requests.
 *
 * Each HTTP method is implemented with type-safe response handling through TypeScript
 * generics, allowing consumers to specify the expected response data structure.
 *
 * @extends {BaseServiceClient} The base service client class
 * @implements {RestServiceClient} The REST service client interface
 */
export class RestClient extends BaseServiceClient implements RestServiceClient {
  private client: AxiosInstance | null = null;

  /**
   * Create a new REST client
   *
   * @param {string} clientId - Client identifier (defaults to "RestClient")
   * @param {Record<string, unknown>} config - Optional client configuration with properties:
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
   * @throws {ValidationError} if baseURL is invalid
   * @throws {AppError} if client creation fails
   */
  protected async initializeClient(): Promise<void> {
    try {
      // Get configuration with defaults
      const baseURL = this.getConfig<string>("baseURL", "");
      const timeout = this.getConfig<number>("timeout", 30000);
      const headers = this.getConfig<Record<string, string>>("headers", {});

      // Optional validation of baseURL
      if (baseURL && !this.isValidUrl(baseURL)) {
        throw new ValidationError(`Invalid baseURL: ${baseURL}`, {
          code: "HTTP_BASE_URL_INVALID",
          context: { component: "rest", baseURL },
          isOperational: false,
        });
      }

      // Create the Axios client instance
      this.client = axios.create({
        baseURL,
        timeout,
        headers,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new AppError(
        `Failed to initialize REST client: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          code: "HTTP_INIT_FAILED",
          context: {
            component: "rest",
            reason: error instanceof Error ? error.message : String(error),
          },
          isOperational: true,
          cause: error,
        },
      );
    }
  }

  /**
   * Validate a URL string
   *
   * @param {string} url - The URL to validate
   * @returns {boolean} True if the URL is valid, false otherwise
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
   * @param {string} url - The URL to request
   * @param {AxiosRequestConfig} [config] - Optional axios request configuration
   * @returns {Promise<AxiosResponse<T>>} Promise resolving to Axios response
   * @throws {ValidationError} if input is invalid or client is not initialized
   * @throws {AppError} if request fails
   */
  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!url) {
      throw new ValidationError("REST GET request requires a URL", {
        code: "HTTP_URL_REQUIRED",
        context: { component: "rest", method: "GET" },
        isOperational: false,
      });
    }

    try {
      return await this.client.get<T>(url, config);
    } catch (error) {
      throw new AppError(
        `GET request to ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
        {
          code: "HTTP_GET_FAILED",
          context: {
            component: "rest",
            method: "GET",
            url,
            reason: error instanceof Error ? error.message : String(error),
          },
          isOperational: true,
          cause: error,
        },
      );
    }
  }

  /**
   * Send a POST request
   *
   * @template T - Response data type
   * @param {string} url - The URL to request
   * @param {unknown} [data] - The data to send in the request body
   * @param {AxiosRequestConfig} [config] - Optional axios request configuration
   * @returns {Promise<AxiosResponse<T>>} Promise resolving to Axios response
   * @throws {ValidationError} if input is invalid or client is not initialized
   * @throws {AppError} if request fails
   */
  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!url) {
      throw new ValidationError("REST POST request requires a URL", {
        code: "HTTP_URL_REQUIRED",
        context: { component: "rest", method: "POST" },
        isOperational: false,
      });
    }

    try {
      return await this.client.post<T>(url, data, config);
    } catch (error) {
      throw new AppError(
        `POST request to ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
        {
          code: "HTTP_POST_FAILED",
          context: {
            component: "rest",
            method: "POST",
            url,
            reason: error instanceof Error ? error.message : String(error),
          },
          isOperational: true,
          cause: error,
        },
      );
    }
  }

  /**
   * Send a PUT request
   *
   * @template T - Response data type
   * @param {string} url - The URL to request
   * @param {unknown} [data] - The data to send in the request body
   * @param {AxiosRequestConfig} [config] - Optional axios request configuration
   * @returns {Promise<AxiosResponse<T>>} Promise resolving to Axios response
   * @throws {ValidationError} if input is invalid or client is not initialized
   * @throws {AppError} if request fails
   */
  async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!url) {
      throw new ValidationError("REST PUT request requires a URL", {
        code: "HTTP_URL_REQUIRED",
        context: { component: "rest", method: "PUT" },
        isOperational: false,
      });
    }

    try {
      return await this.client.put<T>(url, data, config);
    } catch (error) {
      throw new AppError(
        `PUT request to ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
        {
          code: "HTTP_PUT_FAILED",
          context: {
            component: "rest",
            method: "PUT",
            url,
            reason: error instanceof Error ? error.message : String(error),
          },
          isOperational: true,
          cause: error,
        },
      );
    }
  }

  /**
   * Send a PATCH request
   *
   * @template T - Response data type
   * @param {string} url - The URL to request
   * @param {unknown} [data] - The data to send in the request body
   * @param {AxiosRequestConfig} [config] - Optional axios request configuration
   * @returns {Promise<AxiosResponse<T>>} Promise resolving to Axios response
   * @throws {ValidationError} if input is invalid or client is not initialized
   * @throws {AppError} if request fails
   */
  async patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!url) {
      throw new ValidationError("REST PATCH request requires a URL", {
        code: "HTTP_URL_REQUIRED",
        context: { component: "rest", method: "PATCH" },
        isOperational: false,
      });
    }

    try {
      return await this.client.patch<T>(url, data, config);
    } catch (error) {
      throw new AppError(
        `PATCH request to ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
        {
          code: "HTTP_PATCH_FAILED",
          context: {
            component: "rest",
            method: "PATCH",
            url,
            reason: error instanceof Error ? error.message : String(error),
          },
          isOperational: true,
          cause: error,
        },
      );
    }
  }

  /**
   * Send a DELETE request
   *
   * @template T - Response data type
   * @param {string} url - The URL to request
   * @param {AxiosRequestConfig} [config] - Optional axios request configuration
   * @returns {Promise<AxiosResponse<T>>} Promise resolving to Axios response
   * @throws {ValidationError} if input is invalid or client is not initialized
   * @throws {AppError} if request fails
   */
  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!url) {
      throw new ValidationError("REST DELETE request requires a URL", {
        code: "HTTP_URL_REQUIRED",
        context: { component: "rest", method: "DELETE" },
        isOperational: false,
      });
    }

    try {
      return await this.client.delete<T>(url, config);
    } catch (error) {
      throw new AppError(
        `DELETE request to ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
        {
          code: "HTTP_DELETE_FAILED",
          context: {
            component: "rest",
            method: "DELETE",
            url,
            reason: error instanceof Error ? error.message : String(error),
          },
          isOperational: true,
          cause: error,
        },
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
