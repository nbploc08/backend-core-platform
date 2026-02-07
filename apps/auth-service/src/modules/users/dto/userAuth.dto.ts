import { IsBoolean, IsString } from 'class-validator';

import { IsDate, IsEmail, IsNotEmpty } from 'class-validator';

export class UserAuthResponseDto {
  @IsNotEmpty()
  @IsString()
  passwordHash: string;
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
  @IsDate()
  @IsNotEmpty()
  createdAt: Date;
  @IsDate()
  @IsNotEmpty()
  updatedAt: Date;
}
