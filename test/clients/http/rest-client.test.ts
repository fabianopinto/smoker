/**
 * Tests for the RestClient class
 *
 * Tests the HTTP REST client implementation for making API requests
 * using Axios as the underlying HTTP client.
 *
 * Test coverage includes:
 * - Constructor initialization and configuration
 * - Client initialization with Axios setup
 * - HTTP method implementations (GET, POST, PUT, PATCH, DELETE)
 * - Error handling for requests and initialization
 * - Client cleanup and resource management
 */

import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RestClient } from "../../../src/clients/http";

/**
 * Mock axios
 */
vi.mock("axios");
const mockedAxios = vi.mocked(axios);

/**
 * Test fixtures and constants
 */
const TEST_FIXTURES = {
  // Client configuration
  CLIENT_ID: "test-rest-client",
  DEFAULT_CLIENT_ID: "RestClient",

  // API endpoints
  BASE_URL: "https://api.example.com",
  USERS_PATH: "/users",
  USER_BY_ID_PATH: "/users/123",

  // Request/response data
  REQUEST_BODY: { name: "John Doe", email: "john@example.com" },
  RESPONSE_DATA: { id: 1, name: "John Doe", status: "created" },

  // Configuration
  CUSTOM_TIMEOUT: 5000,

  // Error messages - string constants
  ERROR_NOT_INITIALIZED: "RestClient is not initialized. Call init() first",

  // Error message functions
  ERROR_EMPTY_URL: (method: string) => `REST ${method} request requires a URL`,
  ERROR_REQUEST_FAILED: (method: string, url: string, error: string) =>
    `${method} request to ${url} failed: ${error}`,
};

/**
 * Creates a mock Axios instance for testing
 *
 * @return Partial Axios implementation with mocked HTTP methods
 */
function createMockAxiosInstance(): Partial<AxiosInstance> {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
}

/**
 * Creates a mock Axios response object
 *
 * @template T - The type of the response data
 * @param data - The response data to include
 * @return Axios response with the provided data
 */
function createMockResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: {} as AxiosResponse<T>["config"],
    request: {},
  };
}

/**
 * Tests for RestClient
 */
