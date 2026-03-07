import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
  @IsNotEmpty()
  @IsString()
  password: string;
}
