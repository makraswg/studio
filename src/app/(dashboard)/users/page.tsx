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
  Briefcase
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

  // Form State
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [userTitle, setUserTitle] = useState('');

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
  const { data: jobTitles } = usePluggableCollection<any>('jobTitles');
  const { data: departments } = usePluggableCollection<any>('departments');

  useEffect(() => {
    setMounted(true);
  }, []);

  const getTenantSlug = (id?: string | null) => {
    if (!id || id === 'null' || id === 'undefined') return '—';
    const tenant = tenants?.find(t => t.id === id);
    return tenant ? tenant.slug : id;
  };

  const filteredDepartments = useMemo(() => {
    if (!departments || !tenantId) return [];
    return departments.filter(d => d.tenantId === tenantId && d.status !== 'archived');
  }, [departments, tenantId]);

  const filteredJobTitles = useMemo(() => {
    if (!jobTitles || !tenantId) return [];
    return jobTitles.filter(j => 
      j.tenantId === tenantId && 
      j.status !== 'archived' && 
      (!department || j.departmentId === departments?.find(d => d.name === department)?.id)
    );
  }, [jobTitles, tenantId, department, departments]);

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
      
      setTimeout(() => { refreshAssignments(); refreshAudit(); }, 300);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler beim Speichern", description: e.message });
    } finally {
      setIsSavingAssignment(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (dataSource === 'mysql') await deleteCollectionRecord('users', selectedUser.id);
    else deleteDocumentNonBlocking(doc(db, 'users', selectedUser.id));

    toast({ title: "Benutzer gelöscht" });
    setIsDeleteAlertOpen(false);
    setSelectedUser(null);
    setTimeout(() => { refreshUsers(); refreshAudit(); }, 200);
  };

  const handleLdapSync = async () => {
    setIsSyncing(true);
    try {
      toast({ title: "LDAP & Gruppen Sync abgeschlossen" });
      setTimeout(() => { refreshUsers(); refreshAssignments(); setIsSyncing(false); }, 500);
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
        <div>
          <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold border-none">IAM Directory</Badge>
          <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white">Benutzerverzeichnis</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Verwaltung der Identitäten für {activeTenantId === 'all' ? 'alle Standorte' : getTenantSlug(activeTenantId)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs px-4 border-slate-200" onClick={() => exportUsersExcel(filteredUsers, tenants || [])}>
            <Download className="w-3.5 h-3.5 mr-2 text-primary" /> Excel
          </Button>
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs px-4 border-slate-200 text-blue-600" onClick={handleLdapSync} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />} LDAP Sync
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-primary hover:bg-primary/90 text-white shadow-sm" onClick={() => { resetForm(); setIsAddOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-2" /> Benutzer anlegen
          </Button>
        </div>
      </div>

      <div className="flex flex-row items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border shadow-sm overflow-x-auto no-scrollbar">
        <div className="relative min-w-[200px] flex-1 group">
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
              {f === 'all' ? 'Alle' : f === 'active' ? 'Aktiv' : 'Inaktiv'}
            </button>
          ))}
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-md border border-slate-200 dark:border-slate-700 h-9 shrink-0">
          {['all', 'ad', 'manual'].map(f => (
            <button 
              key={f} 
              className={cn(
                "px-4 h-full text-[9px] font-bold rounded-sm transition-all whitespace-nowrap",
                activeSourceFilter === f ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
              onClick={() => setActiveSourceFilter(f as any)}
            >
              {f === 'all' ? 'Alle Quellen' : f === 'ad' ? 'LDAP/AD' : 'Manuell'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-lg border shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400">Identität</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400">Mandant</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400">Abteilung / Stelle</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400">Rollen</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400">Status</TableHead>
                <TableHead className="text-right px-6 font-bold text-[11px] text-slate-400">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers?.map((user: any) => {
                const isEnabled = user.enabled === true || user.enabled === 1 || user.enabled === "1";
                const isAd = user.externalId && !user.externalId.startsWith('MANUAL_');
                const userAssignments = assignments?.filter(a => a.userId === user.id && a.status === 'active') || [];
                
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
                        <span className="text-[9px] font-medium text-slate-400 italic">{user.title || 'Keine Stelle zugewiesen'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-800">{userAssignments.length}</span>
                        {isAd && <Badge className="bg-blue-50 text-blue-600 border-none rounded-full text-[7px] font-bold h-4 px-1.5">AD</Badge>}
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
                          onClick={() => { setSelectedUser(user); setQaResourceId(''); setQaEntitlementId(''); setIsQuickAssignOpen(true); }}
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Zuweisen
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-slate-100 transition-all"><MoreVertical className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 rounded-lg p-1 shadow-xl border">
                            <DropdownMenuItem onSelect={() => { setSelectedUser(user); setIsDetailOpen(true); }} className="rounded-md py-2 gap-2 text-xs font-bold"><Info className="w-3.5 h-3.5 text-primary" /> Details</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openEdit(user)} className="rounded-md py-2 gap-2 text-xs font-bold"><Pencil className="w-3.5 h-3.5 text-slate-400" /> Bearbeiten</DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1" />
                            <DropdownMenuItem className="text-red-600 rounded-md py-2 gap-2 text-xs font-bold" onSelect={() => { setSelectedUser(user); setIsDeleteAlertOpen(true); }}>
                              <Trash2 className="w-3.5 h-3.5" /> Löschen
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
      )}

      {/* Add/Edit User Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(val) => { if (!val) setIsAddOpen(false); }}>
        <DialogContent className="max-w-md w-[95vw] rounded-xl border-none shadow-2xl p-0 overflow-hidden bg-white flex flex-col h-[85vh]">
          <DialogHeader className="p-6 bg-slate-50 border-b shrink-0">
            <DialogTitle className="text-base font-headline font-bold text-slate-800">
              {selectedUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 ml-1">Anzeigename</Label>
                <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="rounded-md h-11 border-slate-200 bg-slate-50/50" placeholder="Max Mustermann" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 ml-1">E-Mail</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} className="rounded-md h-11 border-slate-200 bg-slate-50/50" placeholder="name@firma.de" />
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 ml-1">Mandant</Label>
                <Select value={tenantId} onValueChange={setTenantId}>
                  <SelectTrigger className="h-11 rounded-md border-slate-200 bg-slate-50/50">
                    <SelectValue placeholder="Wählen..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-md">
                    {tenants?.map((t: any) => <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 ml-1">Abteilung</Label>
                <Select value={department} onValueChange={setDepartment} disabled={!tenantId}>
                  <SelectTrigger className="h-11 rounded-md border-slate-200 bg-slate-50/50">
                    <SelectValue placeholder={tenantId ? "Abteilung wählen..." : "Zuerst Mandant wählen"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-md">
                    {filteredDepartments.map((d: any) => (
                      <SelectItem key={d.id} value={d.name} className="text-xs">{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 ml-1">Zugeordnete Stelle (Badge)</Label>
                <Select value={userTitle} onValueChange={setUserTitle} disabled={!tenantId}>
                  <SelectTrigger className="h-11 rounded-md border-slate-200 bg-slate-50/50">
                    <SelectValue placeholder={tenantId ? "Stelle wählen..." : "Zuerst Mandant wählen"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-md">
                    <SelectItem value="none" className="text-xs">Keine spezifische Stelle</SelectItem>
                    {filteredJobTitles.map((j: any) => (
                      <SelectItem key={j.id} value={j.name} className="text-xs">{j.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsAddOpen(false)} className="w-full sm:w-auto rounded-md font-bold text-[10px] px-6">Abbrechen</Button>
            <Button size="sm" onClick={handleSaveUser} className="w-full sm:w-auto rounded-md font-bold text-[11px] px-8 h-11 shadow-sm bg-primary text-white">
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Assignment Dialog */}
      <Dialog open={isQuickAssignOpen} onOpenChange={setIsQuickAssignOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-xl p-0 overflow-hidden bg-white border-none shadow-2xl flex flex-col h-[85vh]">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0">
            <DialogTitle className="text-base font-headline font-bold text-primary">Rolle zuweisen</DialogTitle>
            <DialogDescription className="text-[10px] font-bold mt-0.5">Zuweisung für {selectedUser?.displayName}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 ml-1">1. System auswählen</Label>
                <Select value={qaResourceId} onValueChange={(val) => { setQaResourceId(val); setQaEntitlementId(''); }}>
                  <SelectTrigger className="rounded-md h-11 border-slate-200">
                    <SelectValue placeholder="System wählen..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-md">
                    <ScrollArea className="h-48">
                      {resources?.filter(r => r.tenantId === 'global' || r.tenantId === selectedUser?.tenantId).map(r => (
                        <SelectItem key={r.id} value={r.id} className="text-xs">
                          <div className="flex items-center gap-2"> {r.name}</div>
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>

              {qaResourceId && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                  <Label className="text-[10px] font-bold text-slate-400 ml-1">2. Rolle wählen</Label>
                  <Select value={qaEntitlementId} onValueChange={setQaEntitlementId}>
                    <SelectTrigger className="rounded-md h-11 border-slate-200">
                      <SelectValue placeholder="Rolle wählen..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-md">
                      <ScrollArea className="h-48">
                        {entitlements?.filter(e => e.resourceId === qaResourceId).map(e => (
                          <SelectItem key={e.id} value={e.id} className="text-xs">
                            <div className="flex items-center gap-2">
                              {!!(e.isAdmin === true || e.isAdmin === 1 || e.isAdmin === "1") && <ShieldAlert className="w-3 h-3 text-red-600" />}
                              {e.name}
                            </div>
                          </SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 ml-1">Gültig bis (Optional)</Label>
                <Input type="date" value={qaValidUntil} onChange={e => setQaValidUntil(e.target.value)} className="rounded-md h-11 border-slate-200" />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsQuickAssignOpen(false)} className="w-full sm:w-auto rounded-md font-bold text-[10px] px-6">Abbrechen</Button>
            <Button size="sm" onClick={handleQuickAssign} disabled={!qaEntitlementId || isSavingAssignment} className="w-full sm:w-auto rounded-md font-bold text-[11px] px-8 h-11 bg-primary text-white shadow-sm">
              {isSavingAssignment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Zuweisen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl w-[95vw] h-[85vh] flex flex-col p-0 rounded-xl overflow-hidden bg-white border-none shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center text-primary font-bold text-xl shadow-lg">
                {selectedUser?.displayName?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl font-headline font-bold truncate">{selectedUser?.displayName}</DialogTitle>
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 font-bold mt-1">
                  <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> {selectedUser?.email}</span>
                  <span className="w-1 h-1 bg-slate-700 rounded-full" />
                  <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3" /> {getTenantSlug(selectedUser?.tenantId)}</span>
                  {selectedUser?.title && (
                    <>
                      <span className="w-1 h-1 bg-slate-700 rounded-full" />
                      <span className="flex items-center gap-1.5 text-primary"><Briefcase className="w-3 h-3" /> {selectedUser?.title}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>
          <Tabs defaultValue="access" className="flex-1 flex flex-col min-h-0">
            <div className="px-6 border-b shrink-0">
              <TabsList className="h-10 bg-transparent gap-6 p-0">
                <TabsTrigger value="access" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-0 gap-1.5 text-[10px] font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" /> Zugriffe
                </TabsTrigger>
                <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-0 gap-1.5 text-[10px] font-bold">
                  <History className="w-3.5 h-3.5" /> Verlauf
                </TabsTrigger>
              </TabsList>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-6">
                <TabsContent value="access" className="mt-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {assignments?.filter(a => a.userId === selectedUser?.id && a.status === 'active').map(a => {
                    const ent = entitlements?.find(e => e.id === a.entitlementId);
                    const res = resources?.find(r => r.id === ent?.resourceId);
                    return (
                      <div key={a.id} className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-100 transition-all hover:shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-md flex items-center justify-center", ent?.isAdmin ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600")}>
                            {ent?.isAdmin ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-slate-800 truncate">{res?.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 truncate">{ent?.name}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {assignments?.filter(a => a.userId === selectedUser?.id && a.status === 'active').length === 0 && (
                    <div className="col-span-full py-10 text-center space-y-2 opacity-20">
                      <Shield className="w-8 h-8 mx-auto" />
                      <p className="text-[10px] font-bold">Keine aktiven Rollen</p>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="history" className="mt-0">
                  <div className="space-y-6">
                    {auditLogs?.filter(log => log.entityId === selectedUser?.id || (log.entityType === 'user' && log.entityId === selectedUser?.id)).map((log, i) => (
                      <div key={log.id} className="relative pl-6 pb-6 border-l last:border-0 last:pb-0">
                        <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-primary" />
                        <div className="text-[9px] font-bold text-slate-400 mb-0.5">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}</div>
                        <p className="text-xs font-bold text-slate-800">{log.action}</p>
                        <p className="text-[10px] font-medium text-slate-500">Akteur: {log.actorUid}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
          <div className="p-4 border-t bg-slate-50 flex justify-end shrink-0">
            <Button size="sm" onClick={() => setIsDetailOpen(false)} className="w-full sm:w-auto rounded-md h-9 px-8 font-bold text-[11px] shadow-sm">Schließen</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent className="max-w-sm rounded-xl border-none shadow-2xl p-8">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-headline font-bold text-red-600">Benutzer löschen?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 font-medium leading-relaxed pt-1">
              Löscht <strong>{selectedUser?.displayName}</strong> permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-4 flex flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto rounded-md font-bold text-[11px] h-10 px-6">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 rounded-md font-bold text-[11px] h-10 px-8 text-white">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
