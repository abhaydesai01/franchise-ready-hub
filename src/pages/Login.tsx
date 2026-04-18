import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3001/api/v1';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        let message = 'Invalid credentials';
        try {
          const body = (await res.json()) as { message?: string };
          if (body?.message) message = body.message;
        } catch {
          // ignore parse error
        }
        throw new Error(message);
      }

      const data = (await res.json()) as {
        user: unknown;
        accessToken: string;
        refreshToken: string;
      };
      setAuth(data as any);
      navigate('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      toast({
        title: 'Login failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-surface flex items-center justify-center">
      <div className="bg-white rounded-[10px] border border-brand-border shadow-[0_4px_24px_rgba(0,0,0,0.08)] p-8 w-full max-w-[400px]">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-[20px] font-bold text-brand-ink">Franchise</span>
            <span className="text-[20px] font-bold text-brand-crimson">Ready</span>
          </div>
          <p className="text-[14px] text-brand-muted">Sign in to your CRM account</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label className="text-[13px] font-medium text-brand-ink">Email</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@franchise-ready.in"
              className="mt-1 border-brand-border focus:border-brand-crimson focus:ring-brand-crimson/10"
            />
          </div>
          <div>
            <Label className="text-[13px] font-medium text-brand-ink">Password</Label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              className="mt-1 border-brand-border focus:border-brand-crimson focus:ring-brand-crimson/10"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-crimson hover:bg-brand-crimson-dk text-white rounded-lg h-11 text-[14px] font-medium"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
