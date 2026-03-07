export type UserRole =
  | 'admin'
  | 'platform_admin'
  | 'fund_admin'
  | 'operations_analyst'
  | 'investor';

export const ADMIN_ROLES: UserRole[] = [
  'admin',
  'platform_admin',
  'fund_admin',
  'operations_analyst',
];

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  fullName?: string;
}
