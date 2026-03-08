import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { MailsService } from 'src/modules/mails/mails.service';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { NatsService } from '@common/core';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: MailsService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: NatsService, useValue: {} },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
