import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES, ADMIN_ROLES } from "@/config/constants";
import { ApiRequestError } from "@/services/api-client";
import { login as loginRequest, signup as signupRequest } from "@/services/auth.service";

export default function LoginPage() {
  const { login, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = (location.state as { from?: { pathname: string } })?.from?.pathname;

  function getDefaultRoute(role?: string) {
    return role && (ADMIN_ROLES as readonly string[]).includes(role)
      ? ROUTES.OVERVIEW
      : ROUTES.INVESTOR_DASHBOARD;
  }

  function isSafeRedirect(path: string, role: string): boolean {
    const isInvestorPath = path.startsWith('/investor');
    const userIsAdmin = (ADMIN_ROLES as readonly string[]).includes(role);
    if (userIsAdmin) return !isInvestorPath;
    return isInvestorPath;
  }

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated && user?.role) {
      const safeFrom = fromState && isSafeRedirect(fromState, user.role) ? fromState : null;
      navigate(safeFrom ?? getDefaultRoute(user.role), { replace: true });
    }
  }, [fromState, isAuthenticated, navigate, user?.role]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = { email: email.trim(), password };
      const response =
        mode === "signup"
          ? await signupRequest({
              ...payload,
              fullName: fullName.trim() || undefined,
              role: "investor",
            })
          : await loginRequest(payload);

      login(response.data.accessToken, response.data.user);
      const userRole = response.data.user.role;
      const destination = (fromState && isSafeRedirect(fromState, userRole))
        ? fromState
        : getDefaultRoute(userRole);
      navigate(destination, { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError("Authentication request failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Kadra</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signin" ? "Sign in to your account" : "Create your account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <label htmlFor="fullName" className="text-sm font-medium">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Kadra Admin"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                autoComplete="name"
              />
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              placeholder="admin@kadra.io"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              autoComplete="current-password"
            />
          </div>


          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {isSubmitting
              ? "Please wait..."
              : mode === "signin"
                ? "Sign In"
                : "Sign Up"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError("");
          }}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {mode === "signin"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
