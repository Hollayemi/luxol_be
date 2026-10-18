import { IsOptional, IsString } from "class-validator"

export class InitializedDto {

    @IsOptional()
    @IsString()
    orderId: string
    
    @IsOptional()
    @IsString()
    subscriptionId: string


    @IsOptional()
    @IsString()
    meatBoxOrderId: string

    @IsString()
    trxref: string
    
    @IsString()
    reference: string
}