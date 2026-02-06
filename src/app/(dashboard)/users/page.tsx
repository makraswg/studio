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
  Download
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

    // Audit Log
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
      grantedBy: authUser?.uid || 'system',
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

      // Audit Log
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

    // Audit Log
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
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Benutzerverzeichnis</h1>
          <p className="text-sm text-muted-foreground">Zentrale Verwaltung der Identitäten für {activeTenantId === 'all' ? 'alle Firmen' : getTenantSlug(activeTenantId)}.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none border-primary/20 text-primary bg-primary/5" onClick={() => exportUsersExcel(filteredUsers, tenants || [])}>
            <Download className="w-3.5 h-3.5 mr-2" /> Excel Export
          </Button>
          <Button variant="outline" size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none border-blue-200 text-blue-700 bg-blue-50" onClick={handleLdapSync} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />} LDAP & Gruppen Sync
          </Button>
          <Button size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => { resetForm(); setIsAddOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-2" /> Benutzer anlegen
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
        <div className="relative lg:col-span-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Name oder E-Mail suchen..." 
            className="pl-10 h-10 border border-input bg-white text-sm focus:outline-none rounded-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="lg:col-span-3">
          <Label className="text-[9px] font-bold uppercase mb-1.5 block text-muted-foreground">Status</Label>
          <div className="flex border rounded-none p-1 bg-muted/20 h-10">
            {['all', 'active', 'disabled'].map(f => (
              <Button key={f} variant={activeStatusFilter === f ? 'default' : 'ghost'} size="sm" className="flex-1 h-8 text-[9px] font-bold uppercase px-2 rounded-none" onClick={() => setActiveStatusFilter(f as any)}>
                {f === 'all' ? 'Alle' : f === 'active' ? 'Aktiv' : 'Inaktiv'}
              </Button>
            ))}
          </div>
        </div>
        <div className="lg:col-span-3">
          <Label className="text-[9px] font-bold uppercase mb-1.5 block text-muted-foreground">Herkunft</Label>
          <div className="flex border rounded-none p-1 bg-muted/20 h-10">
            {['all', 'ad', 'manual'].map(f => (
              <Button key={f} variant={activeSourceFilter === f ? 'default' : 'ghost'} size="sm" className="flex-1 h-8 text-[9px] font-bold uppercase px-2 rounded-none" onClick={() => setActiveSourceFilter(f as any)}>
                {f === 'all' ? 'Alle' : f === 'ad' ? 'AD' : 'Manuell'}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-4 font-bold uppercase text-[10px]">Identität</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Mandant</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Abteilung</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Zuweisungen</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Status</TableHead>
                <TableHead className="text-right font-bold uppercase text-[10px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers?.map((user: any) => {
                const isEnabled = user.enabled === true || user.enabled === 1 || user.enabled === "1";
                const isAd = user.externalId && !user.externalId.startsWith('MANUAL_');
                const userAssignments = assignments?.filter(a => a.userId === user.id && a.status === 'active') || [];
                const adCount = userAssignments.filter(a => a.syncSource === 'ldap').length;
                
                return (
                  <TableRow key={user.id} className="group hover:bg-muted/5 border-b">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 flex items-center justify-center text-slate-500 font-bold uppercase text-xs">
                          {user.displayName?.charAt(0)}
                        </div>
                        <div>
                          <div 
                            className="font-bold text-sm cursor-pointer hover:text-primary transition-colors flex items-center gap-2"
                            onClick={() => { setSelectedUser(user); setIsDetailOpen(true); }}
                          >
                            {user.displayName}
                            <Info className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] text-muted-foreground font-mono">{user.email}</span>
                            <span className="flex items-center gap-1 text-[8px] font-bold uppercase py-0.5 px-1 bg-muted/50 rounded-sm">
                              {isAd ? <><Network className="w-2 h-2 text-blue-600" /> AD</> : <><UserIcon className="w-2 h-2 text-slate-500" /> Manuell</>}
                            </span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[8px] font-bold uppercase rounded-none">{getTenantSlug(user.tenantId)}</Badge></TableCell>
                    <TableCell className="text-xs">{user.department || '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs">{userAssignments.length}</span>
                        {adCount > 0 && <Badge className="bg-blue-50 text-blue-700 border-none rounded-none text-[8px] font-bold uppercase"><Network className="w-2 h-2 mr-1" /> {adCount} AD</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[9px] font-bold uppercase rounded-none border-none px-2", isEnabled ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
                        {isEnabled ? "AKTIV" : "INAKTIV"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-[9px] font-bold uppercase gap-1.5 rounded-none hover:bg-emerald-50 hover:text-emerald-700"
                          onClick={() => { setSelectedUser(user); setQaResourceId(''); setQaEntitlementId(''); setIsQuickAssignOpen(true); }}
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Zuweisen
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 rounded-none">
                            <DropdownMenuItem onSelect={() => { setSelectedUser(user); setIsDetailOpen(true); }}><Info className="w-3.5 h-3.5 mr-2" /> Details & Historie</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openEdit(user)}><Pencil className="w-3.5 h-3.5 mr-2" /> Bearbeiten</DropdownMenuItem>
                            {isAd && (
                              <DropdownMenuItem 
                                className="text-blue-600 font-bold"
                                onSelect={() => handlePromoteToAdmin(user.id)}
                                disabled={isPromoting}
                              >
                                <Shield className="w-3.5 h-3.5 mr-2" /> Zum Administrator befördern (LDAP)
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onSelect={() => router.push(`/assignments?search=${user.displayName}`)}><ShieldCheck className="w-3.5 h-3.5 mr-2" /> Alle Zugriffe</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onSelect={() => { setSelectedUser(user); setIsDeleteAlertOpen(true); }}><Trash2 className="w-3.5 h-3.5 mr-2" /> Löschen</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Quick Assignment Dialog */}
      <Dialog open={isQuickAssignOpen} onOpenChange={setIsQuickAssignOpen}>
        <DialogContent className="max-w-md rounded-none">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase">Berechtigung zuweisen</DialogTitle>
            <DialogDescription className="text-xs">Neue Rolle für {selectedUser?.displayName} festlegen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">1. System auswählen</Label>
              <Select value={qaResourceId} onValueChange={(val) => { setQaResourceId(val); setQaEntitlementId(''); }}>
                <SelectTrigger className="rounded-none"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent className="rounded-none">
                  <ScrollArea className="h-48">
                    {resources?.filter(r => r.tenantId === 'global' || r.tenantId === selectedUser?.tenantId).map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        <div className="flex items-center gap-2">
                          <Layers className="w-3 h-3 text-muted-foreground" />
                          <span>{r.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>

            {qaResourceId && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                <Label className="text-[10px] font-bold uppercase">2. Rolle wählen</Label>
                <Select value={qaEntitlementId} onValueChange={setQaEntitlementId}>
                  <SelectTrigger className="rounded-none"><SelectValue placeholder="Rolle wählen..." /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    <ScrollArea className="h-48">
                      {entitlements?.filter(e => e.resourceId === qaResourceId).map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          <div className="flex items-center gap-2">
                            {!!(e.isAdmin === true || e.isAdmin === 1 || e.isAdmin === "1") && <ShieldAlert className="w-3 h-3 text-red-600" />}
                            <span>{e.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">Gültig bis (Optional)</Label>
              <Input type="date" value={qaValidUntil} onChange={e => setQaValidUntil(e.target.value)} className="rounded-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuickAssignOpen(false)} className="rounded-none">Abbrechen</Button>
            <Button onClick={handleQuickAssign} disabled={!qaEntitlementId || isSavingAssignment} className="rounded-none font-bold uppercase text-[10px] gap-2">
              {isSavingAssignment && <Loader2 className="w-3 h-3 animate-spin" />}
              Zuweisung erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 rounded-none overflow-hidden">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/20 flex items-center justify-center text-primary font-bold text-xl uppercase">
                {selectedUser?.displayName?.charAt(0)}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold uppercase tracking-wider">{selectedUser?.displayName}</DialogTitle>
                <div className="flex items-center gap-3 text-xs text-slate-400 font-bold uppercase mt-1">
                  <span>{selectedUser?.email}</span>
                  <span className="w-1 h-1 bg-slate-600 rounded-full" />
                  <span>{selectedUser?.department}</span>
                  <span className="w-1 h-1 bg-slate-600 rounded-full" />
                  <span className="text-primary">{getTenantSlug(selectedUser?.tenantId)}</span>
                </div>
              </div>
            </div>
          </DialogHeader>
          <Tabs defaultValue="access" className="flex-1 flex flex-col">
            <div className="px-6 border-b bg-muted/10 shrink-0">
              <TabsList className="h-12 bg-transparent gap-6 p-0">
                <TabsTrigger value="access" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-0 gap-2 text-[10px] font-bold uppercase">
                  <ShieldCheck className="w-3.5 h-3.5" /> Aktive Zugriffe
                </TabsTrigger>
                <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-0 gap-2 text-[10px] font-bold uppercase">
                  <History className="w-3.5 h-3.5" /> Aktivitätsverlauf
                </TabsTrigger>
              </TabsList>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-6">
                <TabsContent value="access" className="mt-0 space-y-4">
                  {assignments?.filter(a => a.userId === selectedUser?.id && a.status === 'active').map(a => {
                    const ent = entitlements?.find(e => e.id === a.entitlementId);
                    const res = resources?.find(r => r.id === ent?.resourceId);
                    return (
                      <div key={a.id} className="flex items-center justify-between p-4 border bg-white group hover:border-primary/30 transition-all">
                        <div className="flex items-center gap-4">
                          <div className={cn("p-2 rounded-sm", ent?.isAdmin ? "bg-red-50" : "bg-blue-50")}>
                            {ent?.isAdmin ? <ShieldAlert className="w-4 h-4 text-red-600" /> : <ShieldCheck className="w-4 h-4 text-blue-600" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold">{res?.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{ent?.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-bold uppercase text-muted-foreground">Mandant</p>
                          <p className="text-[10px] font-bold uppercase">{getTenantSlug(a.tenantId)}</p>
                        </div>
                      </div>
                    );
                  })}
                </TabsContent>
                <TabsContent value="history" className="mt-0">
                  <div className="space-y-6">
                    {auditLogs?.filter(log => log.entityId === selectedUser?.id || (log.entityType === 'user' && log.entityId === selectedUser?.id)).map(log => (
                      <div key={log.id} className="relative pl-6 pb-6 border-l last:border-0 last:pb-0">
                        <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-primary" />
                        <div className="text-[9px] font-bold uppercase text-muted-foreground mb-1">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}</div>
                        <p className="text-xs font-bold">{log.action}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Akteur: {log.actorUid} ({getTenantSlug(log.tenantId)})</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
          <div className="p-4 border-t bg-slate-50 flex justify-end shrink-0">
            <Button onClick={() => setIsDetailOpen(false)} className="rounded-none h-10 px-8">Schließen</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={(val) => { if (!val) setIsAddOpen(false); }}>
        <DialogContent className="max-w-md rounded-none">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">{selectedUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Anzeigename</Label><Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="rounded-none" /></div>
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">E-Mail Adresse</Label><Input value={email} onChange={e => setEmail(e.target.value)} className="rounded-none" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Abteilung</Label><Input value={department} onChange={e => setDepartment(e.target.value)} className="rounded-none" /></div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Mandant</Label>
                <Select value={tenantId} onValueChange={setTenantId}>
                  <SelectTrigger className="rounded-none"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    {tenants?.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.slug})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSaveUser} className="rounded-none font-bold uppercase text-[10px]">Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader><AlertDialogTitle className="text-red-600 font-bold uppercase text-sm">Benutzer löschen?</AlertDialogTitle><AlertDialogDescription className="text-xs">Dies entfernt den Benutzer permanent aus dem System.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="rounded-none">Abbrechen</AlertDialogCancel><AlertDialogAction onClick={handleDeleteUser} className="bg-red-600 rounded-none text-xs uppercase font-bold">Löschen</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
