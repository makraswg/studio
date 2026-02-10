
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { verifyMagicLinkAction } from '@/app/actions/auth-actions';
import { usePlatformAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

export const dynamic = 'force-dynamic';

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = usePlatformAuth();
  const { dataSource } = useSettings();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

  useEffect(() => {
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!token || !email) {
      setError('Ungültiger Link. Parameter fehlen.');
      setStatus('error');
      return;
    }

    const verify = async () => {
      try {
        const res = await verifyMagicLinkAction(token, email, dataSource);
        if (res.success && res.user) {
          setStatus('success');
          setUser(res.user);
          toast({ title: "Anmeldung erfolgreich", description: "Willkommen zurück!" });
          setTimeout(() => router.push('/dashboard'), 1500);
        } else {
          setError(res.error || 'Verifizierung fehlgeschlagen.');
          setStatus('error');
        }
      } catch (e) {
        setError('Systemfehler bei der Verifizierung.');
        setStatus('error');
      }
    };

    verify();
  }, [searchParams, dataSource, router, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-[400px] rounded-3xl border-none shadow-2xl overflow-hidden bg-white dark:bg-slate-900">
        <CardContent className="p-10 text-center space-y-8">
          {status === 'verifying' && (
            <div className="space-y-6 py-4">
              <div className="relative w-16 h-16 mx-auto">
                <Loader2 className="w-16 h-16 animate-spin text-primary opacity-20" />
                <ShieldCheck className="absolute inset-0 m-auto w-8 h-8 text-primary animate-pulse" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-headline font-bold text-slate-900 dark:text-white">Identität wird geprüft</h2>
                <p className="text-xs text-slate-500">Einen Moment bitte, wir verifizieren Ihren Magic Link...</p>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-6 py-4 animate-in zoom-in-95">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-emerald-100">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-headline font-bold text-slate-900 dark:text-white">Anmeldung erfolgt!</h2>
                <p className="text-xs text-slate-500 italic">Sie werden automatisch zum Dashboard weitergeleitet.</p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-6 py-4 animate-in fade-in">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-100">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-headline font-bold text-slate-900 dark:text-white">Zugriff verweigert</h2>
                <p className="text-xs text-red-600 font-bold">{error}</p>
              </div>
              <Button className="w-full rounded-xl h-11 uppercase font-black text-[10px] tracking-widest gap-2" onClick={() => router.push('/')}>
                Zurück zum Login <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function MagicLinkVerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
      <VerifyContent />
    </Suspense>
  );
}
