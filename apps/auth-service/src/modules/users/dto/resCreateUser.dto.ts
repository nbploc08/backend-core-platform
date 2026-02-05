import { IsDate, IsEmail, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateUserResponseDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;
  @IsEmail()
  @IsNotEmpty()
  email: string;
  @IsString()
  @IsNotEmpty()
  code: string;
  @IsDate()
  @IsNotEmpty()
  createdAt: Date;
}
