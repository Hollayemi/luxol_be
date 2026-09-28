import { IsString } from "class-validator"

export class InitializedDto {

    @IsString()
    orderId: string

    @IsString()
    trxref: string
    
    @IsString()
    reference: string
}