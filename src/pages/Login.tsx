import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock auth — just redirect
    document.cookie = 'isAuthenticated=true; path=/';
    navigate('/dashboard');
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
            <Input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@franchise-ready.in"
              className="mt-1 border-brand-border focus:border-brand-crimson focus:ring-brand-crimson/10" />
          </div>
          <div>
            <Label className="text-[13px] font-medium text-brand-ink">Password</Label>
            <Input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="••••••••"
              className="mt-1 border-brand-border focus:border-brand-crimson focus:ring-brand-crimson/10" />
          </div>
          <Button type="submit" className="w-full bg-brand-crimson hover:bg-brand-crimson-dk text-white rounded-lg h-11 text-[14px] font-medium">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
