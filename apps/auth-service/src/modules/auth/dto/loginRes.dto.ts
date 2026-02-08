import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class loginResponseDto {
  @IsString()
  id: string;
  @IsEmail()
  email: string;
  @IsString()
  access_token: string;
}
