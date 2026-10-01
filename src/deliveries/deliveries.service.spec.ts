import { Test, TestingModule } from '@nestjs/testing';
import { AdminDeliveriesService } from './admin-deliveries.service.js';

describe('DeliveriesService', () => {
  let service: AdminDeliveriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminDeliveriesService],
    }).compile();

    service = module.get<AdminDeliveriesService>(AdminDeliveriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
