import { IsOptional, IsInt, Min, IsString, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  per_page?: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  _start?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  _end?: number;

  @IsOptional()
  @IsString()
  _sort?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsIn(['ASC', 'DESC'])
  _order?: 'ASC' | 'DESC' = 'ASC';

  @IsOptional()
  @IsString()
  filter?: string;
}

export class FilterDto {
  [key: string]: any;
}

export class BaseResponseDto {
  success!: boolean;
  message!: string;
}

export class PaginatedResponseDto<T> {
  data!: T[];
  total!: number;
}
