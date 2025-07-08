import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RestClient } from "../../src/clients/rest";

// Create mock functions outside the mock to be able to access them easily
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();
const mockAxiosInstance = {
  get: mockGet,
  post: mockPost,
  put: mockPut,
  patch: mockPatch,
  delete: mockDelete,
};

// Mock axios
vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
  },
}));

describe("RestClient", () => {
  let client: RestClient;
  beforeEach(() => {
    vi.clearAllMocks();
    client = new RestClient();
    // Reset all mock functions
    mockGet.mockReset();
    mockPost.mockReset();
    mockPut.mockReset();
    mockPatch.mockReset();
    mockDelete.mockReset();
  });

  afterEach(async () => {
    await client.destroy();
  });

  describe("Basic functionality", () => {
    it("should have the correct name", () => {
      expect(client.getName()).toBe("RestClient");
    });

    it("should not be initialized by default", () => {
      expect(client.isInitialized()).toBe(false);
    });

    it("should be initialized after init is called", async () => {
      await client.init();
      expect(client.isInitialized()).toBe(true);
    });

    it("should not be initialized after destroy is called", async () => {
      await client.init();
      expect(client.isInitialized()).toBe(true);
      await client.destroy();
      expect(client.isInitialized()).toBe(false);
    });
  });

  describe("Initialization with config", () => {
    it("should use default configuration when none provided", async () => {
      await client.init();
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: "",
        timeout: 30000,
        headers: {},
      });
    });

    it("should use provided configuration", async () => {
      const config = {
        baseURL: "https://api.example.com",
        timeout: 5000,
        headers: { "X-API-Key": "test-key" },
      };
      await client.init(config);
      expect(axios.create).toHaveBeenCalledWith(config);
    });

    it("should merge provided configuration with defaults", async () => {
      const config = {
        baseURL: "https://api.example.com",
        // timeout not provided, should use default
      };
      await client.init(config);
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: "https://api.example.com",
        timeout: 30000,
        headers: {},
      });
    });
  });

  describe("HTTP methods", () => {
    const testUrl = "/test";
    const testData = { test: "data" };
    const testConfig = { headers: { "Content-Type": "application/json" } };
    const mockResponse = { status: 200, data: { result: "success" } };

    beforeEach(async () => {
      // Setup mock response for all methods
      mockGet.mockResolvedValue(mockResponse);
      mockPost.mockResolvedValue(mockResponse);
      mockPut.mockResolvedValue(mockResponse);
      mockPatch.mockResolvedValue(mockResponse);
      mockDelete.mockResolvedValue(mockResponse);

      await client.init();
    });

    it("should call get with correct parameters", async () => {
      const response = await client.get(testUrl, testConfig);
      expect(mockGet).toHaveBeenCalledWith(testUrl, testConfig);
      expect(response).toBe(mockResponse);
    });

    it("should call post with correct parameters", async () => {
      const response = await client.post(testUrl, testData, testConfig);
      expect(mockPost).toHaveBeenCalledWith(testUrl, testData, testConfig);
      expect(response).toBe(mockResponse);
    });

    it("should call put with correct parameters", async () => {
      const response = await client.put(testUrl, testData, testConfig);
      expect(mockPut).toHaveBeenCalledWith(testUrl, testData, testConfig);
      expect(response).toBe(mockResponse);
    });

    it("should call patch with correct parameters", async () => {
      const response = await client.patch(testUrl, testData, testConfig);
      expect(mockPatch).toHaveBeenCalledWith(testUrl, testData, testConfig);
      expect(response).toBe(mockResponse);
    });

    it("should call delete with correct parameters", async () => {
      const response = await client.delete(testUrl, testConfig);
      expect(mockDelete).toHaveBeenCalledWith(testUrl, testConfig);
      expect(response).toBe(mockResponse);
    });
  });

  describe("Error handling", () => {
    it("should throw error when methods are called before initialization", async () => {
      await expect(client.get("/test")).rejects.toThrow("RestClient is not initialized");
      await expect(client.post("/test")).rejects.toThrow("RestClient is not initialized");
      await expect(client.put("/test")).rejects.toThrow("RestClient is not initialized");
      await expect(client.patch("/test")).rejects.toThrow("RestClient is not initialized");
      await expect(client.delete("/test")).rejects.toThrow("RestClient is not initialized");
    });

    it("should propagate axios errors", async () => {
      await client.init();
      const axiosError = new Error("Network error");
      mockGet.mockRejectedValueOnce(axiosError);

      await expect(client.get("/test")).rejects.toThrow("Network error");
    });
  });

  describe("Edge cases", () => {
    beforeEach(async () => {
      await client.init();
    });

    it("should handle empty URL", async () => {
      await client.get("");
      expect(mockGet).toHaveBeenCalledWith("", undefined);
    });

    it("should handle null data in post requests", async () => {
      await client.post("/test", null);
      expect(mockPost).toHaveBeenCalledWith("/test", null, undefined);
    });

    it("should handle undefined data in put requests", async () => {
      await client.put("/test", undefined);
      expect(mockPut).toHaveBeenCalledWith("/test", undefined, undefined);
    });

    it("should handle multiple initializations", async () => {
      // Already initialized in beforeEach
      await client.init({ baseURL: "https://second-init.com" });

      // Should replace the original config
      expect(axios.create).toHaveBeenCalledTimes(2);
      expect(axios.create).toHaveBeenLastCalledWith({
        baseURL: "https://second-init.com",
        timeout: 30000,
        headers: {},
      });
    });
  });

  describe("Reset functionality", () => {
    it("should not affect initialization state", async () => {
      await client.init();
      expect(client.isInitialized()).toBe(true);

      await client.reset();
      expect(client.isInitialized()).toBe(true);
    });
  });
});
