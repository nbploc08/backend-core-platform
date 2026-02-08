import { IsBoolean, IsNumber, IsString } from 'class-validator';

import { IsDate, IsEmail, IsNotEmpty } from 'class-validator';

export class UserAuthResponseDto {
  @IsString()
  @IsNotEmpty()
  id: string;
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
  @IsNumber()
  @IsNotEmpty()
  permVersion: number;
  @IsDate()
  @IsNotEmpty()
  createdAt: Date;
  @IsDate()
  @IsNotEmpty()
  updatedAt: Date;
}
