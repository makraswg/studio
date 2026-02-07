"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  RefreshCw,
  Plus,
  MoreHorizontal,
  Loader2,
  ShieldCheck,
  Trash2,
  Pencil,
  Network,
  User as UserIcon,
  Info,
  History,
  ShieldAlert,
  Clock,
  UserPlus,
  Layers,
  Shield,
  Download,
  MoreVertical,
  Building2,
  Mail,
  ArrowRight,
  Activity,
  UserCircle,
  Briefcase,
  Filter
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { 
  useFirestore, 
  setDocumentNonBlocking, 
  deleteDocumentNonBlocking,
  useUser as useAuthUser
} from '@/firebase';
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { logAuditEventAction } from '@/app/actions/audit-actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { exportUsersExcel } from '@/lib/export-utils';

export default function UsersPage() {
  const db = useFirestore();
  const router = useRouter();
  const { user: authUser } = useAuthUser();
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  
  const [isDialogOpen, setIsAddOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isQuickAssignOpen, setIsQuickAssignOpen] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [userTitle, setUserTitle] = useState('');

  const [qaResourceId, setQaResourceId] = useState('');
  const [qaEntitlementId, setQaEntitlementId] = useState('');
  const [qaValidUntil, setQaValidUntil] = useState('');

  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [activeSourceFilter, setActiveSourceFilter] = useState<'all' | 'ad' | 'manual'>('all');

  const { data: users, isLoading, refresh: refreshUsers } = usePluggableCollection<any>('users');
  const { data: tenants } = usePluggableCollection<any>('tenants');
  const { data: entitlements } = usePluggableCollection<any>('entitlements');
  const { data: resources } = usePluggableCollection<any>('resources');
  const { data: assignments, refresh: refreshAssignments } = usePluggableCollection<any>('assignments');
  const { data: auditLogs, refresh: refreshAudit } = usePluggableCollection<any>('auditEvents');
  const { data: jobTitles } = usePluggableCollection<any>('jobTitles');
  const { data: departments } = usePluggableCollection<any>('departments');

  useEffect(() => { setMounted(true); }, []);

  const getTenantSlug = (id?: string | null) => {
    if (!id || id === 'null' || id === 'undefined') return '—';
    const tenant = tenants?.find(t => t.id === id);
    return tenant ? tenant.slug : id;
  };

  const handleSaveUser = async () => {
    if (!displayName || !email || !tenantId) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte alle Pflichtfelder ausfüllen." });
      return;
    }

    const userId = selectedUser?.id || `u-${Math.random().toString(36).substring(2, 9)}`;
    const isNew = !selectedUser;
    
    const userData = {
      ...selectedUser,
      id: userId,
      displayName,
      email,
      department,
      tenantId,
      title: userTitle,
      enabled: selectedUser ? selectedUser.enabled : true,
      externalId: selectedUser?.externalId || `MANUAL_${userId}`,
      lastSyncedAt: new Date().toISOString()
    };

    if (dataSource === 'mysql') await saveCollectionRecord('users', userId, userData);
    else setDocumentNonBlocking(doc(db, 'users', userId), userData);

    await logAuditEventAction(dataSource, {
      tenantId: tenantId,
      actorUid: authUser?.email || 'system',
      action: isNew ? 'Benutzer erstellt' : 'Benutzer aktualisiert',
      entityType: 'user',
      entityId: userId,
      after: userData
    });

    toast({ title: selectedUser ? "Benutzer aktualisiert" : "Benutzer angelegt" });
    setIsAddOpen(false);
    resetForm();
    setTimeout(() => { refreshUsers(); refreshAudit(); }, 200);
  };

  const resetForm = () => {
    setSelectedUser(null);
    setDisplayName('');
    setEmail('');
    setDepartment('');
    setUserTitle('');
    setTenantId(activeTenantId !== 'all' ? activeTenantId : '');
  };

  const openEdit = (user: any) => {
    setSelectedUser(user);
    setDisplayName(user.displayName);
    setEmail(user.email);
    setDepartment(user.department || '');
    setUserTitle(user.title || '');
    setTenantId(user.tenantId);
    setIsAddOpen(true);
  };

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter((user: any) => {
      if (activeTenantId !== 'all' && user.tenantId !== activeTenantId) return false;
      const matchesSearch = (user.displayName || '').toLowerCase().includes(search.toLowerCase()) || (user.email || '').toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;
      const isEnabled = user.enabled === true || user.enabled === 1 || user.enabled === "1";
      if (activeStatusFilter === 'active' && !isEnabled) return false;
      if (activeStatusFilter === 'disabled' && isEnabled) return false;
      const isAd = user.externalId && !user.externalId.startsWith('MANUAL_');
      if (activeSourceFilter === 'ad' && !isAd) return false;
      if (activeSourceFilter === 'manual' && isAd) return false;
      return true;
    });
  }, [users, search, activeTenantId, activeStatusFilter, activeSourceFilter]);

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
            <UserCircle className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold border-none">IAM Directory</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white">Benutzerverzeichnis</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Verwaltung der Identitäten für {activeTenantId === 'all' ? 'alle Standorte' : getTenantSlug(activeTenantId)}.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs px-4 border-slate-200" onClick={() => exportUsersExcel(filteredUsers, tenants || [])}>
            <Download className="w-3.5 h-3.5 mr-2 text-primary" /> Excel
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-primary hover:bg-primary/90 text-white shadow-sm" onClick={() => { resetForm(); setIsAddOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-2" /> Benutzer anlegen
          </Button>
        </div>
      </div>

      <div className="flex flex-row items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Name oder E-Mail suchen..." 
            className="pl-9 h-9 rounded-md border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-none text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-md border border-slate-200 dark:border-slate-700 h-9 shrink-0">
          {['all', 'active', 'disabled'].map(f => (
            <button 
              key={f} 
              className={cn(
                "px-4 h-full text-[9px] font-bold rounded-sm transition-all whitespace-nowrap",
                activeStatusFilter === f ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
              onClick={() => setActiveStatusFilter(f as any)}
            >
              {f === 'all' ? 'Alle' : f === 'active' ? 'Aktiv' : f === 'disabled' ? 'Inaktiv' : ''}
            </button>
          ))}
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-md border border-slate-200 dark:border-slate-700 h-9 shrink-0">
          <Select value={activeSourceFilter} onValueChange={(v: any) => setActiveSourceFilter(v)}>
            <SelectTrigger className="h-full border-none shadow-none text-[9px] font-bold min-w-[120px] bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Alle Quellen</SelectItem>
              <SelectItem value="ad" className="text-xs">LDAP/AD Sync</SelectItem>
              <SelectItem value="manual" className="text-xs">Manueller Eintrag</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary opacity-20" /></div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400">Identität</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400">Mandant</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400">Abteilung / Stelle</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400">Status</TableHead>
                <TableHead className="text-right px-6 font-bold text-[11px] text-slate-400">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers?.map((user: any) => {
                const isEnabled = user.enabled === true || user.enabled === 1 || user.enabled === "1";
                return (
                  <TableRow key={user.id} className="group hover:bg-slate-50 transition-colors border-b last:border-0">
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-primary font-bold text-xs">
                          {user.displayName?.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-800 cursor-pointer hover:text-primary transition-colors" onClick={() => { setSelectedUser(user); setIsDetailOpen(true); }}>
                            {user.displayName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-full text-[8px] font-bold border-slate-200 text-slate-500 px-2 h-5">
                        {getTenantSlug(user.tenantId)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-600">{user.department || '—'}</span>
                        <span className="text-[9px] font-medium text-slate-400 italic">{user.title || 'Keine Angabe'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[8px] font-bold rounded-full border-none px-2 h-5", isEnabled ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
                        {isEnabled ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end items-center gap-1.5">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 rounded-md text-[9px] font-bold gap-1.5 opacity-0 group-hover:opacity-100 hover:bg-emerald-50 hover:text-emerald-600 transition-all active:scale-95"
                          onClick={() => { setSelectedUser(user); setIsQuickAssignOpen(true); }}
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Zuweisen
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-slate-100"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 rounded-lg p-1 shadow-xl border">
                            <DropdownMenuItem onSelect={() => { setSelectedUser(user); setIsDetailOpen(true); }} className="rounded-md py-2 gap-2 text-xs font-bold"><Info className="w-3.5 h-3.5 text-primary" /> Details</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openEdit(user)} className="rounded-md py-2 gap-2 text-xs font-bold"><Pencil className="w-3.5 h-3.5 text-slate-400" /> Bearbeiten</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
