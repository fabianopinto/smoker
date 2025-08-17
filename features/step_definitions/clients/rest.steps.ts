/**
 * REST BDD Step Definitions
 *
 * Purpose: Provide minimal, reusable Cucumber steps for configuring REST clients,
 * performing HTTP requests (GET/POST/PUT/PATCH/DELETE) with optional headers/body,
 * and asserting on response status, headers, and body.
 *
 * Coverage:
 * - Given: create/configure REST client via DataTable
 * - When: send requests with/without headers and body
 * - Then: validate status code, body fragments, and headers
 *
 * Notes:
 * - All parameters (strings, DataTables, doc strings) are resolved via SmokeWorld
 *   to support config/property references.
 * - Last response artifacts are stored in world properties for later steps.
 */

import { DataTable, Given, Then, When } from "@cucumber/cucumber";
import { type AxiosResponse } from "axios";
import { ClientType } from "../../../src/clients/core";
import { type RestServiceClient } from "../../../src/clients/http";
import { ERR_VALIDATION, SmokerError } from "../../../src/errors";
import {
  normalizeHeaders,
  parseJsonDoc,
  resolveAndBuildUrl,
  resolveDeepWithWorld,
  tableToRecord,
} from "../../../src/lib";
import { clientKey, type SmokeWorld } from "../../../src/world/world";

// Configure a REST client from a DataTable (base URL, headers, auth)
Given(
  "a REST client {string} configured as:",
  async function (this: SmokeWorld, id: string, table: DataTable) {
    const configRaw = tableToRecord(table);
    const config = (await resolveDeepWithWorld(this, configRaw)) as Record<string, unknown>;
    const client = this.registerClientWithConfig(ClientType.REST, config, id) as RestServiceClient;
    await client.init();
  },
);

// Send simple GET/DELETE requests without headers/body
When(
  "I send a {word} request with REST client {string} to {string}",
  async function (this: SmokeWorld, method: string, id: string, path: string) {
    const key = clientKey(ClientType.REST, id);
    const client = this.getClient<RestServiceClient>(key);
    const url = await resolveAndBuildUrl(this, "", path);
    const response = await (async () => {
      switch (method.toUpperCase()) {
        case "GET":
          return client.get(url);
        case "DELETE":
          return client.delete(url);
        default:
          throw new SmokerError("Unsupported REST method for simple request", {
            code: ERR_VALIDATION,
            domain: "steps",
            details: { component: "rest.steps", method },
            retryable: false,
          });
      }
    })();
    this.setProperty("rest:lastResponse", response);
    this.setProperty("rest:lastStatus", response.status);
    this.setProperty("rest:lastBody", response.data);
    this.setProperty("rest:lastHeaders", response.headers);
  },
);

// Send GET/DELETE with custom headers only
When(
  "I send a {word} request with REST client {string} to {string} with headers:",
  async function (this: SmokeWorld, method: string, id: string, path: string, table: DataTable) {
    const key = clientKey(ClientType.REST, id);
    const client = this.getClient<RestServiceClient>(key);
    const url = await resolveAndBuildUrl(this, "", path);
    const headersRaw = tableToRecord(table);
    const resolvedHeaders = (await resolveDeepWithWorld(this, headersRaw)) as Record<
      string,
      unknown
    >;
    const headers = normalizeHeaders(resolvedHeaders);
    let response: AxiosResponse;
    switch (method.toUpperCase()) {
      case "GET":
        response = await client.get(url, { headers });
        break;
      case "DELETE":
        response = await client.delete(url, { headers });
        break;
      default:
        throw new SmokerError("Unsupported REST method for headers-only request", {
          code: ERR_VALIDATION,
          domain: "steps",
          details: { component: "rest.steps", method },
          retryable: false,
        });
    }
    this.setProperty("rest:lastResponse", response);
    this.setProperty("rest:lastStatus", response.status);
    this.setProperty("rest:lastBody", response.data);
    this.setProperty("rest:lastHeaders", response.headers);
  },
);

// Send POST/PUT/PATCH with a JSON body
When(
  "I send a {word} request with REST client {string} to {string} with body:",
  async function (this: SmokeWorld, method: string, id: string, path: string, body: string) {
    const key = clientKey(ClientType.REST, id);
    const client = this.getClient<RestServiceClient>(key);
    const url = await resolveAndBuildUrl(this, "", path);
    const data = await resolveDeepWithWorld(this, parseJsonDoc(body));
    let response: AxiosResponse;
    switch (method.toUpperCase()) {
      case "POST":
        response = await client.post(url, data);
        break;
      case "PUT":
        response = await client.put(url, data);
        break;
      case "PATCH":
        response = await client.patch(url, data);
        break;
      default:
        throw new SmokerError("Unsupported REST method for body request", {
          code: ERR_VALIDATION,
          domain: "steps",
          details: { component: "rest.steps", method },
          retryable: false,
        });
    }
    this.setProperty("rest:lastResponse", response);
    this.setProperty("rest:lastStatus", response.status);
    this.setProperty("rest:lastBody", response.data);
    this.setProperty("rest:lastHeaders", response.headers);
  },
);

