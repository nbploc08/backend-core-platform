import { DynamicModule, Global, Module } from '@nestjs/common';
import { NatsService } from './nats.service';
import { NATS_MODULE_OPTIONS } from './nats.constants';
import { NatsModuleOptions } from './nats.interfaces';

@Global()
@Module({})
export class NatsModule {
  static forRoot(options: NatsModuleOptions): DynamicModule {
    return {
      module: NatsModule,
      global: true,
      providers: [
        {
          provide: NATS_MODULE_OPTIONS,
          useValue: options,
        },
        NatsService,
      ],
      exports: [NatsService],
    };
  }
}
