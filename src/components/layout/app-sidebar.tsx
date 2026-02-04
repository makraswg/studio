
"use client";

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Users, 
  Shield, 
  Layers, 
  CheckCircle, 
  Activity, 
  Settings, 
  LogOut, 
  LayoutDashboard,
  ShieldCheck,
  Workflow,
  Settings2,
  RefreshCw,
  UserPlus,
  User as UserIcon,
  Lock,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  useAuth, 
  useUser 
} from '@/firebase';
import { signOut } from 'firebase/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { updatePlatformUserPasswordAction } from '@/app/actions/mysql-actions';
import { usePlatformAuth } from '@/context/auth-context';

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const { user } = useUser();
  const { logout } = usePlatformAuth();

  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Benutzerverzeichnis', href: '/users', icon: Users },
    { name: 'Lifecycle Hub', href: '/lifecycle', icon: UserPlus },
    { name: 'Ressourcenkatalog', href: '/resources', icon: Layers },
    { name: 'Zuweisungsgruppen', href: '/groups', icon: Workflow },
    { name: 'Einzelzuweisungen', href: '/assignments', icon: Shield },
    { name: 'Access Reviews', href: '/reviews', icon: CheckCircle },
    { name: 'Audit Log', href: '/audit', icon: Activity },
  ];

  const integrationItems = [
    { name: 'Jira Sync', href: '/integrations/jira', icon: RefreshCw },
  ];

  const handleLogout = async () => {
    try {
      // Logout from custom session
      logout();
      // Also try to sign out from Firebase if a session existed
      try { await signOut(auth); } catch(e) {}
      router.push('/');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "Fehler", description: "Passwörter stimmen nicht überein." });
      return;
    }
    if (newPassword.length < 6) {
      toast({ variant: "destructive", title: "Fehler", description: "Passwort muss mind. 6 Zeichen lang sein." });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await updatePlatformUserPasswordAction(user?.email || '', newPassword);
      if (res.success) {
        toast({ title: "Passwort aktualisiert", description: "Ihr Passwort wurde erfolgreich geändert." });
        setIsPasswordDialogOpen(false);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        throw new Error(res.error || "Unbekannter Fehler beim Aktualisieren des Passworts.");
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="w-64 sidebar-admin flex flex-col h-screen sticky top-0 z-40">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded-none flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="font-headline font-bold text-xl tracking-tight block">ComplianceHub</span>
          <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase block">Identity Management</span>
        </div>
      </div>

      <div className="px-3 flex-1 overflow-y-auto space-y-6 pt-4">
        <div>
          <p className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            IAM Operationen
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link 
                  key={item.name} 
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-none transition-all text-[11px] font-bold uppercase tracking-wider",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div>
          <p className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Integrationen
          </p>
          <nav className="space-y-1">
            {integrationItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link 
                  key={item.name} 
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-none transition-all text-[11px] font-bold uppercase tracking-wider",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div>
          <p className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Konfiguration
          </p>
          <nav className="space-y-1">
            <Link 
              href="/setup"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-none transition-all text-[11px] font-bold uppercase tracking-wider",
                pathname === '/setup' 
                  ? "bg-primary text-primary-foreground" 
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Setup & Daten</span>
            </Link>
            <Link 
              href="/settings"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-none transition-all text-[11px] font-bold uppercase tracking-wider",
                pathname === '/settings' 
                  ? "bg-primary text-primary-foreground" 
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Einstellungen</span>
            </Link>
          </nav>
        </div>
      </div>

      <div className="p-4 border-t border-slate-800">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full h-auto p-2 justify-start items-center gap-3 rounded-none hover:bg-white/5 hover:text-white border-none group transition-colors focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <Avatar className="h-8 w-8 rounded-none border border-slate-700 shrink-0">
                <AvatarFallback className="bg-primary/20 text-primary font-bold text-[10px] uppercase">
                  {user?.email?.charAt(0) || user?.displayName?.charAt(0) || 'A'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden text-left">
                <p className="text-[11px] font-bold truncate group-hover:text-primary transition-colors text-slate-200">
                  {user?.displayName || user?.email || 'Administrator'}
                </p>
                <p className="text-[10px] text-slate-500 truncate uppercase tracking-tighter">Mein Konto</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            side="right" 
            align="end" 
            sideOffset={12} 
            className="w-56 rounded-none border-slate-800 bg-slate-900 text-slate-200 z-[100]"
          >
            <DropdownMenuLabel className="text-[9px] font-bold uppercase text-slate-500 px-3 py-2">
              Benutzerverwaltung
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem 
              onSelect={() => setIsPasswordDialogOpen(true)}
              className="gap-3 px-3 py-2 text-[11px] font-bold uppercase cursor-pointer hover:bg-white/5 focus:bg-white/5 focus:text-white transition-colors"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" /> Passwort ändern
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem 
              onSelect={handleLogout}
              className="gap-3 px-3 py-2 text-[11px] font-bold uppercase cursor-pointer text-red-400 hover:bg-red-400/10 focus:bg-red-400/10 focus:text-red-400 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="rounded-none max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase">Passwort ändern</DialogTitle>
            <DialogDescription className="text-xs">Vergeben Sie ein neues Passwort für Ihren Account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">Neues Passwort</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="rounded-none" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">Bestätigen</Label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="rounded-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)} className="rounded-none">Abbrechen</Button>
            <Button onClick={handleUpdatePassword} disabled={isUpdatingPassword} className="rounded-none font-bold uppercase text-[10px] gap-2">
              {isUpdatingPassword && <Loader2 className="w-3 h-3 animate-spin" />}
              Aktualisieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
