/**
 * MQTT client for message broker operations
 *
 * Provides functionality to connect to an MQTT broker, publish messages,
 * subscribe to topics, and receive messages asynchronously.
 */
import mqtt, {
  type IClientOptions,
  type IClientPublishOptions,
  type IClientSubscribeOptions,
  type MqttClient as MqttClientLib,
} from "mqtt";
import { BaseServiceClient } from "../core/base-client";
import type { ServiceClient } from "../core/interfaces";

/**
 * Interface for MQTT client operations
 *
 * Defines the contract for MQTT clients with methods to publish messages,
 * subscribe to topics, and receive messages.
 */
export interface MqttServiceClient extends ServiceClient {
  /**
   * Publish a message to an MQTT topic
   *
   * @param topic - The topic to publish to
   * @param message - The message content as string or Buffer
   * @param options - Optional publishing options
   * @throws Error if publishing fails or client is not initialized
   */
  publish(topic: string, message: string | Buffer, options?: IClientPublishOptions): Promise<void>;

  /**
   * Subscribe to one or more MQTT topics
   *
   * @param topic - The topic or array of topics to subscribe to
   * @param options - Optional subscription options
   * @throws Error if subscription fails or client is not initialized
   */
  subscribe(topic: string | string[], options?: IClientSubscribeOptions): Promise<void>;

  /**
   * Unsubscribe from one or more MQTT topics
   *
   * @param topic - The topic or array of topics to unsubscribe from
   * @throws Error if unsubscription fails or client is not initialized
   */
  unsubscribe(topic: string | string[]): Promise<void>;

  /**
   * Wait for a message on a specific topic
   *
   * @param topic - The topic to listen for messages on
   * @param timeoutMs - Optional timeout in milliseconds (default: 30000)
   * @returns The message received as string, or null if timed out
   * @throws Error if client is not initialized
   */
  waitForMessage(topic: string, timeoutMs?: number): Promise<string | null>;
}

/**
 * MQTT client implementation for message broker operations
 *
 * Implements the MqttServiceClient interface for connecting to and interacting
 * with MQTT message brokers. Supports publishing, subscribing, and asynchronous
 * message processing.
 */
export class MqttClient extends BaseServiceClient implements MqttServiceClient {
  private client: MqttClientLib | null = null;
  private brokerUrl = "";
  private clientId = "";
  private messageCallbacks = new Map<string, ((message: string | Buffer) => void)[]>();

  /**
   * Create a new MQTT client
   *
   * @param clientId - Client identifier (defaults to "MqttClient")
   * @param config - Optional client configuration with properties:
   *   - url: MQTT broker URL (default: "mqtt://localhost:1883")
   *   - clientId: Specific client ID for MQTT broker connection
   *   - username: Optional username for authentication
   *   - password: Optional password for authentication
   */
  constructor(clientId = "MqttClient", config?: Record<string, unknown>) {
    super(clientId, config);
  }

