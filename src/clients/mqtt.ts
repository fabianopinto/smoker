/**
 * MQTT client for message queue operations
 */
import mqtt, {
  type IClientOptions,
  type IClientPublishOptions,
  type MqttClient as MqttClientLib,
} from "mqtt";
import { BaseServiceClient } from "./clients";

/**
 * Interface for MQTT client operations
 */
export interface MqttServiceClient {
  publish(topic: string, message: string | Buffer, options?: IClientPublishOptions): Promise<void>;
  subscribe(topic: string | string[], options?: mqtt.IClientSubscribeOptions): Promise<void>;
  unsubscribe(topic: string | string[]): Promise<void>;
  waitForMessage(topic: string, timeoutMs?: number): Promise<string | Buffer | null>;
}

/**
 * MQTT client implementation for message queue operations
 */
export class MqttClient extends BaseServiceClient implements MqttServiceClient {
  private client: MqttClientLib | null = null;
  private brokerUrl = "";
  private clientId = "";
  private messageCallbacks = new Map<string, ((message: string | Buffer) => void)[]>();

  /**
   * Create a new MQTT client
   */
  constructor() {
    super("MqttClient");
  }

  /**
   * Initialize the MQTT client with configuration
   */
  protected async initializeClient(): Promise<void> {
    this.brokerUrl = this.getConfig<string>("url", "mqtt://localhost:1883");
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
      clean: true,
      reconnectPeriod: 1000,
    };

    // Connect to broker
    this.client = mqtt.connect(this.brokerUrl, options);

    if (this.client) {
      // Set up message handling
      this.client.on("message", (topic: string, message: Buffer) => {
        const callbacks = this.messageCallbacks.get(topic) || [];
        for (const callback of callbacks) {
          callback(message.toString());
        }
      });
    }

    // Wait for connection or error
    return new Promise<void>((resolve, reject) => {
      if (!this.client) {
        reject(new Error("MQTT client not initialized"));
        return;
      }

      this.client.once("connect", () => {
        resolve();
      });

      this.client.once("error", (err: Error) => {
        reject(new Error(`MQTT connection failed: ${err}`));
      });
    });
  }

  /**
   * Publish a message to a topic
   * @param topic The topic to publish to
   * @param message The message to publish
   * @param options Optional publish options
   */
  async publish(topic: string, message: string, options?: IClientPublishOptions): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    // TypeScript needs a local variable to recognize client is not null
    const client = this.client;

    return new Promise<void>((resolve, reject) => {
      client.publish(topic, message, options || {}, (err) => {
        if (err) {
          reject(new Error(`Failed to publish to ${topic}: ${err}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Subscribe to a topic or topics
   * @param topic The topic or topics to subscribe to
   * @param options Optional subscribe options
   */
  async subscribe(topic: string | string[], options?: mqtt.IClientSubscribeOptions): Promise<void> {
    this.ensureInitialized();
    this.assertNotNull(this.client);

    // TypeScript needs a local variable to recognize client is not null
    const client = this.client;

    return new Promise<void>((resolve, reject) => {
      client.subscribe(topic, options || {}, (err) => {
        if (err) {
          reject(new Error(`Failed to subscribe to ${topic}: ${err}`));
        } else {
          resolve();
        }
      });
    });
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
   * @param topic The topic to wait for a message on
   * @param timeoutMs Timeout in milliseconds (default: 30000)
   * @returns The message received, or null if timed out
   */
  async waitForMessage(topic: string, timeoutMs = 30000): Promise<string | null> {
    this.ensureInitialized();

    // Subscribe to the topic if not already subscribed
    await this.subscribe(topic);

    return new Promise((resolve) => {
      // Create a callback to handle the message
      const onMessage = (message: string | Buffer) => {
        // Remove the callback
        const callbacks = this.messageCallbacks.get(topic) || [];
        const index = callbacks.indexOf(onMessage);
        if (index !== -1) {
          callbacks.splice(index, 1);
          if (callbacks.length === 0) {
            this.messageCallbacks.delete(topic);
          } else {
            this.messageCallbacks.set(topic, callbacks);
          }
        }

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
        // Remove the callback
        const callbacks = this.messageCallbacks.get(topic) || [];
        const index = callbacks.indexOf(onMessage);
        if (index !== -1) {
          callbacks.splice(index, 1);
          if (callbacks.length === 0) {
            this.messageCallbacks.delete(topic);
          } else {
            this.messageCallbacks.set(topic, callbacks);
          }
        }

        // Resolve with null to indicate timeout
        resolve(null);
      }, timeoutMs);
    });
  }

  /**
   * Client-specific destroy logic
   */
  protected async destroyClient(): Promise<void> {
    if (this.client) {
      try {
        // Using end() method from mqtt client to disconnect
        await new Promise<void>((resolve) => {
          if (this.client) {
            this.client.end(false, {}, () => {
              resolve();
            });
          } else {
            resolve();
          }
        });
      } catch (error) {
        console.warn(
          `Error disconnecting MQTT client: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        this.client = null;
        this.messageCallbacks.clear();
      }
    }
  }
}
