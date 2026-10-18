import { Test, TestingModule } from '@nestjs/testing';
import { MeatBoxController } from './meat-box.controller.js';
import { MeatBoxService } from './meat-box.service.js';

describe('MeatBoxController', () => {
  let controller: MeatBoxController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeatBoxController],
      providers: [MeatBoxService],
    }).compile();

    controller = module.get<MeatBoxController>(MeatBoxController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
