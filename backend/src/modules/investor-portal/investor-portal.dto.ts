import { IsString, IsInt, Matches, Min } from 'class-validator';

export class CreateChallengeDto {
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum address format' })
  address!: string;

  @IsInt()
  @Min(1)
  chainId!: number;
}

export class VerifyWalletDto {
  @IsString()
  challengeId!: string;

  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum address format' })
  address!: string;

  @IsInt()
  @Min(1)
  chainId!: number;

  @IsString()
  @Matches(/^0x[a-fA-F0-9]+$/, { message: 'Invalid signature format' })
  signature!: string;
}
