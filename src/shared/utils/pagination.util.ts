import { PaginationMeta, PaginationQuery } from '../types';

export class PaginationUtil {
  static createMeta(
    page: number,
    limit: number,
    total: number,
  ): PaginationMeta {
    const totalPages = Math.ceil(total / limit);
    
    return {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  static normalizeQuery(query: PaginationQuery): Required<PaginationQuery> {
    return {
      page: Math.max(1, query.page || 1),
      limit: Math.min(100, Math.max(1, query.limit || 10)),
      search: query.search || '',
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    };
  }

  static getSkip(page: number, limit: number): number {
    return (page - 1) * limit;
  }
}
