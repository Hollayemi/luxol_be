import { PartialType } from '@nestjs/mapped-types';
import { CreatePromotionDto } from './create-promotions.dto.js';

export class UpdatePromotionDto extends PartialType(CreatePromotionDto) { }
