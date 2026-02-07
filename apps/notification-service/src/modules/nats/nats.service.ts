import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { connect, NatsConnection, JetStreamClient, JetStreamManager, RetentionPolicy } from 'nats';
import { logger } from '@common/core';

const STREAMS: { name: string; subjects: string[] }[] = [
  {
    name: 'AUTH_EVENT',
    subjects: ['user.*', 'notification.*'],
  },
  // {
  //   name: 'BOOKING_EVENT',
  //   subjects: ['booking.*'],
  // },
];

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private nc: NatsConnection | null = null;
  private js: JetStreamClient | null = null;
  private jsm: JetStreamManager | null = null;

  async onModuleInit() {
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
    try {
      this.nc = await connect({ servers: natsUrl });
      this.js = this.nc.jetstream();
      this.jsm = await this.nc.jetstreamManager();
      for (const s of STREAMS) {
        await this.ensureStream(s.name, s.subjects);
      }

      logger.info(
        { natsUrl, streams: STREAMS.map((s) => s.name) },
        'Notification-service connected to NATS JetStream',
      );
    } catch (error) {
      logger.warn(
        { error, natsUrl },
        'Failed to connect to NATS - events will not be consumed/published',
      );
    }
  }

  async onModuleDestroy() {
    if (this.nc) {
      await this.nc.drain();
      logger.info('Notification-service disconnected from NATS');
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

  getStreamConfig(name: string) {
    return STREAMS.find((s) => s.name === name);
  }
}
