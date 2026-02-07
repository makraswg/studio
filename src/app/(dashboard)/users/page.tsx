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
  UserCircle
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
import { saveCollectionRecord, deleteCollectionRecord, promoteUserToAdminAction } from '@/app/actions/mysql-actions';
import { logAuditEventAction } from '@/app/actions/audit-actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { exportUsersExcel } from '@/lib/export-utils';
import { Card, CardContent } from '@/components/ui/card';

export default function UsersPage() {
  const db = useFirestore();
  const router = useRouter();
  const { user: authUser } = useAuthUser();
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  
  const [isDialogOpen, setIsAddOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isQuickAssignOpen, setIsQuickAssignOpen] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Form State
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [tenantId, setTenantId] = useState('');

  // Quick Assignment State
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

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const handleQuickAssign = async () => {
    if (!selectedUser || !qaEntitlementId) return;
    
    setIsSavingAssignment(true);
    const assId = `ass-${Math.random().toString(36).substring(2, 9)}`;
    const assData = {
      id: assId,
      userId: selectedUser.id,
      entitlementId: qaEntitlementId,
      tenantId: selectedUser.tenantId || 'global',
      status: 'active',
      grantedBy: authUser?.email || 'system',
      grantedAt: new Date().toISOString(),
      validFrom: new Date().toISOString().split('T')[0],
      validUntil: qaValidUntil,
      ticketRef: 'QUICK-ASSIGN',
      notes: 'Direktzuweisung über Benutzerverzeichnis.',
      syncSource: 'manual'
    };

    try {
      if (dataSource === 'mysql') {
        const res = await saveCollectionRecord('assignments', assId, assData);
        if (!res.success) throw new Error(res.error || "MySQL Fehler beim Speichern");
      } else {
        setDocumentNonBlocking(doc(db, 'assignments', assId), assData);
      }

      const role = entitlements?.find(e => e.id === qaEntitlementId);
      const res = resources?.find(r => r.id === role?.resourceId);
      await logAuditEventAction(dataSource, {
        tenantId: selectedUser.tenantId || 'global',
        actorUid: authUser?.email || 'system',
        action: `Rolle zugewiesen: ${res?.name} / ${role?.name}`,
        entityType: 'assignment',
        entityId: selectedUser.id,
        after: assData
      });

      toast({ title: "Berechtigung zugewiesen" });
      setIsQuickAssignOpen(false);
      setQaResourceId('');
      setQaEntitlementId('');
      setQaValidUntil('');
      
      setTimeout(() => { refreshAssignments(); refreshAudit(); }, 300);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler beim Speichern", description: e.message });
    } finally {
      setIsSavingAssignment(false);
    }
  };

  const handlePromoteToAdmin = async (userId: string) => {
    setIsPromoting(true);
    try {
      const res = await promoteUserToAdminAction(userId, dataSource);
      if (res.success) {
        toast({ title: "Zum Administrator befördert", description: "Der Login ist nun via LDAP möglich." });
      } else {
        throw new Error(res.error || "Beförderung fehlgeschlagen");
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsPromoting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (dataSource === 'mysql') await deleteCollectionRecord('users', selectedUser.id);
    else deleteDocumentNonBlocking(doc(db, 'users', selectedUser.id));

    await logAuditEventAction(dataSource, {
      tenantId: selectedUser.tenantId || 'global',
      actorUid: authUser?.email || 'system',
      action: 'Benutzer gelöscht',
      entityType: 'user',
      entityId: selectedUser.id,
      before: selectedUser
    });

    toast({ title: "Benutzer gelöscht" });
    setIsDeleteAlertOpen(false);
    setSelectedUser(null);
    setTimeout(() => { refreshUsers(); refreshAudit(); }, 200);
  };

  const handleLdapSync = async () => {
    setIsSyncing(true);
    const timestamp = new Date().toISOString();
    let syncCount = 0;
    try {
      const mappedEntitlements = entitlements?.filter(e => !!e.externalMapping) || [];
      for (const user of (users || [])) {
        if (activeTenantId !== 'all' && user.tenantId !== activeTenantId) continue;
        const mockAdGroups = user.adGroups || []; 
        for (const ent of mappedEntitlements) {
          const hasGroup = mockAdGroups.includes(ent.externalMapping!);
          const existingAssignment = assignments?.find(a => a.userId === user.id && a.entitlementId === ent.id);
          if (hasGroup && (!existingAssignment || existingAssignment.status === 'removed')) {
            const assId = `ldap-${user.id}-${ent.id}`.substring(0, 50);
            const assData = {
              id: assId,
              userId: user.id,
              entitlementId: ent.id,
              tenantId: user.tenantId,
              status: 'active',
              grantedBy: 'LDAP-Sync',
              grantedAt: timestamp,
              syncSource: 'ldap',
              notes: `Auto-Zuweisung via AD Gruppe: ${ent.externalMapping}`
            };
            if (dataSource === 'mysql') await saveCollectionRecord('assignments', assId, assData);
            else setDocumentNonBlocking(doc(db, 'assignments', assId), assData);
            syncCount++;
          }
        }
      }

      if (syncCount > 0) {
        await logAuditEventAction(dataSource, {
          tenantId: activeTenantId === 'all' ? 'global' : activeTenantId,
          actorUid: authUser?.email || 'system',
          action: `LDAP Sync durchgeführt: ${syncCount} Zuweisungen aktualisiert.`,
          entityType: 'system',
          entityId: 'ldap-sync'
        });
      }

      toast({ title: "LDAP & Gruppen Sync abgeschlossen", description: `${syncCount} Änderungen vorgenommen.` });
      setTimeout(() => { refreshUsers(); refreshAssignments(); refreshAudit(); setIsSyncing(false); }, 500);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Sync Fehler", description: e.message });
      setIsSyncing(false);
    }
  };

  const resetForm = () => {
    setSelectedUser(null);
    setDisplayName('');
    setEmail('');
    setDepartment('');
    setTenantId(activeTenantId !== 'all' ? activeTenantId : '');
  };

  const openEdit = (user: any) => {
    setSelectedUser(user);
    setDisplayName(user.displayName);
    setEmail(user.email);
    setDepartment(user.department || '');
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
    <div className="space-y-10 pb-20 animate-in fade-in duration-700 slide-in-from-bottom-4">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-8 bg-gradient-to-r from-transparent via-slate-50/50 to-transparent">
        <div>
          <Badge className="mb-2 rounded-full px-3 py-0 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border-none">IAM Directory</Badge>
          <h1 className="text-4xl font-headline font-bold tracking-tight text-slate-900 dark:text-white">Benutzerverzeichnis</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Verwaltung der Identitäten für {activeTenantId === 'all' ? 'alle Standorte' : getTenantSlug(activeTenantId)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="h-11 rounded-2xl font-bold uppercase text-[10px] tracking-widest px-6 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all active:scale-95" onClick={() => exportUsersExcel(filteredUsers, tenants || [])}>
            <Download className="w-4 h-4 mr-2 text-primary" /> Excel
          </Button>
          <Button variant="outline" className="h-11 rounded-2xl font-bold uppercase text-[10px] tracking-widest px-6 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all text-blue-600 dark:text-blue-400 active:scale-95" onClick={handleLdapSync} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} LDAP Sync
          </Button>
          <Button className="h-11 rounded-2xl font-bold uppercase text-[10px] tracking-widest px-8 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all active:scale-95" onClick={() => { resetForm(); setIsAddOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Benutzer anlegen
          </Button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="relative lg:col-span-6">
          <Label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1 mb-2 block tracking-widest">Suchen</Label>
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Name oder E-Mail suchen..." 
              className="pl-11 h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:bg-white transition-all shadow-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="lg:col-span-3">
          <Label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1 mb-2 block tracking-widest">Status</Label>
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
            {['all', 'active', 'disabled'].map(f => (
              <button 
                key={f} 
                className={cn(
                  "flex-1 h-9 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                  activeStatusFilter === f ? "bg-white dark:bg-slate-800 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
                onClick={() => setActiveStatusFilter(f as any)}
              >
                {f === 'all' ? 'Alle' : f === 'active' ? 'Aktiv' : 'Inaktiv'}
              </button>
            ))}
          </div>
        </div>
        <div className="lg:col-span-3">
          <Label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1 mb-2 block tracking-widest">Herkunft</Label>
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
            {['all', 'ad', 'manual'].map(f => (
              <button 
                key={f} 
                className={cn(
                  "flex-1 h-9 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                  activeSourceFilter === f ? "bg-white dark:bg-slate-800 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
                onClick={() => setActiveSourceFilter(f as any)}
              >
                {f === 'all' ? 'Alle' : f === 'ad' ? 'AD' : 'Manuell'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:hidden gap-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-[200px] w-full rounded-3xl" />)}
          </div>
          <div className="hidden md:block">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border overflow-hidden p-8 space-y-4">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredUsers?.map((user: any) => {
              const isEnabled = user.enabled === true || user.enabled === 1 || user.enabled === "1";
              const isAd = user.externalId && !user.externalId.startsWith('MANUAL_');
              const userAssignments = assignments?.filter(a => a.userId === user.id && a.status === 'active') || [];
              
              return (
                <Card key={user.id} className="border-none shadow-lg rounded-3xl overflow-hidden bg-white dark:bg-slate-900 group transition-all hover:shadow-xl hover:scale-[1.01]">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary font-bold text-lg">
                          {user.displayName?.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white" onClick={() => { setSelectedUser(user); setIsDetailOpen(true); }}>{user.displayName}</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user.department || 'Keine Abteilung'}</p>
                        </div>
                      </div>
                      <Badge className={cn("rounded-full border-none px-3 text-[9px] font-black uppercase", isEnabled ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
                        {isEnabled ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Mail className="w-3.5 h-3.5" /> {user.email}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Building2 className="w-3.5 h-3.5" /> {getTenantSlug(user.tenantId)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="rounded-full text-[9px] font-bold uppercase border-slate-200 dark:border-slate-800 h-6 px-3">
                          {userAssignments.length} Rollen
                        </Badge>
                        {isAd && <Badge className="bg-blue-50 text-blue-600 border-none rounded-full text-[9px] font-black uppercase h-6 px-3"><Network className="w-3 h-3 mr-1" /> AD Sync</Badge>}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button className="flex-1 h-10 rounded-xl font-bold uppercase text-[10px] tracking-widest active:scale-95 transition-transform" onClick={() => { setSelectedUser(user); setQaResourceId(''); setQaEntitlementId(''); setIsQuickAssignOpen(true); }}>
                        <UserPlus className="w-3.5 h-3.5 mr-2" /> Zuweisen
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-10 h-10 p-0 rounded-xl border-slate-200 dark:border-slate-800 active:scale-95 transition-transform"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl w-56 p-2 shadow-2xl">
                          <DropdownMenuItem onSelect={() => { setSelectedUser(user); setIsDetailOpen(true); }} className="rounded-xl py-2.5 gap-3"><Info className="w-4 h-4 text-primary" /> Details & Verlauf</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openEdit(user)} className="rounded-xl py-2.5 gap-3"><Pencil className="w-4 h-4 text-slate-400" /> Bearbeiten</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600 rounded-xl py-2.5 gap-3" onSelect={() => { setSelectedUser(user); setIsDeleteAlertOpen(true); }}><Trash2 className="w-4 h-4" /> Löschen</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-950/50">
                <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                  <TableHead className="py-6 px-8 font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">Identität</TableHead>
                  <TableHead className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">Mandant</TableHead>
                  <TableHead className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">Abteilung</TableHead>
                  <TableHead className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">Rollen</TableHead>
                  <TableHead className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">Status</TableHead>
                  <TableHead className="text-right px-8 font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers?.map((user: any) => {
                  const isEnabled = user.enabled === true || user.enabled === 1 || user.enabled === "1";
                  const isAd = user.externalId && !user.externalId.startsWith('MANUAL_');
                  const userAssignments = assignments?.filter(a => a.userId === user.id && a.status === 'active') || [];
                  const adCount = userAssignments.filter(a => a.syncSource === 'ldap').length;
                  
                  return (
                    <TableRow key={user.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800 transition-colors">
                      <TableCell className="py-5 px-8">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary font-black text-sm transition-transform group-hover:rotate-3">
                            {user.displayName?.charAt(0)}
                          </div>
                          <div>
                            <div 
                              className="font-bold text-sm text-slate-800 dark:text-slate-100 cursor-pointer hover:text-primary transition-colors flex items-center gap-2"
                              onClick={() => { setSelectedUser(user); setIsDetailOpen(true); }}
                            >
                              {user.displayName}
                              <Info className="w-3.5 h-3.5 opacity-0 group-hover:opacity-30 transition-opacity" />
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full text-[9px] font-black uppercase border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 px-3 h-6">
                          {getTenantSlug(user.tenantId)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{user.department || '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs text-slate-800 dark:text-slate-200">{userAssignments.length}</span>
                          {adCount > 0 && <Badge className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-none rounded-full text-[8px] font-black uppercase h-5 px-2"><Network className="w-2.5 h-2.5 mr-1" /> {adCount} AD</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-[9px] font-black uppercase rounded-full border-none px-3 h-6", isEnabled ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400")}>
                          {isEnabled ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right px-8">
                        <div className="flex justify-end items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-9 rounded-xl text-[10px] font-black uppercase tracking-wider gap-2 opacity-0 group-hover:opacity-100 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 transition-all active:scale-95"
                            onClick={() => { setSelectedUser(user); setQaResourceId(''); setQaEntitlementId(''); setIsQuickAssignOpen(true); }}
                          >
                            <UserPlus className="w-4 h-4" /> Zuweisen
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-transform"><MoreHorizontal className="w-5 h-5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-2xl border-slate-100 dark:border-slate-800">
                              <DropdownMenuItem onSelect={() => { setSelectedUser(user); setIsDetailOpen(true); }} className="rounded-xl py-2.5 gap-3"><Info className="w-4 h-4 text-primary" /> Details & Historie</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => openEdit(user)} className="rounded-xl py-2.5 gap-3"><Pencil className="w-4 h-4 text-slate-400" /> Bearbeiten</DropdownMenuItem>
                              {isAd && (
                                <DropdownMenuItem 
                                  className="text-blue-600 dark:text-blue-400 font-bold rounded-xl py-2.5 gap-3"
                                  onSelect={() => handlePromoteToAdmin(user.id)}
                                  disabled={isPromoting}
                                >
                                  <Shield className="w-4 h-4" /> Zum Admin befördern
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator className="my-2" />
                              <DropdownMenuItem className="text-red-600 dark:text-red-400 rounded-xl py-2.5 gap-3" onSelect={() => { setSelectedUser(user); setIsDeleteAlertOpen(true); }}>
                                <Trash2 className="w-4 h-4" /> Löschen
                              </DropdownMenuItem>
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
        </>
      )}

      {/* Dialogs */}
      <Dialog open={isDialogOpen} onOpenChange={(val) => { if (!val) setIsAddOpen(false); }}>
        <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden bg-white dark:bg-slate-900">
          <DialogHeader className="p-8 bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800">
            <DialogTitle className="text-xl font-headline font-bold text-slate-800 dark:text-white uppercase tracking-tight">
              {selectedUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 uppercase font-bold tracking-widest mt-1">Identitäts-Stammdaten</DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Anzeigename</Label>
              <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="rounded-xl h-12 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950" placeholder="Max Mustermann" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">E-Mail Adresse</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} className="rounded-xl h-12 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950" placeholder="name@firma.de" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Abteilung</Label>
                <Input value={department} onChange={e => setDepartment(e.target.value)} className="rounded-xl h-12 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950" placeholder="IT" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Mandant</Label>
                <Select value={tenantId} onValueChange={setTenantId}>
                  <SelectTrigger className="rounded-xl h-12 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950">
                    <SelectValue placeholder="Wählen..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-100 dark:border-slate-800">
                    {tenants?.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="p-8 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800">
            <Button variant="ghost" onClick={() => setIsAddOpen(false)} className="rounded-xl text-[10px] font-black uppercase px-6">Abbrechen</Button>
            <Button onClick={handleSaveUser} className="rounded-xl font-black uppercase text-[10px] tracking-widest px-10 h-12 shadow-lg shadow-primary/20 active:scale-95 transition-transform">
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Assignment Dialog */}
      <Dialog open={isQuickAssignOpen} onOpenChange={setIsQuickAssignOpen}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden bg-white dark:bg-slate-900 border-none shadow-2xl">
          <DialogHeader className="p-8 bg-primary/5 dark:bg-primary/10 border-b border-primary/10">
            <DialogTitle className="text-xl font-headline font-bold text-primary uppercase">Berechtigung zuweisen</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 uppercase font-bold mt-1">Direktzuweisung für {selectedUser?.displayName}</DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">1. System auswählen</Label>
              <Select value={qaResourceId} onValueChange={(val) => { setQaResourceId(val); setQaEntitlementId(''); }}>
                <SelectTrigger className="rounded-xl h-12 border-slate-200 dark:border-slate-800">
                  <SelectValue placeholder="System wählen..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-100">
                  <ScrollArea className="h-48">
                    {resources?.filter(r => r.tenantId === 'global' || r.tenantId === selectedUser?.tenantId).map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        <div className="flex items-center gap-2"><Layers className="w-3.5 h-3.5 text-primary" /> {r.name}</div>
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>

            {qaResourceId && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">2. Rolle wählen</Label>
                <Select value={qaEntitlementId} onValueChange={setQaEntitlementId}>
                  <SelectTrigger className="rounded-xl h-12 border-slate-200 dark:border-slate-800">
                    <SelectValue placeholder="Rolle wählen..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-100">
                    <ScrollArea className="h-48">
                      {entitlements?.filter(e => e.resourceId === qaResourceId).map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          <div className="flex items-center gap-2">
                            {!!(e.isAdmin === true || e.isAdmin === 1 || e.isAdmin === "1") && <ShieldAlert className="w-3.5 h-3.5 text-red-600" />}
                            {e.name}
                          </div>
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Gültig bis (Optional)</Label>
              <Input type="date" value={qaValidUntil} onChange={e => setQaValidUntil(e.target.value)} className="rounded-xl h-12 border-slate-200 dark:border-slate-800" />
            </div>
          </div>
          <DialogFooter className="p-8 bg-slate-50 dark:bg-slate-800/50 border-t">
            <Button variant="ghost" onClick={() => setIsQuickAssignOpen(false)} className="rounded-xl text-[10px] font-black uppercase">Abbrechen</Button>
            <Button onClick={handleQuickAssign} disabled={!qaEntitlementId || isSavingAssignment} className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8 h-12 shadow-lg shadow-primary/20 active:scale-95 transition-transform">
              {isSavingAssignment ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Zuweisung erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 rounded-[3rem] overflow-hidden bg-white dark:bg-slate-950 border-none shadow-2xl">
          <DialogHeader className="p-10 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center text-primary font-black text-3xl shadow-xl shadow-black/20">
                {selectedUser?.displayName?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-3xl font-headline font-bold tracking-tight truncate">{selectedUser?.displayName}</DialogTitle>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-bold uppercase mt-2 tracking-widest">
                  <span className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> {selectedUser?.email}</span>
                  <span className="w-1 h-1 bg-slate-700 rounded-full" />
                  <span className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5" /> {getTenantSlug(selectedUser?.tenantId)}</span>
                </div>
              </div>
            </div>
          </DialogHeader>
          <Tabs defaultValue="access" className="flex-1 flex flex-col min-h-0">
            <div className="px-10 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <TabsList className="h-14 bg-transparent gap-8 p-0">
                <TabsTrigger value="access" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-0 gap-2 text-[10px] font-black uppercase tracking-widest">
                  <ShieldCheck className="w-4 h-4" /> Aktive Zugriffe
                </TabsTrigger>
                <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-0 gap-2 text-[10px] font-black uppercase tracking-widest">
                  <History className="w-4 h-4" /> Aktivitätsverlauf
                </TabsTrigger>
              </TabsList>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-10">
                <TabsContent value="access" className="mt-0 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {assignments?.filter(a => a.userId === selectedUser?.id && a.status === 'active').map(a => {
                    const ent = entitlements?.find(e => e.id === a.entitlementId);
                    const res = resources?.find(r => r.id === ent?.resourceId);
                    return (
                      <div key={a.id} className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 transition-all hover:scale-[1.02] hover:shadow-md">
                        <div className="flex items-center gap-4">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", ent?.isAdmin ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600")}>
                            {ent?.isAdmin ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{res?.name}</p>
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{ent?.name}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </TabsContent>
                <TabsContent value="history" className="mt-0">
                  <div className="space-y-8">
                    {auditLogs?.filter(log => log.entityId === selectedUser?.id || (log.entityType === 'user' && log.entityId === selectedUser?.id)).map((log, i) => (
                      <div key={log.id} className="relative pl-8 pb-8 border-l-2 border-slate-100 dark:border-slate-800 last:border-0 last:pb-0">
                        <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border-4 border-primary" />
                        <div className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 tracking-widest">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}</div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{log.action}</p>
                        <p className="text-[10px] font-medium text-slate-500 mt-1 uppercase tracking-wider">Akteur: {log.actorUid}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
          <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end shrink-0">
            <Button onClick={() => setIsDetailOpen(false)} className="rounded-xl h-12 px-12 font-black uppercase text-[10px] tracking-widest active:scale-95 transition-transform">Schließen</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-headline font-bold text-red-600 uppercase tracking-tight">Benutzer löschen?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 font-medium leading-relaxed pt-2">
              Dies entfernt die Identität von <strong>{selectedUser?.displayName}</strong> permanent aus dem System. Alle verknüpften Zugriffe bleiben in der Historie als "Removed" markiert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6">
            <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px] tracking-widest h-12 px-8 active:scale-95 transition-transform">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-red-600 hover:bg-red-700 rounded-xl font-black uppercase text-[10px] tracking-widest h-12 px-10 active:scale-95 transition-transform">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
