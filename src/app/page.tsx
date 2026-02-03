'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2 } from 'lucide-react';
import { useAuth, useUser } from '@/firebase';
import { initiateAnonymousSignIn, initiateEmailSignIn } from '@/firebase/non-blocking-login';

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    if (email && password) {
      initiateEmailSignIn(auth, email, password).finally(() => setIsActionLoading(false));
    } else {
      initiateAnonymousSignIn(auth).finally(() => setIsActionLoading(false));
    }
  };

  if (isUserLoading || user) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute top-0 left-0 p-8 flex items-center gap-2">
        <Shield className="w-8 h-8 text-primary" />
        <span className="text-2xl font-headline font-bold text-foreground">ComplianceHub</span>
      </div>
      <div className="w-full max-w-md">
        <Card className="border-none shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-headline">Willkommen zurück</CardTitle>
            <CardDescription>Melden Sie sich an, um Ihre Zugriffskontrollumgebung zu verwalten</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail (Optional für Demo)</Label>
                <Input id="email" type="email" placeholder="admin@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90" disabled={isActionLoading}>
                {isActionLoading ? <Loader2 className="animate-spin" /> : "Anmelden"}
              </Button>
              <div className="relative w-full text-center">
                <span className="bg-background px-2 text-xs text-muted-foreground uppercase">Oder</span>
                <div className="absolute top-1/2 left-0 right-0 -z-10 h-px bg-border" />
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={() => initiateAnonymousSignIn(auth)} disabled={isActionLoading}>
                Anonym fortfahren
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
