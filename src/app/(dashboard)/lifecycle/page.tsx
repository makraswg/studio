
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  UserPlus, 
  UserMinus, 
  Package, 
  Loader2, 
  Search,
  CheckCircle2,
  Zap,
  ShieldAlert,
  MoreHorizontal,
  Pencil,
  Trash2,
  Info,
  Layers,
  ChevronRight,
  UserCircle,
  Building2,
  User as UserIcon,
  Plus
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { 
  useFirestore, 
  setDocumentNonBlocking, 
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
  useUser as useAuthUser
} from '@/firebase';
import { doc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { createJiraTicket, getJiraConfigs } from '@/app/actions/jira-actions';
import { logAuditEventAction } from '@/app/actions/audit-actions';
import { Switch } from '@/components/ui/switch';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
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
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export default function LifecyclePage() {
  const { dataSource, activeTenantId } = useSettings();
  const db = useFirestore();
  const { user: authUser } = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('joiner');
  const [search, setSearch] = useState('');
  
  // Onboarding Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewEmail] = useState('');
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);
  const [onboardingDate, setOnboardingDate] = useState(new Date().toISOString().split('T')[0]);

  // Bundle Editor State
  const [isBundleCreateOpen, setIsBundleCreateOpen] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<any>(null);
  const [bundleName, setBundleName] = useState('');
  const [bundleDesc, setBundleDesc] = useState('');
  const [selectedEntitlementIds, setSelectedEntitlementIds] = useState<string[]>([]);
  const [roleSearchTerm, setRoleSearchTerm] = useState('');
  const [adminOnlyFilter, setAdminOnlyFilter] = useState(false);
  const [isBundleDeleteOpen, setIsBundleDeleteOpen] = useState(false);

  // Offboarding State
  const [userToOffboard, setUserToOffboard] = useState<any>(null);
  const [isOffboardConfirmOpen, setIsOffboardConfirmOpen] = useState(false);

  const { data: users, isLoading: isUsersLoading, refresh: refreshUsers } = usePluggableCollection<any>('users');
  const { data: bundles, isLoading: isBundlesLoading, refresh: refreshBundles } = usePluggableCollection<any>('bundles');
  const { data: entitlements } = usePluggableCollection<any>('entitlements');
  const { data: resources } = usePluggableCollection<any>('resources');
  const { data: assignments, refresh: refreshAssignments } = usePluggableCollection<any>('assignments');
  const { data: tenants } = usePluggableCollection<any>('tenants');

  useEffect(() => {
    setMounted(true);
  }, []);

  const getTenantSlug = (id?: string | null) => {
    if (!id || id === 'all' || id === 'global') return 'Global';
    const tenant = tenants?.find((t: any) => t.id === id);
    return tenant ? tenant.slug : id;
  };

  const filteredRoles = useMemo(() => {
    if (!entitlements || !resources) return [];
    return entitlements.filter((e: any) => {
      const res = resources.find((r: any) => r.id === e.resourceId);
      const isGlobal = res?.tenantId === 'global' || !res?.tenantId;
      if (activeTenantId !== 'all' && !isGlobal && res?.tenantId !== activeTenantId) return false;
      const matchSearch = e.name.toLowerCase().includes(roleSearchTerm.toLowerCase()) || res?.name.toLowerCase().includes(roleSearchTerm.toLowerCase());
      if (!matchSearch) return false;
      if (adminOnlyFilter && !e.isAdmin) return false;
      return true;
    });
  }, [entitlements, resources, roleSearchTerm, adminOnlyFilter, activeTenantId]);

  const handleCreateBundle = async () => {
    if (!bundleName || selectedEntitlementIds.length === 0) {
      toast({ variant: "destructive", title: "Fehler", description: "Name und Rollen erforderlich." });
      return;
    }
    const bundleId = selectedBundle?.id || `bundle-${Math.random().toString(36).substring(2, 9)}`;
    const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;
    
    const bundleData = {
      id: bundleId,
      tenantId: targetTenantId,
      name: bundleName,
      description: bundleDesc,
      entitlementIds: selectedEntitlementIds
    };
    
    try {
      if (dataSource === 'mysql') await saveCollectionRecord('bundles', bundleId, bundleData);
      else setDocumentNonBlocking(doc(db, 'bundles', bundleId), bundleData);
      
      toast({ title: selectedBundle ? "Paket aktualisiert" : "Paket erstellt" });
      setIsBundleCreateOpen(false);
      setTimeout(() => refreshBundles(), 200);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler beim Speichern", description: e.message });
    }
  };

  const openEditBundle = (bundle: any) => {
    setSelectedBundle(bundle);
    setBundleName(bundle.name);
    setBundleDesc(bundle.description || '');
    setSelectedEntitlementIds(bundle.entitlementIds || []);
    setIsBundleCreateOpen(true);
  };

  const handleDeleteBundle = async () => {
    if (!selectedBundle) return;
    try {
      if (dataSource === 'mysql') await deleteCollectionRecord('bundles', selectedBundle.id);
      else deleteDocumentNonBlocking(doc(db, 'bundles', selectedBundle.id));
      
      toast({ title: "Bundle gelöscht" });
      setIsBundleDeleteOpen(false);
      setTimeout(() => refreshBundles(), 200);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler beim Löschen", description: e.message });
    }
  };

  const startOnboarding = async () => {
    if (!newUserName || !newUserEmail || !selectedBundleId) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte alle Felder ausfüllen." });
      return;
    }
    setIsActionLoading(true);
    try {
      const bundle = bundles?.find((b: any) => b.id === selectedBundleId);
      const userId = `u-${Math.random().toString(36).substring(2, 9)}`;
      const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;
      const timestamp = new Date().toISOString();
      
      const userData = { 
        id: userId, 
        tenantId: targetTenantId, 
        externalId: `MANUAL_${userId}`, 
        displayName: newUserName, 
        email: newUserEmail, 
        enabled: true, 
        onboardingDate, 
        lastSyncedAt: timestamp 
      };

      if (dataSource === 'mysql') await saveCollectionRecord('users', userId, userData, dataSource);
      else setDocumentNonBlocking(doc(db, 'users', userId), userData);

      const configs = await getJiraConfigs(dataSource);
      let jiraKey = 'MANUELL';
      
      if (configs.length > 0 && configs[0].enabled) {
        const res = await createJiraTicket(configs[0].id, `ONBOARDING: ${newUserName}`, `Account für ${newUserName} (Mandant: ${targetTenantId})`, dataSource);
        if (res.success) {
          jiraKey = res.key!;
        } else {
          toast({ variant: "destructive", title: "Jira Hinweis", description: "Benutzer wurde angelegt, aber Jira Ticket konnte nicht erstellt werden: " + (res.error || "Unbekannt") });
        }
      }

      for (const eid of bundle.entitlementIds) {
        const assId = `ass-onb-${userId}-${eid}`.substring(0, 50);
        const assData = { 
          id: assId, 
          tenantId: targetTenantId, 
          userId, 
          entitlementId: eid, 
          status: 'requested', 
          grantedBy: authUser?.email || 'onboarding-wizard', 
          grantedAt: timestamp, 
          validFrom: onboardingDate, 
          jiraIssueKey: jiraKey, 
          syncSource: 'manual' 
        };
        if (dataSource === 'mysql') await saveCollectionRecord('assignments', assId, assData, dataSource);
        else setDocumentNonBlocking(doc(db, 'assignments', assId), assData);
      }

      await logAuditEventAction(dataSource, {
        tenantId: targetTenantId,
        actorUid: authUser?.email || 'system',
        action: `Onboarding gestartet für: ${newUserName} (${bundle.name})`,
        entityType: 'user',
        entityId: userId,
        after: userData
      });

      toast({ title: "Onboarding angestoßen" });
      setNewUserName('');
      setNewEmail('');
      setSelectedBundleId(null);
      setTimeout(() => { refreshUsers(); refreshAssignments(); }, 300);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
    } finally {
      setIsActionLoading(false);
    }
  };

  const executeOffboarding = async () => {
    if (!userToOffboard) return;
    setIsActionLoading(true);
    try {
      const userAssignments = assignments?.filter((a: any) => a.userId === userToOffboard.id && a.status === 'active') || [];
      const configs = await getJiraConfigs(dataSource);
      let jiraKey = 'OFFB-PENDING';
      
      if (configs.length > 0 && configs[0].enabled) {
        const res = await createJiraTicket(configs[0].id, `OFFBOARDING: ${userToOffboard.displayName}`, `Deaktivierung für ${userToOffboard.email}`, dataSource);
        if (res.success) {
          jiraKey = res.key!;
        } else {
          toast({ variant: "destructive", title: "Jira Hinweis", description: "Offboarding eingeleitet, aber Jira Ticket fehlgeschlagen: " + (res.error || "Unbekannt") });
        }
      }

      for (const a of userAssignments) {
        const update = { status: 'pending_removal', jiraIssueKey: jiraKey };
        if (dataSource === 'mysql') await saveCollectionRecord('assignments', a.id, { ...a, ...update }, dataSource);
        else updateDocumentNonBlocking(doc(db, 'assignments', a.id), update);
      }

      await logAuditEventAction(dataSource, {
        tenantId: userToOffboard.tenantId || 'global',
        actorUid: authUser?.email || 'system',
        action: `Offboarding eingeleitet für: ${userToOffboard.displayName}`,
        entityType: 'user',
        entityId: userToOffboard.id
      });

      toast({ title: "Offboarding eingeleitet" });
      setIsOffboardConfirmOpen(false); 
      setTimeout(() => refreshAssignments(), 300);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
    } finally {
      setIsActionLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Identity Lifecycle Hub</h1>
          <p className="text-sm text-muted-foreground">Automatisierte On- und Offboarding-Prozesse für {activeTenantId === 'all' ? 'alle Standorte' : getTenantSlug(activeTenantId)}.</p>
        </div>
        <Button variant="outline" size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none border-primary/20 hover:bg-primary/5" onClick={() => { 
          setSelectedBundle(null); 
          setBundleName(''); 
          setBundleDesc(''); 
          setSelectedEntitlementIds([]); 
          setIsBundleCreateOpen(true); 
        }}>
          <Package className="w-3.5 h-3.5 mr-2" /> Paket definieren
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 h-12 rounded-none border w-full justify-start gap-2 p-1">
          <TabsTrigger value="joiner" className="px-8 text-[10px] font-bold uppercase rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none">
            <UserPlus className="w-3.5 h-3.5 mr-2" /> Onboarding
          </TabsTrigger>
          <TabsTrigger value="leaver" className="px-8 text-[10px] font-bold uppercase rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none">
            <UserMinus className="w-3.5 h-3.5 mr-2" /> Offboarding
          </TabsTrigger>
          <TabsTrigger value="bundles" className="px-8 text-[10px] font-bold uppercase rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none">
            <Package className="w-3.5 h-3.5 mr-2" /> Berechtigungspakete
          </TabsTrigger>
        </TabsList>

        <TabsContent value="joiner">
          <Card className="rounded-none shadow-none border overflow-hidden">
            <CardHeader className="bg-muted/10 border-b py-4">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Neuer Eintritt registrieren
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Vollständiger Name</Label>
                    <Input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="z.B. Max Mustermann" className="rounded-none h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Unternehmens-E-Mail</Label>
                    <Input value={newUserEmail} onChange={e => setNewEmail(e.target.value)} placeholder="name@firma.de" className="rounded-none h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Geplantes Eintrittsdatum</Label>
                    <Input type="date" value={onboardingDate} onChange={e => setOnboardingDate(e.target.value)} className="rounded-none h-11" />
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-[10px] font-bold uppercase text-primary flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" /> 2. Rollenpaket auswählen
                  </Label>
                  <ScrollArea className="h-64 border rounded-none p-2 bg-slate-50/50">
                    <div className="grid grid-cols-1 gap-1.5">
                      {bundles?.filter((b: any) => activeTenantId === 'all' || b.tenantId === activeTenantId).map((bundle: any) => (
                        <div 
                          key={bundle.id} 
                          className={cn(
                            "p-2.5 border cursor-pointer transition-all flex items-center justify-between group rounded-none",
                            selectedBundleId === bundle.id 
                              ? "border-primary bg-primary/5 ring-1 ring-inset ring-primary" 
                              : "bg-white border-slate-200 hover:border-slate-300"
                          )}
                          onClick={() => setSelectedBundleId(bundle.id)}
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-[10px] uppercase group-hover:text-primary transition-colors truncate">{bundle.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[8px] text-muted-foreground uppercase font-bold">{(bundle.entitlementIds || []).length} Rollen</span>
                              <span className="text-[8px] text-slate-300">|</span>
                              <span className="text-[8px] text-muted-foreground truncate max-w-[120px] italic">{bundle.description}</span>
                            </div>
                          </div>
                          {selectedBundleId === bundle.id && <CheckCircle2 className="w-3 h-3 text-primary shrink-0 ml-2" />}
                        </div>
                      ))}
                      {(!bundles || bundles.length === 0) && (
                        <div className="text-center py-10 text-xs text-muted-foreground italic">Keine Pakete für diesen Standort definiert.</div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
            <div className="p-6 border-t bg-slate-50 flex justify-end">
              <Button 
                onClick={startOnboarding} 
                disabled={isActionLoading || !selectedBundleId || !newUserName || !newUserEmail} 
                className="rounded-none font-bold uppercase text-[10px] h-12 px-12 gap-2 tracking-widest shadow-xl"
              >
                {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current" />} Onboarding Prozess starten
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="leaver" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Mitarbeiter suchen für Offboarding..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                className="pl-10 h-10 rounded-none bg-white" 
              />
            </div>
          </div>

          <div className="admin-card overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="py-4 font-bold uppercase text-[10px]">Identität</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Mandant</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Status</TableHead>
                  <TableHead className="text-right font-bold uppercase text-[10px]">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isUsersLoading ? (
                  <TableRow><TableCell colSpan={4} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : users?.filter((u: any) => (activeTenantId === 'all' || u.tenantId === activeTenantId) && u.displayName.toLowerCase().includes(search.toLowerCase())).map((u: any) => (
                  <TableRow key={u.id} className="hover:bg-muted/5 border-b">
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 flex items-center justify-center rounded-full text-[10px] font-bold uppercase text-slate-500">{u.displayName?.charAt(0)}</div>
                        <div>
                          <div className="font-bold text-sm">{u.displayName}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{u.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="rounded-none text-[8px] font-bold uppercase border-primary/20 text-primary">{getTenantSlug(u.tenantId)}</Badge></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("rounded-none text-[9px] font-bold uppercase border-none px-2", u.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500")}>
                        {u.enabled ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-[9px] font-bold uppercase rounded-none border-red-200 text-red-600 hover:bg-red-50" 
                        onClick={() => { setUserToOffboard(u); setIsOffboardConfirmOpen(true); }}
                        disabled={!u.enabled}
                      >
                        Offboarding einleiten
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="bundles">
          <div className="admin-card overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="py-3 font-bold uppercase text-[10px]">Paket-Name</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Mandant</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Inhalt</TableHead>
                  <TableHead className="text-right font-bold uppercase text-[10px]">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isBundlesLoading ? (
                  <TableRow><TableCell colSpan={4} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : bundles?.filter((b: any) => activeTenantId === 'all' || b.tenantId === activeTenantId).map((bundle: any) => (
                  <TableRow key={bundle.id} className="hover:bg-muted/5 border-b">
                    <TableCell className="py-2.5">
                      <div className="font-bold text-[11px] uppercase tracking-tight">{bundle.name}</div>
                      <div className="text-[9px] text-muted-foreground italic truncate max-w-xs">{bundle.description || 'Keine Beschreibung'}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[8px] font-bold uppercase rounded-none px-1.5 h-4.5">{getTenantSlug(bundle.tenantId)}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[10px]">{(bundle.entitlementIds || []).length}</span>
                        <span className="text-[8px] text-muted-foreground uppercase font-bold">Rollen</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none w-48">
                          <DropdownMenuItem onSelect={() => openEditBundle(bundle)}>
                            <Pencil className="w-3.5 h-3.5 mr-2" /> Paket bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600" onSelect={() => { setSelectedBundle(bundle); setIsBundleDeleteOpen(true); }}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {(!bundles || bundles.length === 0) && !isBundlesLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-xs text-muted-foreground italic">Keine Pakete definiert.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Bundle Editor Dialog */}
      <Dialog open={isBundleCreateOpen} onOpenChange={setIsBundleCreateOpen}>
        <DialogContent className="max-w-5xl rounded-none h-[90vh] flex flex-col p-0 overflow-hidden border shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-primary" />
              <DialogTitle className="text-sm font-bold uppercase tracking-widest">
                {selectedBundle ? 'Paket bearbeiten' : 'Neues Rollen-Paket definieren'}
              </DialogTitle>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1 bg-white">
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Paket-Name (Anzeige)</Label>
                    <Input value={bundleName} onChange={e => setBundleName(e.target.value)} placeholder="z.B. Marketing Basis-Set" className="rounded-none h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Interne Beschreibung</Label>
                    <Input value={bundleDesc} onChange={e => setBundleDesc(e.target.value)} placeholder="Zweck des Pakets..." className="rounded-none h-10" />
                  </div>
                </div>
                <div className="p-4 bg-blue-50/50 border border-blue-100 flex items-start gap-3">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                  <p className="text-[10px] text-blue-800 leading-relaxed uppercase font-bold">
                    Ein Paket bündelt mehrere Berechtigungen zu einer Einheit. Dies beschleunigt den Onboarding-Prozess für neue Mitarbeiter signifikant.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold uppercase text-primary flex items-center gap-2">
                    <Layers className="w-4 h-4" /> Verfügbare Rollen ({selectedEntitlementIds.length} gewählt)
                  </Label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 border px-3 py-1 bg-slate-50">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                      <Label className="text-[9px] font-bold uppercase cursor-pointer">Nur Admin-Rollen</Label>
                      <Switch checked={adminOnlyFilter} onCheckedChange={setAdminOnlyFilter} className="scale-75" />
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input 
                        placeholder="Rollen suchen..." 
                        value={roleSearchTerm} 
                        onChange={e => setRoleSearchTerm(e.target.value)} 
                        className="w-64 h-8 pl-8 rounded-none text-xs" 
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {filteredRoles.map((ent: any) => {
                    const isSelected = selectedEntitlementIds.includes(ent.id);
                    const res = resources?.find((r: any) => r.id === ent.resourceId);
                    return (
                      <div 
                        key={ent.id} 
                        className={cn(
                          "p-2 border cursor-pointer transition-all flex items-start justify-between gap-2 group rounded-none",
                          isSelected 
                            ? "bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500" 
                            : "bg-white hover:bg-slate-50 border-slate-200"
                        )}
                        onClick={() => setSelectedEntitlementIds(prev => isSelected ? prev.filter(id => id !== ent.id) : [...prev, ent.id])}
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-[9px] uppercase truncate group-hover:text-primary transition-colors">{ent.name}</p>
                          <p className="text-[8px] text-muted-foreground uppercase font-bold mt-0.5 truncate">{res?.name || 'System'}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {ent.isAdmin && <ShieldAlert className="w-2.5 h-2.5 text-red-600" />}
                          {isSelected && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 bg-slate-50 border-t shrink-0">
            <Button variant="outline" onClick={() => setIsBundleCreateOpen(false)} className="rounded-none h-10 px-8 font-bold uppercase text-[10px]">Abbrechen</Button>
            <Button onClick={handleCreateBundle} disabled={!bundleName || selectedEntitlementIds.length === 0} className="rounded-none h-10 px-12 font-bold uppercase text-[10px] tracking-widest">
              Paket-Konfiguration speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isBundleDeleteOpen} onOpenChange={setIsBundleDeleteOpen}>
        <AlertDialogContent className="rounded-none border-2">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 font-bold uppercase text-sm flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Paket permanent löschen?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              Dies entfernt die definition des Pakets **{selectedBundle?.name}**. 
              Existierende Zuweisungen für Benutzer, die mit diesem Paket erstellt wurden, bleiben im System erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none text-[10px] font-bold uppercase">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBundle} className="bg-red-600 hover:bg-red-700 rounded-none text-[10px] font-bold uppercase">Paket löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isOffboardConfirmOpen} onOpenChange={setIsOffboardConfirmOpen}>
        <AlertDialogContent className="rounded-none border-2">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 font-bold uppercase text-sm flex items-center gap-2">
              <UserMinus className="w-4 h-4" /> Offboarding starten?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              Dies leitet den Deaktivierungsprozess für **{userToOffboard?.displayName}** ein.
              <br/><br/>
              Sämtliche aktiven Berechtigungen werden auf den Status „Pending Removal“ gesetzt und ein Jira-Ticket zur manuellen Durchführung wird generiert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none text-[10px] font-bold uppercase">Abbrechen</AlertDialogCancel>
            <Button onClick={executeOffboarding} className="bg-red-600 hover:bg-red-700 text-white rounded-none text-[10px] font-bold uppercase h-10 px-8" disabled={isActionLoading}>
              {isActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
              Offboarding Bestätigen
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
