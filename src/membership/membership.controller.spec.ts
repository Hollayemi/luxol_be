import { Test, TestingModule } from '@nestjs/testing';
import { MembershipController } from './membership.controller.js';
import { MembershipService } from './membership.service.js';

describe('MembershipController', () => {
  let controller: MembershipController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MembershipController],
      providers: [MembershipService],
    }).compile();

    controller = module.get<MembershipController>(MembershipController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
