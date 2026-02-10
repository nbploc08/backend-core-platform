import { IsEmail, IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class InfoUserDto {
  @IsString()
  @IsNotEmpty()
  id: string;
  @IsEmail()
  @IsNotEmpty()
  email: string;
  @IsString()
  @IsNotEmpty()
  name: string;
  @IsString()
  @IsNotEmpty()
  phone: string;
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}
