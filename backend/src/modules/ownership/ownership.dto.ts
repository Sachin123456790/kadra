import { IsString } from 'class-validator';

export class RebuildProjectionDto {
  @IsString()
  fundId: string;
}
