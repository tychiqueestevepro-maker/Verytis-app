'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, Github, ShieldCheck } from 'lucide-react';
import { Button, Input, Card } from '@/components/ui';
import Link from 'next/link';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const supabase = createClient();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setError(error.message);
                setLoading(false);
            } else {
                router.push('/');
            }
        } catch (err) {
            setError('An unexpected error occurred during login');
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 selection:bg-blue-100">
            <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-xl shadow-blue-500/20 mb-4 transition-transform hover:scale-105 duration-300">
                        <ShieldCheck className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome back</h1>
                    <p className="text-slate-500 text-sm font-medium">Log in to your Verytis governance console</p>
                </div>

                <Card className="p-8 shadow-xl shadow-slate-200/50 border-slate-100 bg-white/80 backdrop-blur-sm">
                    <form onSubmit={handleLogin} className="space-y-5">
                        {error && (
                            <div className="p-3 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-100 rounded-lg animate-in shake duration-500">
                                {error}
                            </div>
                        )}

                        <Input
                            label="Work Email"
                            type="email"
                            placeholder="name@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />

                        <div className="space-y-1">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-xs font-semibold text-slate-700">Password</label>
                                <Link href="#" className="text-[10px] font-bold text-blue-600 hover:text-blue-700 transition-colors">Forgot password?</Link>
                            </div>
                            <Input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <Button
                            type="submit"
                            variant="primary"
                            className="w-full py-3.5 text-sm font-bold mt-2"
                            disabled={loading}
                            icon={loading ? null : ArrowRight}
                        >
                            {loading ? 'Authenticating...' : 'Sign in to Console'}
                        </Button>
                    </form>

                    <div className="mt-8 relative">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t border-slate-100"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="px-3 bg-white text-slate-400 font-medium">Or continue with</span>
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-2 gap-4">
                        <button
                            onClick={handleGoogleLogin}
                            className="flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-medium text-xs text-slate-700"
                        >
                            <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                            Google
                        </button>
                        <button className="flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-medium text-xs text-slate-700">
                            <Github className="w-4 h-4" />
                            GitHub
                        </button>
                    </div>
                </Card>

                <p className="text-center text-sm text-slate-500">
                    New to Verytis?{' '}
                    <Link href="/signup" className="font-bold text-blue-600 hover:text-blue-700 transition-colors underline decoration-blue-200 underline-offset-4 decoration-2 hover:decoration-blue-600">
                        Create an organization
                    </Link>
                </p>
            </div>
        </div>
    );
}
