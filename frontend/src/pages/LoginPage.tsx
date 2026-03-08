import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES, ADMIN_ROLES } from "@/config/constants";
import { ApiRequestError } from "@/services/api-client";
import { login as loginRequest, signup as signupRequest } from "@/services/auth.service";
import { Eye, EyeOff } from "lucide-react";

function LoginIllustration() {
  return (
    <svg viewBox="0 0 600 700" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="600" y2="700" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4338ca" />
          <stop offset="50%" stopColor="#6d28d9" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="phoneGrad" x1="320" y1="120" x2="420" y2="520" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="600" height="700" rx="16" fill="url(#bgGrad)" />

      {/* Clouds */}
      <g opacity="0.25" fill="white">
        <ellipse cx="80" cy="120" rx="60" ry="25" />
        <ellipse cx="50" cy="110" rx="40" ry="20" />
        <ellipse cx="110" cy="115" rx="35" ry="18" />

        <ellipse cx="500" cy="80" rx="55" ry="22" />
        <ellipse cx="470" cy="72" rx="38" ry="18" />
        <ellipse cx="535" cy="75" rx="30" ry="15" />

        <ellipse cx="120" cy="580" rx="70" ry="28" />
        <ellipse cx="80" cy="572" rx="45" ry="22" />
        <ellipse cx="160" cy="575" rx="40" ry="20" />

        <ellipse cx="480" cy="620" rx="55" ry="22" />
        <ellipse cx="450" cy="612" rx="38" ry="18" />
        <ellipse cx="515" cy="615" rx="30" ry="15" />
      </g>

      {/* Phone device */}
      <rect x="220" y="140" width="200" height="380" rx="24" fill="#1e1b4b" />
      <rect x="228" y="152" width="184" height="356" rx="18" fill="url(#phoneGrad)" />

      {/* Phone notch */}
      <rect x="280" y="155" width="80" height="6" rx="3" fill="#1e1b4b" opacity="0.3" />

      {/* Phone screen content - building icon */}
      <g transform="translate(280, 240)">
        {/* Building */}
        <rect x="0" y="20" width="80" height="100" rx="4" fill="white" opacity="0.9" />
        <rect x="10" y="35" width="14" height="14" rx="2" fill="#7c3aed" opacity="0.6" />
        <rect x="33" y="35" width="14" height="14" rx="2" fill="#7c3aed" opacity="0.6" />
        <rect x="56" y="35" width="14" height="14" rx="2" fill="#7c3aed" opacity="0.6" />
        <rect x="10" y="58" width="14" height="14" rx="2" fill="#7c3aed" opacity="0.6" />
        <rect x="33" y="58" width="14" height="14" rx="2" fill="#7c3aed" opacity="0.6" />
        <rect x="56" y="58" width="14" height="14" rx="2" fill="#7c3aed" opacity="0.6" />
        <rect x="28" y="88" width="24" height="32" rx="2" fill="#4338ca" />
        {/* Roof */}
        <polygon points="40,0 -5,20 85,20" fill="white" opacity="0.9" />
      </g>

      {/* Progress bar on phone */}
      <rect x="260" y="400" width="120" height="6" rx="3" fill="white" opacity="0.3" />
      <rect x="260" y="400" width="80" height="6" rx="3" fill="white" opacity="0.8" />

      {/* Status dots */}
      <circle cx="290" cy="430" r="4" fill="white" opacity="0.8" />
      <circle cx="310" cy="430" r="4" fill="white" opacity="0.4" />
      <circle cx="330" cy="430" r="4" fill="white" opacity="0.4" />

      {/* Checkmark bubble - top left of phone */}
      <g transform="translate(170, 160)">
        <ellipse cx="30" cy="25" rx="30" ry="25" fill="white" />
        <polygon points="20,35 30,40 40,35" fill="white" />
        <path d="M18 24 L26 32 L42 16" stroke="#7c3aed" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* Settings gear - top right */}
      <g transform="translate(440, 170)">
        <circle cx="15" cy="15" r="18" fill="white" opacity="0.15" />
        <circle cx="15" cy="15" r="7" fill="none" stroke="white" strokeWidth="2" />
        <g stroke="white" strokeWidth="2" strokeLinecap="round">
          <line x1="15" y1="2" x2="15" y2="7" />
          <line x1="15" y1="23" x2="15" y2="28" />
          <line x1="2" y1="15" x2="7" y2="15" />
          <line x1="23" y1="15" x2="28" y2="15" />
          <line x1="5.8" y1="5.8" x2="9.3" y2="9.3" />
          <line x1="20.7" y1="20.7" x2="24.2" y2="24.2" />
          <line x1="5.8" y1="24.2" x2="9.3" y2="20.7" />
          <line x1="20.7" y1="9.3" x2="24.2" y2="5.8" />
        </g>
      </g>

      {/* Lock icon - right side */}
      <g transform="translate(440, 340)">
        <rect x="0" y="30" width="60" height="45" rx="8" fill="#1e1b4b" opacity="0.8" />
        <path d="M15 30 V20 A15 15 0 0 1 45 20 V30" fill="none" stroke="#1e1b4b" strokeWidth="5" opacity="0.8" />
        <circle cx="30" cy="50" r="6" fill="white" opacity="0.8" />
        <rect x="28" y="53" width="4" height="10" rx="2" fill="white" opacity="0.8" />
      </g>

      {/* Person illustration */}
      <g transform="translate(100, 280)">
        {/* Legs */}
        <path d="M60 180 L45 260 L35 260" stroke="#f5f5f4" strokeWidth="14" strokeLinecap="round" fill="none" />
        <path d="M75 180 L100 260 L110 258" stroke="#f5f5f4" strokeWidth="14" strokeLinecap="round" fill="none" />

        {/* Shoes */}
        <ellipse cx="30" cy="262" rx="18" ry="8" fill="#1e1b4b" />
        <ellipse cx="115" cy="260" rx="18" ry="8" fill="#1e1b4b" />

        {/* Body / jacket */}
        <path d="M40 100 Q45 180 60 190 Q75 180 90 100 Z" fill="#eab308" />
        <path d="M40 100 L30 160 Q35 165 50 170 L60 120 Z" fill="#ca8a04" />
        <path d="M90 100 L100 160 Q95 165 80 170 L70 120 Z" fill="#ca8a04" />

        {/* Collar */}
        <path d="M50 95 L65 110 L80 95" fill="#eab308" stroke="#ca8a04" strokeWidth="1" />

        {/* Head */}
        <circle cx="65" cy="75" r="22" fill="#fbbf24" opacity="0.15" />
        <circle cx="65" cy="75" r="20" fill="#d4a574" />

        {/* Hair */}
        <path d="M45 70 Q45 48 65 45 Q85 48 88 70 L85 62 Q82 50 65 48 Q48 50 46 62 Z" fill="#1e1b4b" />

        {/* Arm reaching toward phone */}
        <path d="M90 110 Q120 130 150 145" stroke="#eab308" strokeWidth="12" strokeLinecap="round" fill="none" />
        <circle cx="155" cy="148" r="8" fill="#d4a574" />

        {/* Backpack */}
        <rect x="25" y="95" width="16" height="50" rx="8" fill="#ca8a04" />
        <path d="M29 95 Q33 85 37 95" fill="none" stroke="#ca8a04" strokeWidth="3" />
      </g>

      {/* Shield badge - bottom center */}
      <g transform="translate(260, 500)">
        <path d="M40 5 L5 22 L5 50 Q5 75 40 90 Q75 75 75 50 L75 22 Z" fill="url(#shieldGrad)" opacity="0.9" />
        <path d="M25 48 L35 58 L55 38" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* Decorative circles */}
      <circle cx="520" cy="500" r="8" fill="white" opacity="0.15" />
      <circle cx="540" cy="520" r="5" fill="white" opacity="0.1" />
      <circle cx="80" cy="400" r="6" fill="white" opacity="0.12" />
      <circle cx="60" cy="420" r="4" fill="white" opacity="0.08" />

      {/* Small floating elements */}
      <rect x="490" y="260" width="20" height="20" rx="4" fill="white" opacity="0.1" transform="rotate(15 500 270)" />
      <rect x="70" y="200" width="15" height="15" rx="3" fill="white" opacity="0.1" transform="rotate(-10 77 207)" />
    </svg>
  );
}

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
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen flex bg-white">
      {/* Left side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 lg:px-16 xl:px-24">
        <div className="w-full max-w-md mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-12">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">K</span>
            </div>
            <span className="text-lg font-semibold text-foreground tracking-tight">Kadra</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight text-foreground leading-tight">
              {mode === "signin" ? (
                <>
                  Hello,
                  <br />
                  Welcome Back
                </>
              ) : (
                <>
                  Get Started
                  <br />
                  With Kadra
                </>
              )}
            </h1>
            <p className="mt-3 text-muted-foreground">
              {mode === "signin"
                ? "Sign in to access your fund management portal"
                : "Create your investor account to get started"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "signup" && (
              <div>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="Email address"
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder={mode === "signup" ? "Create a password" : "Password"}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 pr-10 text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
            >
              {isSubmitting
                ? "Please wait..."
                : mode === "signin"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>

          {/* Toggle mode */}
          <p className="mt-8 text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("signup"); setError(""); }}
                  className="font-semibold text-primary hover:underline"
                >
                  Sign Up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("signin"); setError(""); }}
                  className="font-semibold text-primary hover:underline"
                >
                  Sign In
                </button>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Right side - Illustration */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-6">
        <div className="w-full h-full max-h-[700px] rounded-2xl overflow-hidden">
          <LoginIllustration />
        </div>
      </div>
    </div>
  );
}
