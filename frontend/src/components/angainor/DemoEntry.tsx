import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { login as loginRequest } from '@/services/auth.service';
import { Button } from '@/components/ui/button';

export function DemoEntry() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  async function enter() {
    setPending(true);
    setError('');
    try {
      const { data } = await loginRequest({ email: 'preview@example.test', password: 'synthetic-demo' });
      login(data.accessToken, data.user);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('The demo could not be opened. Please try again.');
    } finally { setPending(false); }
  }
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <section className="w-full max-w-lg rounded-xl border border-border bg-card p-8 sm:p-12">
        <img src="/logo-combomark-black.svg" alt="Angainor" className="h-7 dark:hidden" />
        <img src="/logo-combomark-white.svg" alt="Angainor" className="hidden h-7 dark:block" />
        <p className="mt-10 text-xs uppercase tracking-widest text-muted-foreground">Control Room preview</p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight">Explore your fund workspace.</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">Browse the dashboard, inspect source documents, search the workspace, and review waterfall terms in a fictional real estate fund.</p>
        <div className="my-6 rounded-md border border-border bg-muted/40 p-4 text-sm leading-6">This demo uses synthetic data. Changes, uploads, and transactions are disabled. No account or personal information is needed.</div>
        <Button onClick={enter} disabled={pending} className="w-full gap-2">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {pending ? 'Opening demo…' : 'Explore demo'}
        </Button>
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      </section>
    </main>
  );
}
