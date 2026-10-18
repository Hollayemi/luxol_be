import { PartialType } from '@nestjs/mapped-types';
import { CreateMeatBoxDto } from './create-meat-box.dto.js';

export class UpdateMeatBoxDto extends PartialType(CreateMeatBoxDto) {}
