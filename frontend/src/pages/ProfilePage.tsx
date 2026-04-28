import { useState } from 'react';
import { PageHeader } from '@/components/angainor/PageHeader';
import { SectionCard } from '@/components/angainor/SectionCard';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/components/angainor/ThemeProvider';
import { User, Shield, Moon, Sun, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'KA';

  const roleName = user?.role
    ? user.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'User';

  return (
    <div>
      <PageHeader title="Profile" subtitle="Manage your account settings" />

      {/* Account Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-1">
          <SectionCard>
            <div className="flex flex-col items-center text-center py-4">
              <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center text-2xl font-bold text-primary-foreground mb-4">
                {initials}
              </div>
              <h3 className="text-lg font-semibold text-foreground">{user?.email || 'User'}</h3>
              <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                <Shield className="h-3 w-3" />
                {roleName}
              </span>
            </div>
          </SectionCard>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* Account Details */}
          <SectionCard title="Account Details">
            <dl className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</dt>
                  <dd className="text-sm text-foreground mt-0.5">{user?.email || 'N/A'}</dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Role</dt>
                  <dd className="text-sm text-foreground mt-0.5">{roleName}</dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">User ID</dt>
                  <dd className="text-sm text-foreground mt-0.5 font-mono text-xs">{user?.id || 'N/A'}</dd>
                </div>
              </div>
            </dl>
          </SectionCard>

          {/* Preferences */}
          <SectionCard title="Preferences">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Theme</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose between light and dark mode
                </p>
              </div>
              <button
                onClick={toggle}
                className="flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-card hover:bg-muted transition-colors text-sm"
              >
                {theme === 'light' ? (
                  <>
                    <Moon className="h-4 w-4" />
                    Dark Mode
                  </>
                ) : (
                  <>
                    <Sun className="h-4 w-4" />
                    Light Mode
                  </>
                )}
              </button>
            </div>
          </SectionCard>

          {/* Session */}
          <SectionCard title="Session">
            {!showLogoutConfirm ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Sign Out</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    End your current session and return to the login page
                  </p>
                </div>
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors text-sm"
                >
                  <LogOut className="h-4 w-4" />
                  Log Out
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-destructive/5 -m-6 p-6 rounded-b-lg">
                <p className="text-sm text-destructive font-medium">Are you sure you want to log out?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-sm hover:bg-destructive/90 transition-colors"
                  >
                    Confirm Log Out
                  </button>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
