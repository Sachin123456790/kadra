import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/config/constants';

/**
 * Route guard — redirects unauthenticated users to /login.
 * Wrap protected routes with this component.
 *
 * Usage:
 *   <AuthGuard><ProtectedPage /></AuthGuard>
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

/**
 * HOC variant — wraps a component with AuthGuard.
 *
 * Usage:
 *   export default withAuth(MyPage);
 */
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  function WrappedComponent(props: P) {
    return (
      <AuthGuard>
        <Component {...props} />
      </AuthGuard>
    );
  }
  WrappedComponent.displayName = `withAuth(${Component.displayName || Component.name || 'Component'})`;
  return WrappedComponent;
}