describe("RestClient", () => {
  let restClient: RestClient;
  let mockAxiosInstance: Partial<AxiosInstance>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAxiosInstance = createMockAxiosInstance();
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as AxiosInstance);
  });

  // Helper to get typed mock instance
  const getMockInstance = () => mockAxiosInstance as AxiosInstance;

  /**
   * Tests for constructor
   */
  describe("constructor", () => {
    it("should create instance with default client ID", () => {
      restClient = new RestClient();
      expect(restClient.getName()).toBe(TEST_FIXTURES.DEFAULT_CLIENT_ID);
    });

    it("should create instance with custom client ID", () => {
      restClient = new RestClient(TEST_FIXTURES.CLIENT_ID);
      expect(restClient.getName()).toBe(TEST_FIXTURES.CLIENT_ID);
    });

    it("should create instance with configuration", () => {
      const config = {
        baseURL: TEST_FIXTURES.BASE_URL,
        timeout: TEST_FIXTURES.CUSTOM_TIMEOUT,
      };
      restClient = new RestClient(TEST_FIXTURES.CLIENT_ID, config);
      expect(restClient.getName()).toBe(TEST_FIXTURES.CLIENT_ID);
    });
  });

  /**
   * Tests for init
   */
  describe("init", () => {
    beforeEach(() => {
      restClient = new RestClient(TEST_FIXTURES.CLIENT_ID, {
        baseURL: TEST_FIXTURES.BASE_URL,
        timeout: TEST_FIXTURES.CUSTOM_TIMEOUT,
      });
    });

    it("should initialize client with configuration", async () => {
      await restClient.init();

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: TEST_FIXTURES.BASE_URL,
        timeout: TEST_FIXTURES.CUSTOM_TIMEOUT,
        headers: {},
      });
      expect(restClient.isInitialized()).toBe(true);
    });

    it("should initialize with defaults when no config provided", async () => {
      restClient = new RestClient(TEST_FIXTURES.CLIENT_ID, {});
      await restClient.init();

      expect(mockedAxios.create).toHaveBeenCalledWith({ baseURL: "", timeout: 30000, headers: {} });
      expect(restClient.isInitialized()).toBe(true);
    });

    it("should throw error for invalid baseURL", async () => {
      restClient = new RestClient(TEST_FIXTURES.CLIENT_ID, { baseURL: "invalid-url" });

      await expect(restClient.init()).rejects.toThrow("Invalid baseURL: invalid-url");
      expect(restClient.isInitialized()).toBe(false);
    });

    it("should handle axios creation errors", async () => {
      vi.mocked(mockedAxios.create).mockImplementation(() => {
        throw new Error("Axios creation failed");
      });

      await expect(restClient.init()).rejects.toThrow(
        "Failed to initialize REST client: Axios creation failed",
      );
      expect(restClient.isInitialized()).toBe(false);
    });

    it("should handle non-Error exceptions from axios creation", async () => {
      vi.mocked(mockedAxios.create).mockImplementation(() => {
        throw "String error message"; // Throw a non-Error object
      });

      await expect(restClient.init()).rejects.toThrow(
        "Failed to initialize REST client: String error message",
      );
      expect(restClient.isInitialized()).toBe(false);
    });
  });

  /**
   * Tests for HTTP methods
   */
  describe("HTTP methods", () => {
    beforeEach(async () => {
      restClient = new RestClient(TEST_FIXTURES.CLIENT_ID, {
        baseURL: TEST_FIXTURES.BASE_URL,
      });
      await restClient.init();
    });

    /**
     * Tests for GET method
     */
    describe("get", () => {
      it("should make successful GET request", async () => {
        const mockResponse = createMockResponse(TEST_FIXTURES.RESPONSE_DATA);
        vi.mocked(getMockInstance().get).mockResolvedValue(mockResponse);

        const result = await restClient.get(TEST_FIXTURES.USERS_PATH);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith(TEST_FIXTURES.USERS_PATH, undefined);
        expect(result).toEqual(mockResponse);
      });

      it("should throw error for empty URL", async () => {
        await expect(restClient.get("")).rejects.toThrow(TEST_FIXTURES.ERROR_EMPTY_URL("GET"));
      });

      it("should handle GET request errors", async () => {
        const error = new Error("Network Error");
        vi.mocked(getMockInstance().get).mockRejectedValue(error);

        await expect(restClient.get(TEST_FIXTURES.USERS_PATH)).rejects.toThrow(
          TEST_FIXTURES.ERROR_REQUEST_FAILED("GET", TEST_FIXTURES.USERS_PATH, error.message),
        );
      });

      it("should handle GET request non-Error exceptions", async () => {
        const errorMessage = "Non-Error exception";
        vi.mocked(getMockInstance().get).mockRejectedValue(errorMessage);

        await expect(restClient.get(TEST_FIXTURES.USERS_PATH)).rejects.toThrow(
          TEST_FIXTURES.ERROR_REQUEST_FAILED("GET", TEST_FIXTURES.USERS_PATH, String(errorMessage)),
        );
      });

      it("should throw error when client not initialized", async () => {
        restClient = new RestClient();

        await expect(restClient.get(TEST_FIXTURES.USERS_PATH)).rejects.toThrow(
          TEST_FIXTURES.ERROR_NOT_INITIALIZED,
        );
      });
    });

    /**
     * Tests for POST method
     */
    describe("post", () => {
      it("should make successful POST request", async () => {
        const mockResponse = createMockResponse(TEST_FIXTURES.RESPONSE_DATA);
        vi.mocked(getMockInstance().post).mockResolvedValue(mockResponse);

        const result = await restClient.post(TEST_FIXTURES.USERS_PATH, TEST_FIXTURES.REQUEST_BODY);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          TEST_FIXTURES.USERS_PATH,
          TEST_FIXTURES.REQUEST_BODY,
          undefined,
        );
        expect(result).toEqual(mockResponse);
      });

      it("should throw error for empty URL", async () => {
        await expect(restClient.post("")).rejects.toThrow("REST POST request requires a URL");
      });

      it("should handle POST request errors", async () => {
        const error = new Error("Network Error");
        vi.mocked(getMockInstance().post).mockRejectedValue(error);

        await expect(
          restClient.post(TEST_FIXTURES.USERS_PATH, TEST_FIXTURES.REQUEST_BODY),
        ).rejects.toThrow(`POST request to ${TEST_FIXTURES.USERS_PATH} failed: Network Error`);
      });

      it("should handle POST request non-Error exceptions", async () => {
        vi.mocked(getMockInstance().post).mockRejectedValue(404);

        await expect(
          restClient.post(TEST_FIXTURES.USERS_PATH, TEST_FIXTURES.REQUEST_BODY),
        ).rejects.toThrow(`POST request to ${TEST_FIXTURES.USERS_PATH} failed: 404`);
      });
    });

    /**
     * Tests for PUT method
     */
    describe("put", () => {
      it("should make successful PUT request", async () => {
        const mockResponse = createMockResponse(TEST_FIXTURES.RESPONSE_DATA);
        vi.mocked(getMockInstance().put).mockResolvedValue(mockResponse);

        const result = await restClient.put(
          TEST_FIXTURES.USER_BY_ID_PATH,
          TEST_FIXTURES.REQUEST_BODY,
        );

        expect(mockAxiosInstance.put).toHaveBeenCalledWith(
          TEST_FIXTURES.USER_BY_ID_PATH,
          TEST_FIXTURES.REQUEST_BODY,
          undefined,
        );
        expect(result).toEqual(mockResponse);
      });

      it("should throw error for empty URL", async () => {
        await expect(restClient.put("")).rejects.toThrow("REST PUT request requires a URL");
      });

      it("should handle PUT request errors", async () => {
        const error = new Error("Network Error");
        vi.mocked(getMockInstance().put).mockRejectedValue(error);

        await expect(
          restClient.put(TEST_FIXTURES.USER_BY_ID_PATH, TEST_FIXTURES.REQUEST_BODY),
        ).rejects.toThrow(`PUT request to ${TEST_FIXTURES.USER_BY_ID_PATH} failed: Network Error`);
      });

      it("should handle PUT request non-Error exceptions", async () => {
        vi.mocked(getMockInstance().put).mockRejectedValue("Server Error 500");

        await expect(
          restClient.put(TEST_FIXTURES.USER_BY_ID_PATH, TEST_FIXTURES.REQUEST_BODY),
        ).rejects.toThrow(
          `PUT request to ${TEST_FIXTURES.USER_BY_ID_PATH} failed: Server Error 500`,
        );
      });
    });

    /**
     * Tests for PATCH method
     */
    describe("patch", () => {
      it("should make successful PATCH request", async () => {
        const mockResponse = createMockResponse(TEST_FIXTURES.RESPONSE_DATA);
        vi.mocked(getMockInstance().patch).mockResolvedValue(mockResponse);

        const result = await restClient.patch(
          TEST_FIXTURES.USER_BY_ID_PATH,
          TEST_FIXTURES.REQUEST_BODY,
        );

        expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
          TEST_FIXTURES.USER_BY_ID_PATH,
          TEST_FIXTURES.REQUEST_BODY,
          undefined,
        );
        expect(result).toEqual(mockResponse);
      });

      it("should throw error for empty URL", async () => {
        await expect(restClient.patch("")).rejects.toThrow("REST PATCH request requires a URL");
      });

      it("should handle PATCH request errors", async () => {
        const error = new Error("Network Error");
        vi.mocked(getMockInstance().patch).mockRejectedValue(error);

        await expect(
          restClient.patch(TEST_FIXTURES.USER_BY_ID_PATH, TEST_FIXTURES.REQUEST_BODY),
        ).rejects.toThrow(
          `PATCH request to ${TEST_FIXTURES.USER_BY_ID_PATH} failed: Network Error`,
        );
      });

      it("should handle PATCH request non-Error exceptions", async () => {
        vi.mocked(getMockInstance().patch).mockRejectedValue(null);

        await expect(
          restClient.patch(TEST_FIXTURES.USER_BY_ID_PATH, TEST_FIXTURES.REQUEST_BODY),
        ).rejects.toThrow(`PATCH request to ${TEST_FIXTURES.USER_BY_ID_PATH} failed: null`);
      });
    });

    /**
     * Tests for DELETE method
     */
    describe("delete", () => {
      it("should make successful DELETE request", async () => {
        const mockResponse = createMockResponse({ success: true });
        vi.mocked(getMockInstance().delete).mockResolvedValue(mockResponse);

        const result = await restClient.delete(TEST_FIXTURES.USER_BY_ID_PATH);

        expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
          TEST_FIXTURES.USER_BY_ID_PATH,
          undefined,
        );
        expect(result).toEqual(mockResponse);
      });

      it("should throw error for empty URL", async () => {
        await expect(restClient.delete("")).rejects.toThrow("REST DELETE request requires a URL");
      });

      it("should handle DELETE request errors", async () => {
        const error = new Error("Network Error");
        vi.mocked(getMockInstance().delete).mockRejectedValue(error);

        await expect(restClient.delete(TEST_FIXTURES.USER_BY_ID_PATH)).rejects.toThrow(
          `DELETE request to ${TEST_FIXTURES.USER_BY_ID_PATH} failed: Network Error`,
        );
      });

      it("should handle DELETE request non-Error exceptions", async () => {
        vi.mocked(getMockInstance().delete).mockRejectedValue(true);

        await expect(restClient.delete(TEST_FIXTURES.USER_BY_ID_PATH)).rejects.toThrow(
          `DELETE request to ${TEST_FIXTURES.USER_BY_ID_PATH} failed: true`,
        );
      });
    });
  });

  /**
   * Tests for cleanupClient
   */
  describe("cleanupClient", () => {
    beforeEach(async () => {
      restClient = new RestClient(TEST_FIXTURES.CLIENT_ID, { baseURL: TEST_FIXTURES.BASE_URL });
      await restClient.init();
    });

    it("should cleanup client resources", async () => {
      expect(restClient.isInitialized()).toBe(true);

      await restClient.cleanupClient();

      // After cleanup, subsequent operations should fail
      await expect(restClient.get(TEST_FIXTURES.USERS_PATH)).rejects.toThrow();
    });

    it("should handle cleanup when client is already null", async () => {
      await restClient.cleanupClient();

      // Should not throw error when called multiple times
      await expect(restClient.cleanupClient()).resolves.not.toThrow();
    });
  });
});
