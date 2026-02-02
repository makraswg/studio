"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, LayoutDashboard, Loader2, Plus } from 'lucide-react';
import { useAuth, useUser, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { initiateAnonymousSignIn, initiateEmailSignIn } from '@/firebase/non-blocking-login';
import { collection, doc, setDoc, serverTimestamp, query, collectionGroup, where } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  
  const [step, setStep] = useState<'login' | 'tenant'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  // We need to find tenants where this user is a member. 
  // For the MVP, we'll allow users to create a tenant if they have none.
  // We use a collectionGroup query to find all 'members' docs where ID matches user UID.
  const membershipsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collectionGroup(db, 'members'), where('userId', '==', user.uid));
  }, [db, user]);

  const { data: memberships, isLoading: isMembershipsLoading } = useCollection(membershipsQuery);

  useEffect(() => {
    if (user && step === 'login') {
      setStep('tenant');
    }
  }, [user, step]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    if (email && password) {
      initiateEmailSignIn(auth, email, password);
    } else {
      initiateAnonymousSignIn(auth);
    }
  };

  const handleCreateTenant = async () => {
    if (!db || !user) return;
    setIsActionLoading(true);
    
    try {
      const tenantId = `tenant-${Math.random().toString(36).substring(2, 9)}`;
      const tenantRef = doc(db, 'tenants', tenantId);
      const memberRef = doc(db, 'tenants', tenantId, 'members', user.uid);
      
      const tenantData = {
        id: tenantId,
        name: 'New Organization',
        slug: tenantId,
        createdAt: new Date().toISOString()
      };

      const memberData = {
        id: user.uid,
        tenantId: tenantId,
        userId: user.uid,
        role: 'tenantOwner',
        status: 'active',
        createdAt: new Date().toISOString()
      };

      await setDoc(tenantRef, tenantData);
      await setDoc(memberRef, memberData);
      
      toast({
        title: "Tenant Created",
        description: "Your new workspace is ready.",
      });
      
      router.push(`/${tenantId}/dashboard`);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message || "Failed to create tenant.",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const selectTenant = (tenantId: string) => {
    router.push(`/${tenantId}/dashboard`);
  };

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute top-0 left-0 p-8 flex items-center gap-2">
        <Shield className="w-8 h-8 text-primary" />
        <span className="text-2xl font-headline font-bold text-foreground">AccessHub</span>
      </div>

      <div className="w-full max-w-md">
        {step === 'login' ? (
          <Card className="border-none shadow-xl">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-headline">Welcome back</CardTitle>
              <CardDescription>
                Sign in to manage your multi-tenant environment
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email (Optional for Demo)</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="admin@company.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                  </div>
                  <Input 
                    id="password" 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90" disabled={isActionLoading}>
                  {isActionLoading ? <Loader2 className="animate-spin" /> : "Sign In"}
                </Button>
                <div className="relative w-full text-center">
                  <span className="bg-background px-2 text-xs text-muted-foreground uppercase">Or</span>
                  <div className="absolute top-1/2 left-0 right-0 -z-10 h-px bg-border" />
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => initiateAnonymousSignIn(auth)}
                  disabled={isActionLoading}
                >
                  Continue Anonymously
                </Button>
              </CardFooter>
            </form>
          </Card>
        ) : (
          <Card className="border-none shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-headline text-center">Select Tenant</CardTitle>
              <CardDescription className="text-center">
                Choose an organization workspace to enter
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isMembershipsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-primary" />
                </div>
              ) : memberships && memberships.length > 0 ? (
                memberships.map((membership) => (
                  <Button 
                    key={membership.tenantId}
                    variant="outline"
                    className="w-full h-16 justify-between px-6 hover:border-primary hover:bg-primary/5 transition-all group"
                    onClick={() => selectTenant(membership.tenantId)}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {membership.tenantId}
                      </span>
                      <Badge variant="secondary" className="text-[10px] uppercase font-bold py-0 h-4">
                        {membership.role}
                      </Badge>
                    </div>
                    <LayoutDashboard className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </Button>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">No tenants found for your account.</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex-col gap-2">
              <Button 
                variant="outline" 
                className="w-full border-dashed gap-2" 
                onClick={handleCreateTenant}
                disabled={isActionLoading}
              >
                {isActionLoading ? <Loader2 className="animate-spin" /> : <Plus className="w-4 h-4" />}
                Create New Tenant
              </Button>
              <Button 
                variant="ghost" 
                className="w-full text-muted-foreground text-xs" 
                onClick={() => {
                  auth.signOut();
                  setStep('login');
                }}
              >
                Sign out
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
