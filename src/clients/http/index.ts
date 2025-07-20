/**
 * HTTP Service Clients Module
 *
 * This barrel file exports all HTTP service client implementations and interfaces
 * for easy consumption in other parts of the application. It provides a centralized
 * access point for all HTTP client functionality, including the REST client.
 */

export { RestClient, type RestServiceClient } from "./rest";
