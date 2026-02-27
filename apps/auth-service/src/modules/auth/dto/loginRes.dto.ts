import { IsEmail, IsString } from 'class-validator';

export class loginResponseDto {
  @IsString()
  id: string;
  @IsEmail()
  email: string;
  @IsInt()
  permVersion: number;
  @IsString()
  access_token: string;
}
