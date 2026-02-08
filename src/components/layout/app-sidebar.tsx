
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
  ChevronRight,
  ChevronDown,
  Building2,
  Briefcase,
  Sparkles,
  BookOpen,
  Mail,
  FileCode,
  RefreshCw,
  Ticket,
  Scale,
  Database,
  Search,
  Zap,
  Info,
  ListFilter,
  ClipboardList,
  FileStack,
  HardDrive,
  Map,
  UserCircle
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(pathname.startsWith('/settings'));

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const coreItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Aufgaben-Board', href: '/tasks', icon: ClipboardList },
    { name: 'Organisation & Struktur', href: '/settings/organization', icon: Building2 },
    { name: 'Ressourcenkatalog', href: '/resources', icon: Layers },
    { name: 'Audit Log', href: '/audit', icon: Activity },
  ];

  const accessHubItems = [
    { name: 'Benutzerverzeichnis', href: '/users', icon: Users },
    { name: 'Rollenverwaltung', href: '/roles', icon: ShieldCheck },
    { name: 'Zuweisungsgruppen', href: '/groups', icon: Workflow },
    { name: 'Einzelzuweisungen', href: '/assignments', icon: Shield },
    { name: 'Jira Gateway', href: '/jira-sync', icon: RefreshCw },
    { name: 'Lifecycle Hub', href: '/lifecycle', icon: UserPlus },
    { name: 'Access Reviews', href: '/reviews', icon: CheckCircle },
  ];

  const hubModules = [
    { name: 'Datenmanagement', href: '/features', icon: ListFilter },
    { name: 'Prozessübersicht', href: '/processhub', icon: Workflow },
    { name: 'Prozesslandkarte', href: '/processhub/map', icon: Network },
  ];

  const riskItems = [
    { name: 'Risikoinventar', href: '/risks', icon: BarChart3 },
    { name: 'Gefährdungskatalog', href: '/risks/catalog', icon: Library },
    { name: 'Maßnahmenplan', href: '/risks/measures', icon: ClipboardList },
    { name: 'Kontroll-Monitoring', href: '/risks/controls', icon: ShieldCheck },
    { name: 'Berichte & Analyse', href: '/risks/reports', icon: PieChart },
  ];

  const policyHubItems = [
    { name: 'PolicyHub', href: '/gdpr', icon: FileCheck },
    { name: 'KI Identity Audit', href: '/iam-audit', icon: BrainCircuit },
  ];

  const settingSubItems = [
    { name: 'Daten-Landkarte', href: '/settings/data-map', icon: Network },
    { name: 'Plattform-Rollen', href: '/settings/roles', icon: Lock },
    { name: 'Administratoren', href: '/settings/pusers', icon: Users },
    { name: 'User Experience', href: '/settings/ux', icon: Sparkles },
    { name: 'Medien-Governance', href: '/settings/media', icon: FileStack },
    { name: 'Identität & Sync', href: '/settings/sync', icon: Network },
    { name: 'Service Partner & Externe', href: '/settings/owners', icon: Building2 },
    { name: 'Ressourcen-Optionen', href: '/settings/resources', icon: Settings2 },
    { name: 'Regulatorik & Normen', href: '/settings/compliance', icon: Scale },
    { name: 'Jira Gateway', href: '/settings/integrations', icon: RefreshCw },
    { name: 'BookStack Export', href: '/settings/bookstack', icon: BookOpen },
    { name: 'KI Access Advisor', href: '/settings/ai', icon: BrainCircuit },
    { name: 'Datenschutz-Basis', href: '/settings/dsgvo', icon: FileCheck },
    { name: 'E-Mail (SMTP)', href: '/settings/email', icon: Mail },
    { name: 'Katalog-Import', href: '/settings/data', icon: FileCode },
  ];

  if (!mounted) return null;

  const NavLink = ({ item, activeColor = "bg-primary", isSubItem = false }: { item: any, activeColor?: string, isSubItem?: boolean }) => {
    const isActive = pathname === item.href || (item.href !== '/dashboard' && !isSubItem && pathname.startsWith(item.href) && !pathname.startsWith('/processhub/map') && item.href !== '/processhub/map');
    const isExact = pathname === item.href;
    const active = isSubItem ? isExact : isActive;

    return (
      <Link 
        key={item.name} 
        href={item.href} 
        className={cn(
          "flex items-center justify-between px-3 py-2 rounded-md transition-all group",
          active 
            ? `${activeColor} text-white shadow-sm` 
            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
          isSubItem && "pl-9"
        )}
      >
        <div className="flex items-center gap-2.5">
          <item.icon className={cn(isSubItem ? "w-3.5 h-3.5" : "w-4 h-4", "transition-transform", active ? "text-white" : "text-slate-400")} />
          <span className={cn(isSubItem ? "text-[10px]" : "text-[11px]", "font-bold")}>{item.name}</span>
        </div>
        {active && !isSubItem && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
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
            <span className="font-headline font-bold text-base tracking-tight block text-slate-900 dark:text-white leading-none">ComplianceHub</span>
            <div className="mt-1.5 relative inline-block group cursor-default">
              <span className="text-[11px] text-primary font-script block transition-transform duration-300">
                Struktur statt Bauchgefühl
              </span>
              <svg className="absolute -bottom-1.5 left-0 w-full h-1.5 text-primary/30" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M1 5C20 1 80 1 99 5" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <Separator className="mx-6 bg-slate-50 my-2" />

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-8 py-4">
          <div className="space-y-1">
            <p className="px-3 mb-2 text-[10px] font-bold text-slate-400">Plattform Core</p>
            {coreItems.map((item) => <NavLink key={item.name} item={item} />)}
          </div>

          <div className="space-y-1">
            <p className="px-3 mb-2 text-[10px] font-bold text-slate-400">AccessHub</p>
            {accessHubItems.map((item) => <NavLink key={item.name} item={item} />)}
          </div>

          <div className="space-y-1">
            <p className="px-3 mb-2 text-[10px] font-bold text-slate-400">WorkflowHub</p>
            {hubModules.map((item) => <NavLink key={item.name} item={item} />)}
          </div>

          <div className="space-y-1">
            <p className="px-3 mb-2 text-[10px] font-bold text-slate-400">PolicyHub</p>
            {policyHubItems.map((item) => <NavLink key={item.name} item={item} activeColor="bg-emerald-600" />)}
          </div>

          <div className="space-y-1">
            <p className="px-3 mb-2 text-[10px] font-bold text-slate-400">RiskHub</p>
            {riskItems.map((item) => <NavLink key={item.name} item={item} activeColor="bg-accent" />)}
          </div>

          <div className="space-y-1">
            <p className="px-3 mb-2 text-[10px] font-bold text-slate-400">Admin</p>
            <NavLink item={{ name: 'Setup & Infra', href: '/setup', icon: Settings2 }} />
            
            <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen} className="space-y-1">
              <CollapsibleTrigger asChild>
                <button 
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-md transition-all group",
                    pathname.startsWith('/settings') ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Settings className={cn("w-4 h-4", pathname.startsWith('/settings') ? "text-primary" : "text-slate-400")} />
                    <span className="text-[11px] font-bold text-left">Systemeinstellungen</span>
                  </div>
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isSettingsOpen ? "rotate-180" : "")} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 overflow-hidden animate-in slide-in-from-top-1 duration-200">
                {settingSubItems.map((item) => <NavLink key={item.name} item={item} isSubItem />)}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </ScrollArea>

      <div className="p-3 border-t bg-slate-50/50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full h-auto p-2 justify-start items-center gap-3 rounded-lg hover:bg-white border border-transparent hover:border-slate-200">
              <Avatar className="h-8 w-8 rounded-md border shadow-inner">
                <AvatarFallback className="bg-primary text-white font-bold text-[10px]">{platformUser?.displayName?.charAt(0) || 'A'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden text-left">
                <p className="text-[11px] font-bold text-slate-900 truncate leading-tight">{platformUser?.displayName || 'Administrator'}</p>
                <p className="text-[9px] text-slate-400 font-bold mt-0.5">{platformUser?.role || 'User'}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-56 rounded-lg p-1 shadow-2xl">
            <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 px-2 py-1.5">System</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setIsPasswordDialogOpen(true)} className="rounded-md gap-2 py-2 text-xs font-bold"><Lock className="w-3.5 h-3.5" /> Passwort ändern</DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem onSelect={handleLogout} className="rounded-md gap-2 py-2 text-xs font-bold text-red-600"><LogOut className="w-3.5 h-3.5" /> Abmelden</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="rounded-xl max-sm border-none shadow-2xl p-0 overflow-hidden bg-white">
          <DialogHeader className="p-6 bg-slate-50 border-b">
            <div className="flex items-center gap-3">
              <Lock className="w-6 h-6 text-primary" />
              <DialogTitle className="text-base font-bold">Passwort ändern</DialogTitle>
            </div>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-400">Neues Passwort</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="rounded-md h-10 border-slate-200" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-400">Bestätigen</Label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="rounded-md h-10 border-slate-200" />
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t">
            <Button onClick={handleUpdatePassword} disabled={isUpdatingPassword} className="rounded-md font-bold text-xs h-10 w-full shadow-lg">
              Passwort aktualisieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
