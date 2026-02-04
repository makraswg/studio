
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
  ShieldAlert
} from 'lucide-react';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { 
  useFirestore, 
  setDocumentNonBlocking, 
  updateDocumentNonBlocking,
} from '@/firebase';
import { doc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { createJiraTicket, getJiraConfigs } from '@/app/actions/jira-actions';
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

export default function LifecyclePage() {
  const { dataSource, activeTenantId } = useSettings();
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('joiner');
  const [search, setSearch] = useState('');
  
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewEmail] = useState('');
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);
  const [onboardingDate, setOnboardingDate] = useState(new Date().toISOString().split('T')[0]);

  const [isBundleCreateOpen, setIsBundleCreateOpen] = useState(false);
  const [bundleName, setBundleName] = useState('');
  const [bundleDesc, setBundleDesc] = useState('');
  const [selectedEntitlementIds, setSelectedEntitlementIds] = useState<string[]>([]);
  const [roleSearchTerm, setRoleSearchTerm] = useState('');
  const [adminOnlyFilter, setAdminOnlyFilter] = useState(false);

  const [userToOffboard, setUserToOffboard] = useState<any>(null);
  const [isOffboardConfirmOpen, setIsOffboardConfirmOpen] = useState(false);

  const { data: users, refresh: refreshUsers } = usePluggableCollection<any>('users');
  const { data: bundles, refresh: refreshBundles } = usePluggableCollection<any>('bundles');
  const { data: entitlements } = usePluggableCollection<any>('entitlements');
  const { data: resources } = usePluggableCollection<any>('resources');
  const { data: assignments, refresh: refreshAssignments } = usePluggableCollection<any>('assignments');

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredRoles = useMemo(() => {
    if (!entitlements || !resources) return [];
    return entitlements.filter(e => {
      const res = resources.find(r => r.id === e.resourceId);
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
    const bundleId = `bundle-${Math.random().toString(36).substring(2, 9)}`;
    const bundleData = {
      id: bundleId,
      tenantId: activeTenantId === 'all' ? 't1' : activeTenantId,
      name: bundleName,
      description: bundleDesc,
      entitlementIds: selectedEntitlementIds
    };
    if (dataSource === 'mysql') await saveCollectionRecord('bundles', bundleId, bundleData);
    else setDocumentNonBlocking(doc(db, 'bundles', bundleId), bundleData);
    toast({ title: "Bundle erstellt" });
    setIsBundleCreateOpen(false);
    setTimeout(() => refreshBundles(), 200);
  };

  const startOnboarding = async () => {
    if (!newUserName || !newUserEmail || !selectedBundleId) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte alle Felder ausfüllen." });
      return;
    }
    setIsActionLoading(true);
    try {
      const bundle = bundles?.find(b => b.id === selectedBundleId);
      const userId = `u-${Math.random().toString(36).substring(2, 9)}`;
      const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;
      const timestamp = new Date().toISOString();
      const userData = { id: userId, tenantId: targetTenantId, externalId: `MANUAL_${userId}`, displayName: newUserName, email: newUserEmail, enabled: true, onboardingDate, lastSyncedAt: timestamp };
      if (dataSource === 'mysql') await saveCollectionRecord('users', userId, userData);
      else setDocumentNonBlocking(doc(db, 'users', userId), userData);
      const configs = await getJiraConfigs();
      let jiraKey = 'PENDING';
      if (configs.length > 0 && configs[0].enabled) {
        const res = await createJiraTicket(configs[0].id, `ONBOARDING: ${newUserName}`, `Account für ${newUserName} (${targetTenantId})`);
        if (res.success) jiraKey = res.key!;
      }
      for (const eid of bundle.entitlementIds) {
        const assId = `ass-onb-${userId}-${eid}`.substring(0, 50);
        const assData = { id: assId, tenantId: targetTenantId, userId, entitlementId: eid, status: 'requested', grantedBy: 'onboarding-wizard', grantedAt: timestamp, validFrom: onboardingDate, jiraIssueKey: jiraKey, syncSource: 'manual' };
        if (dataSource === 'mysql') await saveCollectionRecord('assignments', assId, assData);
        else setDocumentNonBlocking(doc(db, 'assignments', assId), assData);
      }
      toast({ title: "Onboarding angestoßen" });
      refreshUsers(); refreshAssignments();
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
      const userAssignments = assignments?.filter(a => a.userId === userToOffboard.id && a.status === 'active') || [];
      const configs = await getJiraConfigs();
      let jiraKey = 'OFFB-PENDING';
      if (configs.length > 0 && configs[0].enabled) {
        const res = await createJiraTicket(configs[0].id, `OFFBOARDING: ${userToOffboard.displayName}`, `Deaktivierung für ${userToOffboard.email}`);
        if (res.success) jiraKey = res.key!;
      }
      for (const a of userAssignments) {
        const update = { status: 'pending_removal', jiraIssueKey: jiraKey };
        if (dataSource === 'mysql') await saveCollectionRecord('assignments', a.id, { ...a, ...update });
        else updateDocumentNonBlocking(doc(db, 'assignments', a.id), update);
      }
      toast({ title: "Offboarding eingeleitet" });
      setIsOffboardConfirmOpen(false); refreshAssignments();
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
          <p className="text-sm text-muted-foreground">Prozesse für {activeTenantId === 'all' ? 'alle Standorte' : activeTenantId}.</p>
        </div>
        <Button variant="outline" size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => setIsBundleCreateOpen(true)}>
          <Package className="w-3.5 h-3.5 mr-2" /> Bundle definieren
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 h-12 rounded-none border w-full justify-start gap-2">
          <TabsTrigger value="joiner" className="px-8 text-[10px] font-bold uppercase"><UserPlus className="w-3.5 h-3.5 mr-2" /> Onboarding</TabsTrigger>
          <TabsTrigger value="leaver" className="px-8 text-[10px] font-bold uppercase"><UserMinus className="w-3.5 h-3.5 mr-2" /> Offboarding</TabsTrigger>
          <TabsTrigger value="bundles" className="px-8 text-[10px] font-bold uppercase"><Package className="w-3.5 h-3.5 mr-2" /> Pakete</TabsTrigger>
        </TabsList>

        <TabsContent value="joiner">
          <Card className="rounded-none shadow-none border">
            <CardHeader className="bg-muted/10 border-b"><CardTitle className="text-xs font-bold uppercase">Neuer Eintritt</CardTitle></CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Name</Label><Input value={newUserName} onChange={e => setNewUserName(e.target.value)} className="rounded-none" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">E-Mail</Label><Input value={newUserEmail} onChange={e => setNewEmail(e.target.value)} className="rounded-none" /></div>
              </div>
              <div className="pt-6 border-t">
                <Label className="text-[10px] font-bold uppercase text-primary mb-4 block">Paket wählen</Label>
                <div className="grid grid-cols-2 gap-3">
                  {bundles?.filter(b => activeTenantId === 'all' || b.tenantId === activeTenantId).map(bundle => (
                    <div key={bundle.id} className={cn("p-4 border cursor-pointer", selectedBundleId === bundle.id ? "border-primary bg-primary/5" : "bg-white")} onClick={() => setSelectedBundleId(bundle.id)}>
                      <div className="font-bold text-sm uppercase">{bundle.name}</div>
                      <p className="text-[10px] text-muted-foreground">{bundle.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <div className="p-6 border-t flex justify-end">
              <Button onClick={startOnboarding} disabled={isActionLoading || !selectedBundleId} className="rounded-none font-bold uppercase text-[10px] h-11 px-10 gap-2">
                {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Prozess starten
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="leaver">
          <Card className="rounded-none shadow-none border">
            <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase">Offboarding Zentrale</CardTitle>
              <Input placeholder="Nutzer suchen..." value={search} onChange={e => setSearch(e.target.value)} className="w-64 h-8 rounded-none text-xs" />
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b text-[10px] font-bold uppercase text-left"><tr className="p-4"><th>Identität</th><th>Status</th><th className="text-right p-4">Aktion</th></tr></thead>
                <tbody className="divide-y">
                  {users?.filter(u => (activeTenantId === 'all' || u.tenantId === activeTenantId) && u.displayName.toLowerCase().includes(search.toLowerCase())).map(u => (
                    <tr key={u.id} className="hover:bg-muted/5">
                      <td className="p-4 font-bold">{u.displayName}<br/><span className="text-[10px] text-muted-foreground">{u.email}</span></td>
                      <td className="p-4 text-[10px] uppercase font-bold">{u.enabled ? 'Aktiv' : 'Inaktiv'}</td>
                      <td className="p-4 text-right">
                        <Button variant="outline" size="sm" className="h-8 text-[9px] font-bold uppercase rounded-none border-red-200 text-red-600" onClick={() => { setUserToOffboard(u); setIsOffboardConfirmOpen(true); }}>Offboarding</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bundles">
          <div className="grid grid-cols-3 gap-6">
            {bundles?.filter(b => activeTenantId === 'all' || b.tenantId === activeTenantId).map(bundle => (
              <Card key={bundle.id} className="rounded-none shadow-none border">
                <CardHeader className="bg-muted/10 border-b py-3 font-bold text-xs uppercase">{bundle.name}</CardHeader>
                <CardContent className="p-4 text-xs text-muted-foreground">{bundle.description}</CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isBundleCreateOpen} onOpenChange={setIsBundleCreateOpen}>
        <DialogContent className="max-w-4xl rounded-none">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">Neues Paket definieren</DialogTitle></DialogHeader>
          <div className="py-4 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Paket-Name</Label><Input value={bundleName} onChange={e => setBundleName(e.target.value)} className="rounded-none" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Beschreibung</Label><Input value={bundleDesc} onChange={e => setBundleDesc(e.target.value)} className="rounded-none" /></div>
            </div>
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-bold uppercase text-primary">Verfügbare Rollen</Label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2"><ShieldAlert className="w-3.5 h-3.5 text-red-600" /><Label className="text-[9px] font-bold uppercase">Nur Admin</Label><Switch checked={adminOnlyFilter} onCheckedChange={setAdminOnlyFilter} className="scale-75" /></div>
                  <Input placeholder="Rollen suchen..." value={roleSearchTerm} onChange={e => setRoleSearchTerm(e.target.value)} className="w-48 h-8 rounded-none text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 h-64 overflow-y-auto pr-2 custom-scrollbar">
                {filteredRoles.map(ent => {
                  const isSelected = selectedEntitlementIds.includes(ent.id);
                  const res = resources?.find(r => r.id === ent.resourceId);
                  return (
                    <div key={ent.id} className={cn("p-2 border cursor-pointer text-xs flex items-center justify-between", isSelected ? "bg-primary/5 border-primary" : "bg-white")} onClick={() => setSelectedEntitlementIds(prev => isSelected ? prev.filter(id => id !== ent.id) : [...prev, ent.id])}>
                      <div><p className="font-bold">{ent.name}</p><p className="text-[10px] text-muted-foreground uppercase">{res?.name}</p></div>
                      {ent.isAdmin && <ShieldAlert className="w-3.5 h-3.5 text-red-600" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleCreateBundle} className="rounded-none font-bold uppercase text-[10px] px-10">Paket speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isOffboardConfirmOpen} onOpenChange={setIsOffboardConfirmOpen}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader><AlertDialogTitle className="text-red-600 font-bold uppercase text-sm">Offboarding starten?</AlertDialogTitle><AlertDialogDescription className="text-xs">Dies leitet den Deaktivierungsprozess für {userToOffboard?.displayName} ein.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="rounded-none">Abbrechen</AlertDialogCancel><Button onClick={executeOffboarding} className="bg-red-600 rounded-none text-xs uppercase font-bold" disabled={isActionLoading}>{isActionLoading ? <Loader2 className="animate-spin mr-2" /> : null} Bestätigen</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
