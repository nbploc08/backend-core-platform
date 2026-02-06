import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  connect,
  NatsConnection,
  JetStreamClient,
  JetStreamManager,
  StringCodec,
  RetentionPolicy,
} from 'nats';
import { logger } from '@common/core';

const STREAM_NAME = 'AUTH_EVENT';
const STREAM_SUBJECTS = ['user.*', 'notification.*'];

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private nc: NatsConnection | null = null;
  private js: JetStreamClient | null = null;
  private jsm: JetStreamManager | null = null;
  private sc = StringCodec();

  async onModuleInit() {
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';

    try {
      this.nc = await connect({ servers: natsUrl });
      this.js = this.nc.jetstream();
      this.jsm = await this.nc.jetstreamManager();

    
      await this.ensureStream();

      logger.info({ natsUrl }, 'Connected to NATS JetStream');
    } catch (error) {
      logger.warn({ error, natsUrl }, 'Failed to connect to NATS - events will not be published');
    }
  }

  private async ensureStream(): Promise<void> {
    if (!this.jsm) return;

    try {
      await this.jsm.streams.info(STREAM_NAME);
      logger.info({ stream: STREAM_NAME }, 'JetStream stream exists');
    } catch {
      await this.jsm.streams.add({
        name: STREAM_NAME,
        subjects: STREAM_SUBJECTS,
        retention: RetentionPolicy.Limits,
        max_msgs: 100000,
        max_age: 7 * 24 * 60 * 60 * 1e9, // 7 days in nanoseconds
      });
      logger.info({ stream: STREAM_NAME, subjects: STREAM_SUBJECTS }, 'JetStream stream created');
    }
  }

  async onModuleDestroy() {
    if (this.nc) {
      await this.nc.drain();
      logger.info('Disconnected from NATS');
    }
  }


  isConnected(): boolean {
    return this.nc !== null && !this.nc.isClosed();
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
}
