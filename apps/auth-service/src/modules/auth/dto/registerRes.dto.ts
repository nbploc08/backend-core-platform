import { IsDate, IsEmail, IsNotEmpty, IsUUID } from 'class-validator';

export class RegisterResponseDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;
  @IsEmail()
  @IsNotEmpty()
  email: string;
  @IsDate()
  @IsNotEmpty()
  createdAt: Date;
}
