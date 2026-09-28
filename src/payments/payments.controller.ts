import { Controller, Get, Query, Redirect, Res } from '@nestjs/common';
import { PaystackService } from './paystack.service.js';
import { InitializedDto } from './dto/initialized.dto.js';
import type { Response } from 'express';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly ps: PaystackService) { }

  @Get('verify')
  @Redirect()
  async verify(
    @Query() reference: InitializedDto,
    @Res() res: Response,
  ): Promise<any> {
    const result =  await this.ps.confirmPayment(reference.reference);
    console.log(result)
    return res.redirect(302, result);
  }
}
