import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { JsMsg, JetStreamClient, JetStreamManager } from 'nats';
import { AckPolicy, DeliverPolicy, ReplayPolicy } from 'nats';
import { logger } from '../logging/logger';
import { ServiceError } from '../errors/service-error';
import { NatsService } from './nats.service';

export type ConsumerConfig = {
  streamName: string;
  durableName: string;
  filterSubject: string;
  handle: (msg: JsMsg) => Promise<void>;
};

export abstract class BaseJetstreamConsumer implements OnModuleInit, OnModuleDestroy {
  private consumeAborted = false;

  constructor(protected readonly natsService: NatsService) {}

  protected abstract getConsumers(): ConsumerConfig[];

  async onModuleInit() {
    const js = this.natsService.getJetStream();
    const jsm = this.natsService.getJetStreamManager();
    if (!js || !jsm) {
      logger.warn('NATS not connected - JetStream consumer will not start');
      return;
    }

    for (const cfg of this.getConsumers()) {
      await this.ensureConsumer(jsm, cfg);
      this.startConsumeLoop(js, cfg);
    }
  }

  async onModuleDestroy() {
    this.consumeAborted = true;
  }

  private async ensureConsumer(jsm: JetStreamManager, cfg: ConsumerConfig) {
    const { streamName, durableName, filterSubject } = cfg;

    const config = {
      durable_name: durableName,
      filter_subject: filterSubject,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      replay_policy: ReplayPolicy.Instant,
      ack_wait: 30_000_000_000,
      max_deliver: 3,
    };

    try {
      await jsm.consumers.info(streamName, durableName);
      logger.debug({ stream: streamName, consumer: durableName }, 'Consumer exists');
    } catch {
      await jsm.consumers.add(streamName, config);
      logger.info({ stream: streamName, consumer: durableName }, 'Consumer created');
    }
  }

  private startConsumeLoop(js: JetStreamClient, cfg: ConsumerConfig) {
    const { streamName, durableName, handle } = cfg;

    (async () => {
      while (!this.consumeAborted) {
        try {
          const consumer = await js.consumers.get(streamName, durableName);
          const messages = await consumer.fetch({ max_messages: 5, expires: 5000 });

          for await (const msg of messages) {
            if (this.consumeAborted) break;
            try {
              await handle(msg);
              msg.ack();
            } catch (err) {
              const formattedError =
                err instanceof ServiceError
                  ? {
                      code: err.code,
                      statusCode: err.statusCode,
                      message: err.message,
                      exposeMessage: err.exposeMessage,
                    }
                  : {
                      message: (err as any)?.message ?? 'Unknown error',
                    };

              logger.error(
                { stream: streamName, consumer: durableName, error: formattedError },
                'Error handling JetStream message',
              );
              msg.nak();
            }
          }
        } catch (err) {
          if (this.consumeAborted) break;
          logger.warn({ stream: streamName, consumer: durableName, err }, 'JetStream fetch error');
        }
      }
    })();
  }
}