  /**
   * Initialize the MQTT client with the broker connection
   *
   * @throws Error if the broker URL is not provided or connection fails
   */
  protected async initializeClient(): Promise<void> {
    try {
      // Get configuration parameters with defaults
      this.brokerUrl = this.getConfig<string>("url", "mqtt://localhost:1883");
      if (!this.brokerUrl) {
        throw new Error("MQTT client requires a broker URL");
      }

      this.clientId = this.getConfig<string>(
        "clientId",
        `mqtt-client-${Math.random().toString(16).slice(2, 8)}`,
      );

      // Get optional username and password from config
      const username = this.getConfig<string>("username", "");
      const password = this.getConfig<string>("password", "");

      // Create MQTT connection options
      const options: IClientOptions = {
        clientId: this.clientId || `smoker-${Date.now()}`,
        username: username || undefined,
        password: password || undefined,
        reconnectPeriod: 5000, // Auto reconnect every 5 seconds
      };

      // Connect to the MQTT broker with timeout handling
      try {
        this.client = await Promise.race([
          // Connect to the broker
          new Promise<MqttClientLib>((resolve, reject) => {
            const client = mqtt.connect(this.brokerUrl, options);

            // Listen for connection events
            client.on("connect", () => {
              resolve(client);
            });

            client.on("error", (err) => {
              reject(new Error(`MQTT connection error: ${err.message}`));
            });
          }),

          // Timeout after 10 seconds
          new Promise<MqttClientLib>((_, reject) => {
            setTimeout(() => {
              reject(new Error("MQTT connection timeout after 10 seconds"));
            }, 10000);
          }),
        ]);

        // Set up message handling
        this.client.on("message", (topic, message) => {
          const callbacks = this.messageCallbacks.get(topic);
          if (callbacks) {
            // Notify all registered callbacks
            callbacks.forEach((callback) => {
              callback(message);
            });
          }
        });
      } catch (error) {
        throw new Error(
          `Failed to connect to MQTT broker at ${this.brokerUrl}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to initialize MQTT client: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Publish a message to an MQTT topic
   *
   * @param topic - The topic to publish to
   * @param message - The message content as string or Buffer
   * @param options - Optional publishing options
   * @returns Promise that resolves when the message is published
   * @throws Error if publishing fails or client is not initialized
   */
  async publish(
    topic: string,
    message: string | Buffer,
    options?: IClientPublishOptions,
  ): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!topic) {
      throw new Error("MQTT publish requires a topic");
    }

    // TypeScript needs a local variable to recognize client is not null
    const client = this.client;

    // Publish with timeout handling
    return Promise.race([
      // Publish normally
      new Promise<void>((resolve, reject) => {
        client.publish(topic, message, options || {}, (error) => {
          if (error) {
            reject(new Error(`Failed to publish message to ${topic}: ${error.message}`));
          } else {
            resolve();
          }
        });
      }),

      // Timeout after 10 seconds
      new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Publish to ${topic} timeout after 10 seconds`));
        }, 10000);
      }),
    ]);
  }

  /**
   * Subscribe to one or more MQTT topics
   *
   * @param topic - The topic or array of topics to subscribe to
   * @param options - Optional subscription options
   * @returns Promise that resolves when subscription is complete
   * @throws Error if subscription fails or client is not initialized
   */
  async subscribe(topic: string | string[], options?: IClientSubscribeOptions): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    if (!topic || (Array.isArray(topic) && topic.length === 0)) {
      throw new Error("MQTT subscribe requires at least one topic");
    }

    // TypeScript needs a local variable to recognize client is not null
    const client = this.client;

    // Subscribe with timeout handling
    return Promise.race([
      // Subscribe normally
      new Promise<void>((resolve, reject) => {
        client.subscribe(topic, options || {}, (error) => {
          if (error) {
            reject(
              new Error(
                `Failed to subscribe to ${
                  Array.isArray(topic) ? topic.join(", ") : topic
                }: ${error.message}`,
              ),
            );
          } else {
            resolve();
          }
        });
      }),

      // Timeout after 10 seconds
      new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Subscribe to ${
                Array.isArray(topic) ? topic.join(", ") : topic
              } timeout after 10 seconds`,
            ),
          );
        }, 10000);
      }),
    ]);
  }

  /**
   * Unsubscribe from a topic or topics
   * @param topic The topic or topics to unsubscribe from
   */
  async unsubscribe(topic: string | string[]): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    // TypeScript needs a local variable to recognize client is not null
    const client = this.client;

    return new Promise<void>((resolve, reject) => {
      client.unsubscribe(topic, (err) => {
        if (err) {
          reject(new Error(`Failed to unsubscribe from ${topic}: ${err}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Wait for a message on a specific topic
   *
   * @param topic - The topic to listen for messages on
   * @param timeoutMs - Optional timeout in milliseconds (default: 30000)
   * @returns Promise that resolves with the received message as string, or null if timed out
   * @throws Error if client is not initialized or subscription fails
   */
  async waitForMessage(topic: string, timeoutMs = 30000): Promise<string | null> {
    this.ensureInitialized();

    if (!topic) {
      throw new Error("Topic is required for waitForMessage");
    }

    try {
      // Subscribe to the topic if not already subscribed
      await this.subscribe(topic);

      return new Promise<string | null>((resolve) => {
        // Create a callback to handle the message
        const onMessage = (message: string | Buffer) => {
          // Remove the callback to avoid memory leaks
          this.removeCallback(topic, onMessage);

          // Resolve with the message, ensuring it's converted to string if it's a Buffer
          if (Buffer.isBuffer(message)) {
            resolve(message.toString());
          } else {
            resolve(message);
          }
        };

        // Register the callback
        const callbacks = this.messageCallbacks.get(topic) || [];
        callbacks.push(onMessage);
        this.messageCallbacks.set(topic, callbacks);

        // Set up a timeout
        setTimeout(() => {
          // Remove the callback to avoid memory leaks
          this.removeCallback(topic, onMessage);

          // Resolve with null to indicate timeout
          resolve(null);
        }, timeoutMs);
      });
    } catch (error) {
      throw new Error(
        `Error waiting for message on topic ${topic}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Helper method to remove a callback from a topic
   *
   * @param topic - The topic to remove the callback from
   * @param callback - The callback function to remove
   */
  private removeCallback(topic: string, callback: (message: string | Buffer) => void): void {
    const callbacks = this.messageCallbacks.get(topic) || [];
    const index = callbacks.indexOf(callback);

    if (index !== -1) {
      callbacks.splice(index, 1);
      if (callbacks.length === 0) {
        this.messageCallbacks.delete(topic);
      } else {
        this.messageCallbacks.set(topic, callbacks);
      }
    }
  }

  /**
   * Client-specific cleanup logic
   * Disconnects from the MQTT broker and clears message callbacks
   *
   * @returns Promise that resolves when cleanup is complete
   */
  public async cleanupClient(): Promise<void> {
    if (this.client) {
      try {
        // Using end() method from mqtt client to disconnect with a timeout
        await Promise.race([
          new Promise<void>((resolve) => {
            if (this.client) {
              this.client.end(false, {}, () => {
                resolve();
              });
            } else {
              resolve();
            }
          }),
          // Timeout after 5 seconds to prevent hanging
          new Promise<void>((resolve) => setTimeout(resolve, 5000)),
        ]);
      } catch (error) {
        // Log warning but don't fail - this is cleanup code
        console.warn(
          `Error disconnecting MQTT client: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        // Always clean up resources even if disconnect fails
        this.client = null;
        this.messageCallbacks.clear();
      }
    }
  }
}
