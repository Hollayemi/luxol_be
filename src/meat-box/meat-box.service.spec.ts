import { Test, TestingModule } from '@nestjs/testing';
import { MeatBoxService } from './meat-box.service.js';

describe('MeatBoxService', () => {
  let service: MeatBoxService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MeatBoxService],
    }).compile();

    service = module.get<MeatBoxService>(MeatBoxService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
