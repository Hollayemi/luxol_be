import { Test, TestingModule } from '@nestjs/testing';
import { PromotionController } from './promotion.controller.js';
import { PromotionService } from './promotion.service.js';

describe('PromotionController', () => {
  let controller: PromotionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromotionController],
      providers: [PromotionService],
    }).compile();

    controller = module.get<PromotionController>(PromotionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
