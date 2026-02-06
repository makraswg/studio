
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
  Plus,
  AlertTriangle,
  Archive,
  RotateCcw
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
import { Bundle } from '@/lib/types';

export default function LifecyclePage() {
  const { dataSource, activeTenantId } = useSettings();
  const db = useFirestore();
  const { user: authUser } = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('joiner');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  
  // Onboarding Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewEmail] = useState('');
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);
  const [onboardingDate, setOnboardingDate] = useState(new Date().toISOString().split('T')[0]);

  // Bundle Editor State
  const [isBundleCreateOpen, setIsBundleCreateOpen] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [bundleName, setBundleName] = useState('');
  const [bundleDesc, setBundleDesc] = useState('');
  const [selectedEntitlementIds, setSelectedEntitlementIds] = useState<string[]>([]);
  const [roleSearchTerm, setRoleSearchTerm] = useState('');
  const [adminOnlyFilter, setAdminOnlyFilter] = useState(false);

  // Offboarding State
  const [userToOffboard, setUserToOffboard] = useState<any>(null);
  const [isOffboardConfirmOpen, setIsOffboardConfirmOpen] = useState(false);

  const { data: users, isLoading: isUsersLoading, refresh: refreshUsers } = usePluggableCollection<any>('users');
  const { data: bundles, isLoading: isBundlesLoading, refresh: refreshBundles } = usePluggableCollection<Bundle>('bundles');
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
    
    const bundleData: Bundle = {
      ...selectedBundle,
      id: bundleId,
      tenantId: targetTenantId,
      name: bundleName,
      description: bundleDesc,
      status: selectedBundle?.status || 'active',
      entitlementIds: selectedEntitlementIds
    };
    
    try {
      const res = await saveCollectionRecord('bundles', bundleId, bundleData, dataSource);
      if (res.success) {
        toast({ title: selectedBundle ? "Paket aktualisiert" : "Paket erstellt" });
        setIsBundleCreateOpen(false);
        refreshBundles();
      } else throw new Error(res.error || "Fehler beim Speichern");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    }
  };

  const handleBundleStatusChange = async (bundle: Bundle, newStatus: 'active' | 'archived') => {
    const updated = { ...bundle, status: newStatus };
    const res = await saveCollectionRecord('bundles', bundle.id, updated, dataSource);
    if (res.success) {
      toast({ title: newStatus === 'archived' ? "Paket archiviert" : "Paket reaktiviert" });
      refreshBundles();
    }
  };

  const openEditBundle = (bundle: Bundle) => {
    setSelectedBundle(bundle);
    setBundleName(bundle.name);
    setBundleDesc(bundle.description || '');
    setSelectedEntitlementIds(bundle.entitlementIds || []);
    setIsBundleCreateOpen(true);
  };

  const startOnboarding = async () => {
    if (!newUserName || !newUserEmail || !selectedBundleId) return;
    setIsActionLoading(true);
    try {
      const bundle = bundles?.find(b => b.id === selectedBundleId);
      if (!bundle) return;
      
      const userId = `u-${Math.random().toString(36).substring(2, 9)}`;
      const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;
      const timestamp = new Date().toISOString();
      
      const userData = { 
        id: userId, tenantId: targetTenantId, displayName: newUserName, email: newUserEmail, enabled: true, status: 'active', onboardingDate, lastSyncedAt: timestamp 
      };

      await saveCollectionRecord('users', userId, userData, dataSource);

      const configs = await getJiraConfigs(dataSource);
      let jiraKey = 'MANUELL';
      
      if (configs.length > 0 && configs[0].enabled) {
        const res = await createJiraTicket(configs[0].id, `ONBOARDING: ${newUserName}`, `Onboarding Bundle: ${bundle.name}`, dataSource);
        if (res.success) jiraKey = res.key!;
      }

      for (const eid of bundle.entitlementIds) {
        const assId = `ass-onb-${userId}-${eid}`.substring(0, 50);
        const assData = { 
          id: assId, tenantId: targetTenantId, userId, entitlementId: eid, status: 'requested', grantedBy: authUser?.email || 'onboarding-wizard', grantedAt: timestamp, validFrom: onboardingDate, jiraIssueKey: jiraKey, syncSource: 'manual' 
        };
        await saveCollectionRecord('assignments', assId, assData, dataSource);
      }

      toast({ title: "Onboarding Prozess aktiv" });
      setNewUserName(''); setNewEmail(''); setSelectedBundleId(null);
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
        const res = await createJiraTicket(configs[0].id, `OFFBOARDING: ${userToOffboard.displayName}`, `Offboarding eingeleitet.`, dataSource);
        if (res.success) jiraKey = res.key!;
      }

      for (const a of userAssignments) {
        const update = { status: 'pending_removal', jiraIssueKey: jiraKey };
        await saveCollectionRecord('assignments', a.id, { ...a, ...update }, dataSource);
      }

      toast({ title: "Offboarding Prozess aktiv" });
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
        <Button variant="outline" size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => { 
          setSelectedBundle(null); setBundleName(''); setBundleDesc(''); setSelectedEntitlementIds([]); setIsBundleCreateOpen(true); 
        }}>
          <Package className="w-3.5 h-3.5 mr-2" /> Paket definieren
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 h-12 rounded-none border w-full justify-start gap-2 p-1">
          <TabsTrigger value="joiner" className="px-8 text-[10px] font-bold uppercase rounded-none">
            <UserPlus className="w-3.5 h-3.5 mr-2" /> Onboarding
          </TabsTrigger>
          <TabsTrigger value="leaver" className="px-8 text-[10px] font-bold uppercase rounded-none">
            <UserMinus className="w-3.5 h-3.5 mr-2" /> Offboarding
          </TabsTrigger>
          <TabsTrigger value="bundles" className="px-8 text-[10px] font-bold uppercase rounded-none">
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
                    <Label className="text-[10px] font-bold uppercase">Vollständiger Name</Label>
                    <Input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Max Mustermann" className="rounded-none h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase">E-Mail</Label>
                    <Input value={newUserEmail} onChange={e => setNewEmail(e.target.value)} placeholder="name@firma.de" className="rounded-none h-11" />
                  </div>
                </div>
                <div className="space-y-4">
                  <Label className="text-[10px] font-bold uppercase text-primary">Rollenpaket</Label>
                  <ScrollArea className="h-64 border p-2 bg-slate-50/50">
                    <div className="grid grid-cols-1 gap-1.5">
                      {bundles?.filter(b => b.status !== 'archived' && (activeTenantId === 'all' || b.tenantId === activeTenantId)).map(bundle => (
                        <div key={bundle.id} className={cn("p-2 border cursor-pointer flex items-center justify-between", selectedBundleId === bundle.id ? "border-primary bg-primary/5" : "bg-white")} onClick={() => setSelectedBundleId(bundle.id)}>
                          <span className="text-[10px] font-bold uppercase">{bundle.name}</span>
                          {selectedBundleId === bundle.id && <CheckCircle2 className="w-3 h-3 text-primary" />}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
            <div className="p-6 border-t bg-slate-50 flex justify-end">
              <Button onClick={startOnboarding} disabled={isActionLoading || !selectedBundleId || !newUserName} className="rounded-none font-bold uppercase text-[10px] h-12 px-12">Onboarding starten</Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="bundles">
          <div className="flex justify-end mb-4">
            <Button variant="ghost" size="sm" className="h-8 text-[9px] font-bold uppercase gap-2" onClick={() => setShowArchived(!showArchived)}>
              {showArchived ? <RotateCcw className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
              {showArchived ? 'Aktive anzeigen' : 'Archiv anzeigen'}
            </Button>
          </div>
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
                {bundles?.filter(b => (showArchived ? b.status === 'archived' : b.status !== 'archived') && (activeTenantId === 'all' || b.tenantId === activeTenantId)).map(bundle => (
                  <TableRow key={bundle.id} className={cn("hover:bg-muted/5 border-b", bundle.status === 'archived' && "opacity-60")}>
                    <TableCell className="font-bold text-[11px] uppercase">{bundle.name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[8px] font-bold uppercase">{getTenantSlug(bundle.tenantId)}</Badge></TableCell>
                    <TableCell><span className="text-[10px] font-bold">{(bundle.entitlementIds || []).length} Rollen</span></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none w-48">
                          <DropdownMenuItem onSelect={() => openEditBundle(bundle)}><Pencil className="w-3.5 h-3.5 mr-2" /> Paket bearbeiten</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className={bundle.status === 'archived' ? "text-emerald-600" : "text-red-600"} 
                            onSelect={() => handleBundleStatusChange(bundle, bundle.status === 'archived' ? 'active' : 'archived')}
                          >
                            {bundle.status === 'archived' ? <RotateCcw className="w-3.5 h-3.5 mr-2" /> : <Archive className="w-3.5 h-3.5 mr-2" />}
                            {bundle.status === 'archived' ? 'Reaktivieren' : 'Archivieren'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isBundleCreateOpen} onOpenChange={setIsBundleCreateOpen}>
        <DialogContent className="max-w-5xl rounded-none h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-slate-900 text-white">
            <DialogTitle className="text-sm font-bold uppercase">{selectedBundle ? 'Paket bearbeiten' : 'Neues Paket'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 p-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Paket-Name</Label><Input value={bundleName} onChange={e => setBundleName(e.target.value)} className="rounded-none" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Beschreibung</Label><Input value={bundleDesc} onChange={e => setBundleDesc(e.target.value)} className="rounded-none" /></div>
            </div>
            <div className="space-y-4 pt-6 border-t">
              <Label className="text-[10px] font-bold uppercase text-primary">Rollen wählen ({selectedEntitlementIds.length})</Label>
              <div className="grid grid-cols-3 gap-2">
                {filteredRoles.map((ent: any) => (
                  <div key={ent.id} className={cn("p-2 border cursor-pointer text-[9px] font-bold uppercase", selectedEntitlementIds.includes(ent.id) ? "bg-emerald-50 border-emerald-500" : "bg-white")} onClick={() => setSelectedEntitlementIds(prev => selectedEntitlementIds.includes(ent.id) ? prev.filter(id => id !== ent.id) : [...prev, ent.id])}>
                    {ent.name}
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-6 bg-slate-50 border-t"><Button onClick={handleCreateBundle} className="rounded-none h-10 px-12">Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
