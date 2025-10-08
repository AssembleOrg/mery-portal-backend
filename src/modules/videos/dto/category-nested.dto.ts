import { Expose } from 'class-transformer';

export class CategoryNestedDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  slug: string;
}

