import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';
export interface AuditOptions {
  action: string;
  entity: string;
  entityId?: string;
}

export const Auditory = (options: AuditOptions) => SetMetadata(AUDIT_KEY, options);
