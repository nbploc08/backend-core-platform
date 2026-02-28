import { IsEmail, IsInt, IsString, IsNotEmpty, IsDate } from 'class-validator';

export class CreateNotificationDto {
  @IsNotEmpty()
  @IsString()
  userId: string;
  @IsString()
  @IsNotEmpty()
  type: string;
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  body?: string;
  @IsString()
  data?: any;
}