// Send POST/PUT/PATCH with headers and a JSON body
When(
  "I send a {word} request with REST client {string} to {string} with headers and body:",
  async function (
    this: SmokeWorld,
    method: string,
    id: string,
    path: string,
    table: DataTable,
    body: string,
  ) {
    const key = clientKey(ClientType.REST, id);
    const client = this.getClient<RestServiceClient>(key);
    const url = await resolveAndBuildUrl(this, "", path);
    const headersRaw = tableToRecord(table);
    const resolvedHeaders = (await resolveDeepWithWorld(this, headersRaw)) as Record<
      string,
      unknown
    >;
    const headers = normalizeHeaders(resolvedHeaders);
    const data = await resolveDeepWithWorld(this, parseJsonDoc(body));
    let response: AxiosResponse;
    switch (method.toUpperCase()) {
      case "POST":
        response = await client.post(url, data, { headers });
        break;
      case "PUT":
        response = await client.put(url, data, { headers });
        break;
      case "PATCH":
        response = await client.patch(url, data, { headers });
        break;
      default:
        throw new SmokerError("Unsupported REST method for headers+body request", {
          code: ERR_VALIDATION,
          domain: "steps",
          details: { component: "rest.steps", method },
          retryable: false,
        });
    }
    this.setProperty("rest:lastResponse", response);
    this.setProperty("rest:lastStatus", response.status);
    this.setProperty("rest:lastBody", response.data);
    this.setProperty("rest:lastHeaders", response.headers);
  },
);

// Send a request with the given REST client, base URL, path, and optional query parameters
When(
  "I send a {word} request with REST client {string} base {string} path {string}",
  async function (this: SmokeWorld, method: string, id: string, base: string, path: string) {
    const key = clientKey(ClientType.REST, id);
    const client = this.getClient<RestServiceClient>(key);
    const url = await resolveAndBuildUrl(this, base, path);
    const response = await (async () => {
      switch (method.toUpperCase()) {
        case "GET":
          return client.get(url);
        case "DELETE":
          return client.delete(url);
        default:
          throw new SmokerError("Unsupported REST method for simple request", {
            code: ERR_VALIDATION,
            domain: "steps",
            details: { component: "rest.steps", method },
            retryable: false,
          });
      }
    })();
    this.setProperty("rest:lastResponse", response);
    this.setProperty("rest:lastStatus", response.status);
    this.setProperty("rest:lastBody", response.data);
    this.setProperty("rest:lastHeaders", response.headers);
  },
);

// Send GET/DELETE with base + path + query params
When(
  "I send a {word} request with REST client {string} base {string} path {string} with query:",
  async function (
    this: SmokeWorld,
    method: string,
    id: string,
    base: string,
    path: string,
    table: DataTable,
  ) {
    const key = clientKey(ClientType.REST, id);
    const client = this.getClient<RestServiceClient>(key);
    const queryRaw = tableToRecord(table);
    const query = (await resolveDeepWithWorld(this, queryRaw)) as Record<string, unknown>;
    const url = await resolveAndBuildUrl(this, base, path, query);
    const response = await (async () => {
      switch (method.toUpperCase()) {
        case "GET":
          return client.get(url);
        case "DELETE":
          return client.delete(url);
        default:
          throw new SmokerError("Unsupported REST method for query-only request", {
            code: ERR_VALIDATION,
            domain: "steps",
            details: { component: "rest.steps", method },
            retryable: false,
          });
      }
    })();
    this.setProperty("rest:lastResponse", response);
    this.setProperty("rest:lastStatus", response.status);
    this.setProperty("rest:lastBody", response.data);
    this.setProperty("rest:lastHeaders", response.headers);
  },
);

