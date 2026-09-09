import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateReplenishmentReminderDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() public estimateId!: string;
  @ApiProperty() @IsEmail() @MaxLength(320) public email!: string;
  @ApiProperty() @IsBoolean() public consent!: boolean;
  @ApiProperty({ example: '2026-09-02' })
  @IsString()
  @MaxLength(40)
  public consentVersion!: string;
}

export class UpdateReplenishmentReminderStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'PAUSED', 'CANCELLED'] })
  @IsIn(['ACTIVE', 'PAUSED', 'CANCELLED'])
  public status!: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
}

export class ReminderTokenResponseDto {
  @ApiProperty() public id!: string;
  @ApiProperty() public status!: string;
  @ApiProperty({ nullable: true }) public token!: string | null;
  @ApiProperty() public nextReminderAt!: Date;
}
