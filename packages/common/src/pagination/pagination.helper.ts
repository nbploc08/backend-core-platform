import { PaginationDto } from './pagination.dto';
import { logger } from '../logging/logger';
import { ServiceError } from '../errors/service-error';
import { ErrorCodes } from '../errors/error-codes';

export interface IPaginationOptions {
  page: number;
  limit: number;
  skip: number;
  sort: Record<string, 'ASC' | 'DESC'>;
  filter: Record<string, any>;
}

/**
 * Helper to parse PaginationDto into options suitable for ORM (Prisma/TypeORM)
 */
export function parsePagination(dto: PaginationDto): IPaginationOptions {
  let page = dto.page || 1;
  let limit = dto.per_page || 10;

  // React Admin style support (_start, _end)
  if (dto._start !== undefined && dto._end !== undefined) {
    if (dto._end <= dto._start) {
      throw new ServiceError({
        code: ErrorCodes.VALIDATION_ERROR,
        statusCode: 400,
        message: `Invalid pagination params: _end (${dto._end}) must be greater than _start (${dto._start})`,
        details: { _start: dto._start, _end: dto._end },
      });
    }
    limit = dto._end - dto._start;
    page = Math.floor(dto._start / limit) + 1;
  }

  const skip = (page - 1) * limit;

  const sort: Record<string, 'ASC' | 'DESC'> = {};
  if (dto._sort) {
    sort[dto._sort] = dto._order === 'DESC' ? 'DESC' : 'ASC';
  }

  let filter: Record<string, any> = {};
  if (dto.filter) {
    try {
      // Try parsing if it's a JSON string (React Admin standard)
      const parsedFilter = JSON.parse(dto.filter);
      if (typeof parsedFilter === 'object' && parsedFilter !== null) {
        filter = parsedFilter;
      }
    } catch (e) {
      const errorMessage = (e as Error).message;
      logger.warn(
        { filter: dto.filter, error: errorMessage },
        'Failed to parse pagination filter JSON',
      );
      throw new ServiceError({
        code: ErrorCodes.VALIDATION_ERROR,
        statusCode: 400,
        message: `Invalid filter format: ${errorMessage}. Provided value: ${dto.filter}`,
        details: { filter: dto.filter },
      });
    }
  }

  return {
    page,
    limit,
    skip,
    sort,
    filter,
  };
}
