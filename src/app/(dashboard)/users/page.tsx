"use client";

import { useState, useEffect } from 'react';
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
  UserCircle,
  ShieldCheck,
  MoreHorizontal,
  Loader2,
  ShieldAlert,
  BrainCircuit,
  Info,
  X,
  Shield,
  Layers,
  CheckCircle2,
  AlertTriangle,
  History,
  Database,
  Globe,
  Trash2,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { 
  useFirestore, 
  setDocumentNonBlocking, 
  addDocumentNonBlocking, 
  deleteDocumentNonBlocking,
  useUser as useAuthUser 
} from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { getAccessAdvice } from '@/ai/flows/access-advisor-flow';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';

export default function UsersPage() {
  const db = useFirestore();
  const router = useRouter();
  const { dataSource } = useSettings();
  const { user: authUser } = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  
  // Selection & AI State
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isAdvisorLoading, setIsAdvisorLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<any>(null);

  // Filters
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'ldap' | 'manual'>('all');

  // Form State
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [newTitle, setNewTitle] = useState('');

  const { data: users, isLoading, refresh: refreshUsers } = usePluggableCollection<any>('users');
  const { data: assignments } = usePluggableCollection<any>('assignments');
  const { data: entitlements } = usePluggableCollection<any>('entitlements');
  const { data: resources } = usePluggableCollection<any>('resources');
  const { data: auditLogs } = usePluggableCollection<any>('auditEvents');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleAddUser = async () => {
    if (!newDisplayName || !newEmail) {
      toast({ variant: "destructive", title: "Fehler", description: "Name und E-Mail sind erforderlich." });
      return;
    }
    
    const userId = `u-${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();
    const userData = {
      id: userId,
      externalId: `MANUAL_${userId}`,
      displayName: newDisplayName,
      email: newEmail,
      department: newDepartment,
      title: newTitle,
      enabled: true,
      lastSyncedAt: timestamp,
      tenantId: 't1'
    };

    const auditData = {
      id: `audit-${Math.random().toString(36).substring(2, 9)}`,
      actorUid: authUser?.uid || 'system',
      action: 'Benutzer manuell angelegt',
      entityType: 'user',
      entityId: userId,
      timestamp,
      tenantId: 't1'
    };

    if (dataSource === 'mysql') {
      await saveCollectionRecord('users', userId, userData);
      await saveCollectionRecord('auditEvents', auditData.id, auditData);
    } else {
      setDocumentNonBlocking(doc(db, 'users', userId), userData);
      addDocumentNonBlocking(collection(db, 'auditEvents'), auditData);
    }
    
    setIsAddOpen(false);
    toast({ title: "Benutzer hinzugefügt", description: `${newDisplayName} wurde registriert.` });
    resetForm();
    setTimeout(() => refreshUsers(), 200);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    const userAssignments = assignments?.filter(a => a.userId === selectedUser.id && a.status !== 'removed');
    if (userAssignments && userAssignments.length > 0) {
      toast({
        variant: "destructive",
        title: "Löschen nicht möglich",
        description: "Dieser Benutzer hat noch aktive Berechtigungen. Bitte entziehen Sie zuerst alle Rollen.",
      });
      setIsDeleteAlertOpen(false);
      return;
    }

    const timestamp = new Date().toISOString();
    const auditData = {
      id: `audit-${Math.random().toString(36).substring(2, 9)}`,
      actorUid: authUser?.uid || 'system',
      action: 'Benutzer gelöscht',
      entityType: 'user',
      entityId: selectedUser.id,
      timestamp,
      tenantId: 't1'
    };

    if (dataSource === 'mysql') {
      await deleteCollectionRecord('users', selectedUser.id);
      await saveCollectionRecord('auditEvents', auditData.id, auditData);
    } else {
      deleteDocumentNonBlocking(doc(db, 'users', selectedUser.id));
      addDocumentNonBlocking(collection(db, 'auditEvents'), auditData);
    }

    toast({ title: "Benutzer entfernt", description: "Die Identität wurde aus dem Verzeichnis gelöscht." });
    setIsDeleteAlertOpen(false);
    setTimeout(() => refreshUsers(), 200);
  };

  const resetForm = () => {
    setNewDisplayName('');
    setNewEmail('');
    setNewDepartment('');
    setNewTitle('');
  };

  const openAdvisor = async (userDoc: any) => {
    setSelectedUser(userDoc);
    setIsAdvisorLoading(true);
    setIsAdvisorOpen(true);
    setAiAdvice(null);
    
    try {
      const userAssignments = assignments?.filter((a: any) => a.userId === userDoc.id && a.status === 'active') || [];
      const detailedAssignments = userAssignments.map((a: any) => {
        const ent = entitlements?.find((e: any) => e.id === a.entitlementId);
        const res = resources?.find((r: any) => r.id === ent?.resourceId);
        return {
          resourceName: res?.name || 'Unbekannt',
          entitlementName: ent?.name || 'Unbekannt',
          riskLevel: ent?.riskLevel || 'medium'
        };
      });

      const advice = await getAccessAdvice({
        userDisplayName: userDoc.name || userDoc.displayName,
        userEmail: userDoc.email,
        department: userDoc.department || 'Allgemein',
        assignments: detailedAssignments
      });
      setAiAdvice(advice);

      const auditData = {
        id: `audit-${Math.random().toString(36).substring(2, 9)}`,
        actorUid: authUser?.uid || 'system',
        action: 'KI Risikocheck durchgeführt',
        entityType: 'user',
        entityId: userDoc.id,
        timestamp: new Date().toISOString(),
        tenantId: 't1'
      };
      if (dataSource === 'mysql') {
        saveCollectionRecord('auditEvents', auditData.id, auditData);
      } else {
        addDocumentNonBlocking(collection(db, 'auditEvents'), auditData);
      }
    } catch (e) {
      toast({ variant: "destructive", title: "KI-Fehler", description: "Analyse fehlgeschlagen." });
      setIsAdvisorOpen(false);
    } finally {
      setIsAdvisorLoading(false);
    }
  };

  const filteredUsers = users?.filter((user: any) => {
    const displayName = user.name || user.displayName || '';
    const email = user.email || '';
    const dept = user.department || '';
    
    const matchesSearch = 
      displayName.toLowerCase().includes(search.toLowerCase()) ||
      email.toLowerCase().includes(search.toLowerCase()) ||
      dept.toLowerCase().includes(search.toLowerCase());

    const isEnabled = user.enabled === true || user.enabled === 1 || user.enabled === "1";
    const matchesStatus = 
      activeFilter === 'all' || 
      (activeFilter === 'active' && isEnabled) || 
      (activeFilter === 'disabled' && !isEnabled);

    const isLdap = user.externalId && !user.externalId.startsWith('MANUAL_');
    const matchesSource = 
      sourceFilter === 'all' || 
      (sourceFilter === 'ldap' && isLdap) || 
      (sourceFilter === 'manual' && !isLdap);

    return matchesSearch && matchesStatus && matchesSource;
  });

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline">Benutzerverzeichnis</h1>
          <p className="text-sm text-muted-foreground">Verwaltung von Identitäten und Synchronisations-Status.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => { setIsSyncing(true); setTimeout(() => { setIsSyncing(false); refreshUsers(); }, 1500); }} disabled={isSyncing}>
            <RefreshCw className={cn("w-3 h-3 mr-2", isSyncing && "animate-spin")} /> LDAP Sync
          </Button>
          <Button size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => setIsAddOpen(true)}>
            <Plus className="w-3 h-3 mr-2" /> Benutzer anlegen
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Suche nach Name, E-Mail oder Abteilung..." 
            className="pl-10 h-10 rounded-none shadow-none border-border bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex border rounded-none p-1 bg-muted/20">
          <Button 
            variant={activeFilter === 'all' ? 'default' : 'ghost'} 
            size="sm" 
            className="h-8 text-[9px] font-bold uppercase px-4 rounded-none"
            onClick={() => setActiveFilter('all')}
          >Alle</Button>
          <Button 
            variant={activeFilter === 'active' ? 'default' : 'ghost'} 
            size="sm" 
            className="h-8 text-[9px] font-bold uppercase px-4 rounded-none"
            onClick={() => setActiveFilter('active')}
          >Aktiv</Button>
          <Button 
            variant={activeFilter === 'disabled' ? 'default' : 'ghost'} 
            size="sm" 
            className="h-8 text-[9px] font-bold uppercase px-4 rounded-none"
            onClick={() => setActiveFilter('disabled')}
          >Deaktiviert</Button>
        </div>
        <div className="flex border rounded-none p-1 bg-muted/20">
           <Button 
            variant={sourceFilter === 'all' ? 'default' : 'ghost'} 
            size="sm" 
            className="h-8 text-[9px] font-bold uppercase px-4 rounded-none"
            onClick={() => setSourceFilter('all')}
          ><Filter className="w-3 h-3 mr-1.5" /> Alle</Button>
          <Button 
            variant={sourceFilter === 'ldap' ? 'default' : 'ghost'} 
            size="sm" 
            className="h-8 text-[9px] font-bold uppercase px-4 rounded-none"
            onClick={() => setSourceFilter('ldap')}
          ><Globe className="w-3 h-3 mr-1.5" /> LDAP</Button>
          <Button 
            variant={sourceFilter === 'manual' ? 'default' : 'ghost'} 
            size="sm" 
            className="h-8 text-[9px] font-bold uppercase px-4 rounded-none"
            onClick={() => setSourceFilter('manual')}
          ><Database className="w-3 h-3 mr-1.5" /> Manuell</Button>
        </div>
      </div>

      <div className="admin-card overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Identitäten werden geladen...</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-4 font-bold uppercase tracking-widest text-[10px]">Identität</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Abteilung</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Status</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Zugriffsprofil</TableHead>
                <TableHead className="text-right font-bold uppercase tracking-widest text-[10px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers?.map((user: any) => {
                const userEntsCount = assignments?.filter((a: any) => a.userId === user.id && a.status === 'active').length || 0;
                const displayName = user.name || user.displayName;
                const isEnabled = user.enabled === true || user.enabled === 1 || user.enabled === "1";
                const isLdap = user.externalId && !user.externalId.startsWith('MANUAL_');
                
                return (
                  <TableRow key={user.id} className="group transition-colors hover:bg-muted/5 border-b">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-none bg-slate-100 flex items-center justify-center text-slate-500 font-bold uppercase text-xs">
                          {displayName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-sm flex items-center gap-2">
                            {displayName}
                            {isLdap && (
                              <Badge className="bg-blue-50 text-blue-600 rounded-none border-blue-100 text-[8px] font-bold py-0 h-4">LDAP</Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-xs">{user.department || '—'}</span>
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{user.title || 'Kein Titel'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "text-[9px] font-bold uppercase rounded-none border-none px-2", 
                        isEnabled ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                      )}>
                        {isEnabled ? "AKTIV" : "DEAKTIVIERT"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase text-slate-600">
                        <ShieldCheck className="w-3.5 h-3.5 text-primary" /> {userEntsCount} Rollen
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-muted">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-none p-1 shadow-xl border border-border">
                          <DropdownMenuItem onSelect={(e) => {
                            e.preventDefault();
                            setSelectedUser(user);
                            setTimeout(() => setIsProfileOpen(true), 150);
                          }}>
                            <UserCircle className="w-3.5 h-3.5 mr-2" /> Identitätsprofil & Log
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => router.push(`/assignments?search=${displayName}`)}>
                            <ShieldCheck className="w-3.5 h-3.5 mr-2" /> Zugriffe bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-blue-600 font-bold" onSelect={(e) => {
                            e.preventDefault();
                            openAdvisor(user);
                          }}>
                            <BrainCircuit className="w-3.5 h-3.5 mr-2" /> KI-Risk Advisor
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600 focus:bg-red-50" onSelect={(e) => {
                            e.preventDefault();
                            setSelectedUser(user);
                            setIsDeleteAlertOpen(true);
                          }}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Benutzer löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="max-w-4xl rounded-none border shadow-2xl p-0 overflow-hidden">
          <div className="bg-slate-900 text-white p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-primary/20 text-primary flex items-center justify-center font-bold text-2xl uppercase border border-primary/30">
                {selectedUser?.displayName?.charAt(0) || '?'}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold font-headline">{selectedUser?.displayName}</DialogTitle>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-slate-400 uppercase font-bold tracking-widest">{selectedUser?.email}</span>
                  <Badge variant="outline" className="border-slate-700 text-slate-400 rounded-none text-[8px] uppercase">{selectedUser?.department}</Badge>
                </div>
              </div>
            </div>
          </div>

          <Tabs defaultValue="permissions" className="w-full">
            <TabsList className="w-full flex justify-start rounded-none bg-muted/50 border-b h-12 p-0 px-6 gap-6">
              <TabsTrigger value="permissions" className="h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none text-[10px] font-bold uppercase tracking-widest">Berechtigungen</TabsTrigger>
              <TabsTrigger value="history" className="h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none text-[10px] font-bold uppercase tracking-widest">Historie / Log</TabsTrigger>
            </TabsList>

            <TabsContent value="permissions" className="p-6 focus-visible:ring-0">
              <div className="border rounded-none overflow-hidden max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/30 sticky top-0">
                    <TableRow>
                      <TableHead className="h-10 text-[9px] font-bold uppercase">System</TableHead>
                      <TableHead className="h-10 text-[9px] font-bold uppercase">Rolle</TableHead>
                      <TableHead className="h-10 text-[9px] font-bold uppercase">Risiko</TableHead>
                      <TableHead className="h-10 text-[9px] font-bold uppercase">Zugewiesen</TableHead>
                      <TableHead className="h-10 text-[9px] font-bold uppercase text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments?.filter((a: any) => a.userId === selectedUser?.id && a.status === 'active').map((a: any) => {
                      const ent = entitlements?.find((e: any) => e.id === a.entitlementId);
                      const res = resources?.find((r: any) => r.id === ent?.resourceId);
                      return (
                        <TableRow key={a.id} className="text-xs group hover:bg-muted/5">
                          <TableCell className="py-3 font-bold">{res?.name || '—'}</TableCell>
                          <TableCell>{ent?.name || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(
                              "text-[8px] font-bold uppercase rounded-none border-none px-1.5",
                              ent?.riskLevel === 'high' ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
                            )}>
                              {ent?.riskLevel || 'MEDIUM'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-[10px]">
                            {a.grantedAt ? new Date(a.grantedAt).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                             <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-[8px] uppercase border-none">AKTIV</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="history" className="p-6 focus-visible:ring-0">
               <div className="border rounded-none overflow-hidden max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/30 sticky top-0">
                    <TableRow>
                      <TableHead className="h-10 text-[9px] font-bold uppercase">Zeitpunkt</TableHead>
                      <TableHead className="h-10 text-[9px] font-bold uppercase">Aktion</TableHead>
                      <TableHead className="h-10 text-[9px] font-bold uppercase">Akteur</TableHead>
                      <TableHead className="h-10 text-[9px] font-bold uppercase text-right">Typ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs?.filter((log: any) => 
                      log.entityId === selectedUser?.id || 
                      (log.entityType === 'assignment' && assignments?.some((a: any) => a.id === log.entityId && a.userId === selectedUser?.id))
                    ).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((log: any) => (
                      <TableRow key={log.id} className="text-[11px] group">
                        <TableCell className="py-3 text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-bold">{log.action}</TableCell>
                        <TableCell className="text-muted-foreground uppercase text-[9px]">{log.actorUid}</TableCell>
                        <TableCell className="text-right">
                           <Badge variant="outline" className="rounded-none text-[8px] uppercase border-slate-200">{log.entityType}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="border-t p-6 bg-slate-50">
            <Button variant="outline" onClick={() => setIsProfileOpen(false)} className="rounded-none">Schließen</Button>
            <Button onClick={() => { setIsProfileOpen(false); router.push(`/assignments?search=${selectedUser?.displayName}`); }} className="rounded-none font-bold uppercase text-[10px]">Zugriffe bearbeiten</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent className="rounded-none shadow-2xl border-2">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 font-bold uppercase flex items-center gap-2 text-sm">
              <AlertTriangle className="w-5 h-5" /> Identität unwiderruflich löschen?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Möchten Sie "{selectedUser?.displayName}" wirklich aus dem System entfernen? Alle Stammdaten werden gelöscht. Dies ist nur möglich, wenn der Benutzer keine aktiven Berechtigungen mehr hat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none shadow-none text-xs uppercase font-bold">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-red-600 hover:bg-red-700 rounded-none font-bold uppercase text-xs shadow-none">Benutzer löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="rounded-none border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase">Benutzer manuell hinzufügen</DialogTitle>
            <DialogDescription className="text-xs">Neue Identität im Verzeichnis registrieren.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Vollständiger Name</Label>
              <Input value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} placeholder="Max Mustermann" className="rounded-none h-10" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">E-Mail Adresse</Label>
              <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="max@acme.com" className="rounded-none h-10" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Abteilung</Label>
                <Input value={newDepartment} onChange={e => setNewDepartment(e.target.value)} placeholder="IT Ops" className="rounded-none h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Job Titel</Label>
                <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Administrator" className="rounded-none h-10" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-none">Abbrechen</Button>
            <Button onClick={handleAddUser} className="rounded-none font-bold uppercase text-[10px]">Benutzer anlegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAdvisorOpen} onOpenChange={setIsAdvisorOpen}>
        <DialogContent className="max-w-2xl rounded-none border shadow-2xl overflow-hidden p-0">
          <div className="bg-slate-900 text-white p-6">
            <div className="flex items-center justify-between mb-2">
              <Badge className="bg-blue-600 text-white rounded-none border-none font-bold text-[9px]">COMPLIANCE ADVISOR AI</Badge>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400">
                <BrainCircuit className="w-4 h-4 text-blue-400" />
                Sicherheits-Check
              </div>
            </div>
            <h2 className="text-xl font-bold font-headline">Analyse für {selectedUser?.displayName}</h2>
          </div>
          
          <div className="p-6">
            {isAdvisorLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Prüfe Zugriffsberechtigungen...</p>
              </div>
            ) : aiAdvice && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="grid grid-cols-2 gap-4">
                  <div className="admin-card p-4 border-l-4 border-l-blue-600 bg-blue-50/50">
                    <p className="text-[9px] font-bold uppercase text-blue-600 mb-1">Risiko-Score</p>
                    <div className="text-3xl font-bold flex items-baseline gap-1">
                      {aiAdvice.riskScore} <span className="text-sm font-normal text-muted-foreground">/ 100</span>
                    </div>
                  </div>
                   <div className="admin-card p-4 border-l-4 border-l-orange-500 bg-orange-50/50">
                    <p className="text-[9px] font-bold uppercase text-orange-600 mb-1">Identifizierte Bedenken</p>
                    <div className="text-3xl font-bold">{aiAdvice.concerns.length}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase text-primary tracking-widest">KI Zusammenfassung</h4>
                  <p className="text-sm leading-relaxed text-slate-700 bg-slate-50 p-4 border italic">
                    "{aiAdvice.summary}"
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase text-red-600 tracking-widest">Risiken</h4>
                    <ul className="space-y-2">
                      {aiAdvice.concerns.map((c: string, i: number) => (
                        <li key={i} className="text-xs flex gap-2">
                          <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase text-emerald-600 tracking-widest">Maßnahmen</h4>
                    <ul className="space-y-2">
                      {aiAdvice.recommendations.map((r: string, i: number) => (
                        <li key={i} className="text-xs flex gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="font-bold">{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="p-6 border-t bg-slate-50">
            <Button variant="outline" onClick={() => setIsAdvisorOpen(false)} className="rounded-none">Schließen</Button>
            <Button className="rounded-none bg-blue-600 hover:bg-blue-700 font-bold uppercase text-[10px]" onClick={() => { setIsAdvisorOpen(false); router.push('/reviews'); }}>
              Review Kampagne starten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
