import { IsEmail, IsBoolean, IsDate, IsNotEmpty, IsString, IsEnum } from 'class-validator';

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
