export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  location?: string;
  userAgent?: string;
}

export interface AuditData {
  action: string;
  entity: string;
  entityId: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
}