// Send GET/DELETE with base + path + headers + query
When(
  "I send a {word} request with REST client {string} base {string} path {string} with headers and query:",
  async function (
    this: SmokeWorld,
    method: string,
    id: string,
    base: string,
    path: string,
    headersTable: DataTable,
    queryTable: DataTable,
  ) {
    const key = clientKey(ClientType.REST, id);
    const client = this.getClient<RestServiceClient>(key);
    const headersRaw = tableToRecord(headersTable);
    const resolvedHeaders = (await resolveDeepWithWorld(this, headersRaw)) as Record<
      string,
      unknown
    >;
    const headers = normalizeHeaders(resolvedHeaders);
    const queryRaw = tableToRecord(queryTable);
    const query = (await resolveDeepWithWorld(this, queryRaw)) as Record<string, unknown>;
    const url = await resolveAndBuildUrl(this, base, path, query);
    let response: AxiosResponse;
    switch (method.toUpperCase()) {
      case "GET":
        response = await client.get(url, { headers });
        break;
      case "DELETE":
        response = await client.delete(url, { headers });
        break;
      default:
        throw new SmokerError("Unsupported REST method for headers+query request", {
          code: ERR_VALIDATION,
          domain: "steps",
          details: { component: "rest.steps", method },
          retryable: false,
        });
    }
    this.setProperty("rest:lastResponse", response);
    this.setProperty("rest:lastStatus", response.status);
    this.setProperty("rest:lastBody", response.data);
    this.setProperty("rest:lastHeaders", response.headers);
  },
);

// Send POST/PUT/PATCH with base + path + headers + query + body
When(
  "I send a {word} request with REST client {string} base {string} path {string} with headers, query and body:",
  async function (
    this: SmokeWorld,
    method: string,
    id: string,
    base: string,
    path: string,
    headersTable: DataTable,
    queryTable: DataTable,
    body: string,
  ) {
    const key = clientKey(ClientType.REST, id);
    const client = this.getClient<RestServiceClient>(key);
    const headersRaw = tableToRecord(headersTable);
    const resolvedHeaders = (await resolveDeepWithWorld(this, headersRaw)) as Record<
      string,
      unknown
    >;
    const headers = normalizeHeaders(resolvedHeaders);
    const queryRaw = tableToRecord(queryTable);
    const query = (await resolveDeepWithWorld(this, queryRaw)) as Record<string, unknown>;
    const url = await resolveAndBuildUrl(this, base, path, query);
    const data = await resolveDeepWithWorld(this, parseJsonDoc(body));
    let response: AxiosResponse;
    switch (method.toUpperCase()) {
      case "POST":
        response = await client.post(url, data, { headers });
        break;
      case "PUT":
        response = await client.put(url, data, { headers });
        break;
      case "PATCH":
        response = await client.patch(url, data, { headers });
        break;
      default:
        throw new SmokerError("Unsupported REST method for headers+query+body request", {
          code: ERR_VALIDATION,
          domain: "steps",
          details: { component: "rest.steps", method },
          retryable: false,
        });
    }
    this.setProperty("rest:lastResponse", response);
    this.setProperty("rest:lastStatus", response.status);
    this.setProperty("rest:lastBody", response.data);
    this.setProperty("rest:lastHeaders", response.headers);
  },
);

// Assert the last response status code
Then("the REST response status should be {int}", function (this: SmokeWorld, status: number) {
  const current = this.getProperty<number>("rest:lastStatus");
  if (current !== status) {
    throw new SmokerError("Unexpected REST status", {
      code: ERR_VALIDATION,
      domain: "steps",
      details: { component: "rest.steps", expected: status, actual: current },
      retryable: false,
    });
  }
});

// Assert the last response body contains a string fragment
Then(
  "the REST response body should contain {string}",
  async function (this: SmokeWorld, fragment: string) {
    const body = this.getProperty<unknown>("rest:lastBody");
    const frag = (await resolveDeepWithWorld(this, fragment)) as string;
    const content = typeof body === "string" ? body : JSON.stringify(body);
    if (!content.includes(frag)) {
      throw new SmokerError("REST response body missing fragment", {
        code: ERR_VALIDATION,
        domain: "steps",
        details: { component: "rest.steps", fragment: frag },
        retryable: false,
      });
    }
  },
);

// Assert a specific response header equals expected
Then(
  "the REST response header {string} should be {string}",
  async function (this: SmokeWorld, name: string, value: string) {
    const headers = this.getProperty<Record<string, string | string[]>>("rest:lastHeaders") || {};
    const expected = (await resolveDeepWithWorld(this, value)) as string;
    const headerValue = headers[name.toLowerCase()] ?? headers[name];
    const asString = Array.isArray(headerValue) ? headerValue.join(",") : String(headerValue);
    if (asString !== expected) {
      throw new SmokerError("REST response header mismatch", {
        code: ERR_VALIDATION,
        domain: "steps",
        details: { component: "rest.steps", header: name, expected, actual: asString },
        retryable: false,
      });
    }
  },
);
