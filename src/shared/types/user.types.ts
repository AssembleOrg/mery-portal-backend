export enum UserRole {
  ADMIN = 'ADMIN',
  SUBADMIN = 'SUBADMIN',
  USER = 'USER',
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}
