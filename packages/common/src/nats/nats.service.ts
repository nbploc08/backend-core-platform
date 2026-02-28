import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  connect,
  NatsConnection,
  JetStreamClient,
  JetStreamManager,
  StringCodec,
  RetentionPolicy,
  Subscription,
} from 'nats';
import { logger } from '../logging/logger';
import { NATS_MODULE_OPTIONS } from './nats.constants';
import { NatsModuleOptions, NatsStreamConfig } from './nats.interfaces';

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private nc: NatsConnection | null = null;
  private js: JetStreamClient | null = null;
  private jsm: JetStreamManager | null = null;
  private sc = StringCodec();
  private subscriptions: Subscription[] = [];

  constructor(
    @Inject(NATS_MODULE_OPTIONS) private readonly options: NatsModuleOptions,
  ) {}

  async onModuleInit() {
    const natsUrl = this.options.url || process.env.NATS_URL || 'nats://localhost:4222';

    try {
      this.nc = await connect({ servers: natsUrl });
      this.js = this.nc.jetstream();
      this.jsm = await this.nc.jetstreamManager();

      if (this.options.streams) {
        for (const stream of this.options.streams) {
          await this.ensureStream(stream.name, stream.subjects);
        }
      }

      logger.info(
        {
          natsUrl,
          service: this.options.serviceName,
          streams: this.options.streams?.map((s) => s.name),
        },
        `${this.options.serviceName} connected to NATS JetStream`,
      );
    } catch (error) {
      logger.warn(
        { error, natsUrl, service: this.options.serviceName },
        'Failed to connect to NATS - events will not be published/consumed',
      );
    }
  }

  async onModuleDestroy() {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions = [];

    if (this.nc) {
      await this.nc.drain();
      logger.info({ service: this.options.serviceName }, 'Disconnected from NATS');
    }
  }

  private async ensureStream(name: string, subjects: string[]): Promise<void> {
    if (!this.jsm) return;

    try {
      await this.jsm.streams.info(name);
      logger.debug({ stream: name }, 'JetStream stream exists');
    } catch {
      await this.jsm.streams.add({
        name,
        subjects,
        retention: RetentionPolicy.Limits,
        max_msgs: 100_000,
        max_age: 7 * 24 * 60 * 60 * 1e9,
      });
      logger.info({ stream: name, subjects }, 'JetStream stream created');
    }
  }

  isConnected(): boolean {
    return this.nc !== null && !this.nc.isClosed();
  }

  getConnection(): NatsConnection | null {
    return this.nc;
  }

  getJetStream(): JetStreamClient | null {
    return this.js;
  }

  getJetStreamManager(): JetStreamManager | null {
    return this.jsm;
  }

  getStreamConfig(name: string): NatsStreamConfig | undefined {
    return this.options.streams?.find((s) => s.name === name);
  }

  async publish(subject: string, data: unknown): Promise<void> {
    if (!this.js) {
      logger.warn({ subject }, 'NATS not connected - skipping event publish');
      return;
    }

    try {
      const payload = this.sc.encode(JSON.stringify(data));
      await this.js.publish(subject, payload);
      logger.info({ subject }, 'Event published to NATS JetStream');
    } catch (error) {
      logger.error({ error, subject }, 'Failed to publish event to NATS');
    }
  }

  publishPlain(subject: string, data: unknown): void {
    if (!this.nc) {
      logger.warn({ subject }, 'NATS not connected - skipping plain publish');
      return;
    }

    try {
      const payload = this.sc.encode(JSON.stringify(data));
      this.nc.publish(subject, payload);
      logger.debug({ subject }, 'Plain NATS message published');
    } catch (error) {
      logger.error({ error, subject }, 'Failed to publish plain NATS message');
    }
  }

  subscribePlain<T = unknown>(subject: string, handler: (data: T) => void): Subscription | null {
    if (!this.nc) {
      logger.warn({ subject }, 'NATS not connected - skipping plain subscribe');
      return null;
    }

    const sub = this.nc.subscribe(subject);
    this.subscriptions.push(sub);

    (async () => {
      for await (const msg of sub) {
        try {
          const raw = this.sc.decode(msg.data);
          const data: T = JSON.parse(raw);
          handler(data);
        } catch (error) {
          logger.error({ error, subject }, 'Error handling plain NATS message');
        }
      }
    })();

    logger.debug({ subject }, 'Plain NATS subscription created');
    return sub;
  }
}
