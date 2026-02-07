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
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    setIsUpdatingPassword(true);
    try {
      const res = await updatePlatformUserPasswordAction(platformUser?.email || '', newPassword);
      if (res.success) {
        toast({ title: "Passwort aktualisiert" });
        setIsPasswordDialogOpen(false);
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (!mounted) return null;

  const NavLink = ({ item, activeColor = "bg-primary" }: { item: any, activeColor?: string }) => {
    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href) && !pathname.startsWith('/processhub/map') && item.href !== '/processhub/map');
    const isMapActive = item.href === '/processhub/map' && pathname === '/processhub/map';
    const isProcActive = item.href === '/processhub' && pathname.startsWith('/processhub') && !pathname.startsWith('/processhub/map');
    const active = item.href === '/processhub/map' ? isMapActive : item.href === '/processhub' ? isProcActive : isActive;

    return (
      <Link 
        key={item.name} 
        href={item.href} 
        className={cn(
          "flex items-center justify-between px-3 py-2 rounded-md transition-all group",
          active 
            ? `${activeColor} text-white shadow-sm` 
            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
        )}
      >
        <div className="flex items-center gap-2.5">
          <item.icon className={cn("w-4 h-4 transition-transform", active ? "text-white" : "text-slate-400")} />
          <span className="text-[10.5px] font-bold uppercase tracking-tight">{item.name}</span>
        </div>
        {active && <ChevronRight className="w-3 h-3 opacity-50" />}
      </Link>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 border-r border-slate-100">
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-headline font-black text-base tracking-tight block text-slate-900 dark:text-white uppercase leading-none">AccessHub</span>
            <span className="text-[8px] text-primary font-black tracking-[0.2em] uppercase block mt-1">Enterprise GRC</span>
          </div>
        </div>
      </div>

      <Separator className="mx-6 bg-slate-50 my-2" />

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-8 py-4">
          <div className="space-y-1">
            <p className="px-3 mb-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.1em]">Platform Core</p>
            {navItems.map((item) => <NavLink key={item.name} item={item} />)}
          </div>

          <div className="space-y-1">
            <p className="px-3 mb-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.1em]">ProcessHub</p>
            {processItems.map((item) => <NavLink key={item.name} item={item} />)}
          </div>

          <div className="space-y-1">
            <p className="px-3 mb-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.1em]">Compliance</p>
            {complianceItems.map((item) => <NavLink key={item.name} item={item} activeColor="bg-emerald-600" />)}
          </div>

          <div className="space-y-1">
            <p className="px-3 mb-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.1em]">Risk Engine</p>
            {riskItems.map((item) => <NavLink key={item.name} item={item} activeColor="bg-accent" />)}
          </div>

          <div className="space-y-1">
            <p className="px-3 mb-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.1em]">Config</p>
            <NavLink item={{ name: 'Setup', href: '/setup', icon: Settings2 }} />
            <NavLink item={{ name: 'Settings', href: '/settings', icon: Settings }} />
          </div>
        </div>
      </ScrollArea>

      <div className="p-3 border-t bg-slate-50/50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full h-auto p-2 justify-start items-center gap-3 rounded-lg hover:bg-white border border-transparent hover:border-slate-200">
              <Avatar className="h-8 w-8 rounded-md border shadow-inner">
                <AvatarFallback className="bg-primary text-white font-black text-[10px] uppercase">{platformUser?.displayName?.charAt(0) || 'A'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden text-left">
                <p className="text-[11px] font-bold text-slate-900 truncate leading-tight">{platformUser?.displayName || 'Administrator'}</p>
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">{platformUser?.role || 'User'}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-56 rounded-lg p-1 shadow-2xl">
            <DropdownMenuLabel className="text-[9px] font-black uppercase text-slate-400 px-2 py-1.5">System</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setIsPasswordDialogOpen(true)} className="rounded-md gap-2 py-2 text-xs font-bold"><Lock className="w-3.5 h-3.5" /> Passwort ändern</DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem onSelect={handleLogout} className="rounded-md gap-2 py-2 text-xs font-bold text-red-600"><LogOut className="w-3.5 h-3.5" /> Abmelden</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="rounded-xl max-w-sm border-none shadow-2xl p-0 overflow-hidden bg-white">
          <DialogHeader className="p-6 bg-slate-900 text-white">
            <div className="flex items-center gap-3">
              <Lock className="w-6 h-6 text-primary" />
              <DialogTitle className="text-base font-bold uppercase">Passwort ändern</DialogTitle>
            </div>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Neues Passwort</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="rounded-md h-10 border-slate-200" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Bestätigen</Label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="rounded-md h-10 border-slate-200" />
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t">
            <Button onClick={handleUpdatePassword} disabled={isUpdatingPassword} className="rounded-md font-bold uppercase text-[10px] h-10 w-full shadow-lg">
              Passwort aktualisieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}