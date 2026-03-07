import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ADMIN_ROLES, ROUTES } from '@/config/constants';

interface RoleGuardProps {
  allow: 'admin' | 'investor';
  children: ReactNode;
}

export function RoleGuard({ allow, children }: RoleGuardProps) {
  const { user } = useAuth();
  const isAdmin = user?.role && (ADMIN_ROLES as readonly string[]).includes(user.role);

  if (allow === 'admin' && !isAdmin) {
    return <Navigate to={ROUTES.INVESTOR_DASHBOARD} replace />;
  }

  if (allow === 'investor' && isAdmin) {
    return <Navigate to={ROUTES.OVERVIEW} replace />;
  }

  return <>{children}</>;
}
