"use client";

import { useState, useEffect } from 'react';
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
  UserPlus,
  Lock,
  AlertTriangle,
  ClipboardCheck,
  BarChart3,
  PieChart,
  Library,
  FileCheck,
  BrainCircuit,
  Network,
  Map as MapIcon,
  ChevronRight,
  UserCircle
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
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { updatePlatformUserPasswordAction } from '@/app/actions/mysql-actions';
import { usePlatformAuth } from '@/context/auth-context';
import { Separator } from '@/components/ui/separator';

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const { user: authUser } = useUser();
  const { logout, user: platformUser } = usePlatformAuth();

  const [mounted, setMounted] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Benutzerverzeichnis', href: '/users', icon: Users },
    { name: 'Lifecycle Hub', href: '/lifecycle', icon: UserPlus },
    { name: 'Ressourcenkatalog', href: '/resources', icon: Layers },
    { name: 'Zuweisungsgruppen', href: '/groups', icon: Workflow },
    { name: 'Einzelzuweisungen', href: '/assignments', icon: Shield },
    { name: 'Access Reviews', href: '/reviews', icon: CheckCircle },
  ];

  const processItems = [
    { name: 'Prozessübersicht', href: '/processhub', icon: Workflow },
    { name: 'Prozesslandkarte', href: '/processhub/map', icon: Network },
  ];

  const riskItems = [
    { name: 'Risiko Dashboard', href: '/risks', icon: BarChart3 },
    { name: 'Gefährdungskatalog', href: '/risks/catalog', icon: Library },
    { name: 'Maßnahmen & Kontrollen', href: '/risks/measures', icon: ClipboardCheck },
    { name: 'Berichte & Analyse', href: '/risks/reports', icon: PieChart },
    { name: 'Audit Log', href: '/audit', icon: Activity },
  ];

  const complianceItems = [
    { name: 'Datenschutz (VVT)', href: '/gdpr', icon: FileCheck },
    { name: 'KI Identity Audit', href: '/iam-audit', icon: BrainCircuit },
  ];

  const handleLogout = async () => {
    logout();
    try { await signOut(auth); } catch(e) {}
    router.push('/');
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
      const res = await updatePlatformUserPasswordAction(platformUser?.email || '', newPassword);
      if (res.success) {
        toast({ title: "Passwort aktualisiert" });
        setIsPasswordDialogOpen(false);
        setNewPassword('');
        setConfirmPassword('');
      } else throw new Error(res.error || "Fehler");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (!mounted) return null;

  const NavLink = ({ item, activeColor = "bg-primary" }: { item: any, activeColor?: string }) => {
    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href) && !pathname.startsWith('/processhub/map') && item.href !== '/processhub/map');
    // Special handling for Process Map vs Overview
    const isMapActive = item.href === '/processhub/map' && pathname === '/processhub/map';
    const isProcActive = item.href === '/processhub' && pathname.startsWith('/processhub') && !pathname.startsWith('/processhub/map');
    
    const active = item.href === '/processhub/map' ? isMapActive : item.href === '/processhub' ? isProcActive : isActive;

    return (
      <Link 
        key={item.name} 
        href={item.href} 
        className={cn(
          "flex items-center justify-between px-4 py-2.5 rounded-xl transition-all group",
          active 
            ? `${activeColor} text-white shadow-lg shadow-black/10` 
            : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
        )}
      >
        <div className="flex items-center gap-3">
          <item.icon className={cn("w-4 h-4 transition-transform group-hover:scale-110", active ? "text-white" : "text-slate-400")} />
          <span className="text-[11px] font-black uppercase tracking-wider">{item.name}</span>
        </div>
        {active && <ChevronRight className="w-3 h-3 opacity-50" />}
      </Link>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 border-r border-slate-100 dark:border-slate-900">
      {/* Branding */}
      <div className="p-8 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20 rotate-3 group hover:rotate-0 transition-transform duration-500">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <span className="font-headline font-black text-xl tracking-tight block text-slate-900 dark:text-white uppercase leading-none">AccessHub</span>
            <span className="text-[9px] text-primary font-black tracking-[0.3em] uppercase block mt-1">Enterprise GRC</span>
          </div>
        </div>
      </div>

      <Separator className="mx-8 bg-slate-50 dark:bg-slate-900 my-4" />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-10 py-4">
          {/* IAM Operations */}
          <div className="space-y-2">
            <p className="px-4 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Platform Core</p>
            <nav className="space-y-1">
              {navItems.map((item) => <NavLink key={item.name} item={item} />)}
            </nav>
          </div>

          {/* Process Management */}
          <div className="space-y-2">
            <p className="px-4 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Workflow className="w-3.5 h-3.5 text-primary" /> ProcessHub
            </p>
            <nav className="space-y-1">
              {processItems.map((item) => <NavLink key={item.name} item={item} />)}
            </nav>
          </div>

          {/* Compliance & Data Protection */}
          <div className="space-y-2">
            <p className="px-4 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <FileCheck className="w-3.5 h-3.5 text-emerald-600" /> Compliance
            </p>
            <nav className="space-y-1">
              {complianceItems.map((item) => <NavLink key={item.name} item={item} activeColor="bg-emerald-600" />)}
            </nav>
          </div>

          {/* Risk Management */}
          <div className="space-y-2">
            <p className="px-4 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-accent" /> Risk Engine
            </p>
            <nav className="space-y-1">
              {riskItems.map((item) => <NavLink key={item.name} item={item} activeColor="bg-accent" />)}
            </nav>
          </div>

          {/* Configuration */}
          <div className="space-y-2">
            <p className="px-4 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Configuration</p>
            <nav className="space-y-1">
              <NavLink item={{ name: 'Setup & Data', href: '/setup', icon: Settings2 }} />
              <NavLink item={{ name: 'Settings', href: '/settings', icon: Settings }} />
            </nav>
          </div>
        </div>
      </ScrollArea>

      {/* User Footer */}
      <div className="p-4 border-t border-slate-50 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full h-auto p-3 justify-start items-center gap-4 rounded-2xl hover:bg-white dark:hover:bg-slate-900 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-800 shadow-none">
              <Avatar className="h-10 w-10 rounded-xl border-2 border-primary/10 shadow-inner">
                <AvatarFallback className="bg-primary text-white font-black text-xs uppercase">{platformUser?.displayName?.charAt(0) || 'A'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden text-left">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate leading-tight">{platformUser?.displayName || 'Administrator'}</p>
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{platformUser?.role || 'User'}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-64 rounded-[1.5rem] p-2 shadow-2xl border-slate-100 dark:border-slate-800">
            <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 px-3 py-2">System Account</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setIsPasswordDialogOpen(true)} className="rounded-xl gap-3 py-2.5 font-bold text-xs"><Lock className="w-4 h-4 text-slate-400" /> Passwort ändern</DropdownMenuItem>
            <DropdownMenuSeparator className="my-2 bg-slate-50 dark:bg-slate-800" />
            <DropdownMenuItem onSelect={handleLogout} className="rounded-xl gap-3 py-2.5 font-bold text-xs text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"><LogOut className="w-4 h-4" /> Abmelden</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-sm border-none shadow-2xl p-0 overflow-hidden bg-white dark:bg-slate-950">
          <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-4">
              <Lock className="w-8 h-8 text-primary" />
              <DialogTitle className="text-lg font-headline font-bold uppercase tracking-tight">Passwort ändern</DialogTitle>
            </div>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Neues Passwort</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="rounded-xl h-12 border-slate-200 dark:border-slate-800" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Bestätigen</Label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="rounded-xl h-12 border-slate-200 dark:border-slate-800" />
            </div>
          </div>
          <DialogFooter className="p-8 bg-slate-50 dark:bg-slate-900/50 border-t shrink-0">
            <Button onClick={handleUpdatePassword} disabled={isUpdatingPassword} className="rounded-xl font-black uppercase text-[10px] tracking-widest h-12 w-full shadow-lg shadow-primary/20 transition-all active:scale-95">
              {isUpdatingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Passwort aktualisieren'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
