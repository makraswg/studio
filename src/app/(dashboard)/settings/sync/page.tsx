"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Network, 
  RefreshCw, 
  Loader2, 
  Play, 
  ShieldCheck, 
  Lock,
  Globe,
  Database,
  Building2,
  Activity,
  ArrowRight,
  Save,
  ShieldAlert,
  Server,
  KeyRound,
  FileCheck,
  Send,
  Users,
  Info,
  AlertTriangle,
  FileText,
  X,
  UserPlus,
  Check,
  Search
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { 
  triggerSyncJobAction, 
  testLdapConnectionAction, 
  getAdUsersAction,
  importUsersAction 
} from '@/app/actions/sync-actions';
import { Tenant, SyncJob } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { usePlatformAuth } from '@/context/auth-context';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';

// Minimal placeholder tooltip logic because the component is not in context
function Tooltip({ children }: { children: React.ReactNode }) { return <div>{children}</div>; }
function TooltipProvider({ children }: { children: React.ReactNode }) { return <div>{children}</div>; }
function TooltipTrigger({ children }: { children: React.ReactNode }) { return <div>{children}</div>; }
function TooltipContent({ children }: { children: React.ReactNode }) { return null; }

export default function SyncSettingsPage() {
  const router = useRouter();
  const { dataSource, activeTenantId } = useSettings();
  const { user: authUser } = usePlatformAuth();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isJobRunning, setIsJobRunning] = useState<string | null>(null);
  
  const [tenantDraft, setTenantDraft] = useState<Partial<Tenant>>({});
  const [selectedJobMessage, setSelectedJobMessage] = useState<string | null>(null);

  // Import Tool States
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isFetchingAd, setIsFetchingAd] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [adUsers, setAdUsers] = useState<any[]>([]);
  const [selectedAdUsernames, setSelectedAdUsernames] = useState<string[]>([]);
  const [adSearch, setAdSearch] = useState('');

  const { data: tenants, refresh: refreshTenants, isLoading: isTenantsLoading } = usePluggableCollection<Tenant>('tenants');
  const { data: syncJobs, refresh: refreshJobs } = usePluggableCollection<SyncJob>('syncJobs');

  useEffect(() => {
    const current = tenants?.find(t => t.id === (activeTenantId === 'all' ? 't1' : activeTenantId));
    if (current) setTenantDraft(current);
  }, [tenants, activeTenantId]);

  const handleSaveLdap = async () => {
    if (!tenantDraft.id) return;
    setIsSaving(true);
    try {
      const res = await saveCollectionRecord('tenants', tenantDraft.id, tenantDraft, dataSource);
      if (res.success) {
        toast({ title: "LDAP-Konfiguration gespeichert" });
        refreshTenants();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestLdap = async () => {
    setIsTesting(true);
    try {
      const res = await testLdapConnectionAction(tenantDraft);
      toast({ title: "LDAP Test", description: res.message, variant: res.success ? "default" : "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleOpenImport = async () => {
    setIsImportOpen(true);
    setIsFetchingAd(true);
    try {
      const users = await getAdUsersAction(tenantDraft, dataSource);
      setAdUsers(users);
    } catch (e: any) {
      toast({ variant: "destructive", title: "AD Fehler", description: e.message });
    } finally {
      setIsFetchingAd(false);
    }
  };

  const handleImportSelected = async () => {
    if (selectedAdUsernames.length === 0) return;
    setIsImporting(true);
    const usersToProcess = adUsers.filter(u => selectedAdUsernames.includes(u.username));
    try {
      const res = await importUsersAction(usersToProcess, dataSource, authUser?.email || 'system');
      if (res.success) {
        toast({ title: "Import abgeschlossen", description: `${res.count} Benutzer wurden verarbeitet.` });
        setIsImportOpen(false);
        setSelectedAdUsernames([]);
      }
    } finally {
      setIsImporting(false);
    }
  };

  const filteredAdUsers = useMemo(() => {
    if (!adUsers) return [];
    return adUsers.filter(u => 
      u.first?.toLowerCase().includes(adSearch.toLowerCase()) || 
      u.last?.toLowerCase().includes(adSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(adSearch.toLowerCase())
    );
  }, [adUsers, adSearch]);

  const handleRunJob = async (jobId: string) => {
    setIsJobRunning(jobId);
    try {
      const res = await triggerSyncJobAction(jobId, dataSource, authUser?.email || 'system');
      if (res.success) {
        toast({ title: "Job abgeschlossen" });
        refreshJobs();
      }
    } finally {
      setIsJobRunning(null);
    }
  };

  if (!tenantDraft.id && !isTenantsLoading) {
    return (
      <div className="p-12 text-center border-2 border-dashed rounded-2xl bg-slate-50">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h3 className="font-bold text-lg text-slate-900">Kein Mandant gefunden</h3>
        <Button className="mt-6 rounded-xl font-bold px-8" onClick={() => router.push('/settings/organization')}>Zu Mandanten</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
            <Network className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold border-none uppercase tracking-widest">Infrastruktur</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">Identitäts-Synchronisation</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Konfiguration der AD/LDAP Anbindung.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs px-6 border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm transition-all" onClick={handleOpenImport}>
            <UserPlus className="w-3.5 h-3.5 mr-2" /> AD Benutzer importieren
          </Button>
        </div>
      </div>

      <Card className="rounded-xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="p-8 bg-slate-50 dark:bg-slate-900/50 border-b shrink-0">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-primary" /> Sync-Jobs
            </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Job</TableHead>
                        <TableHead>Letzter Lauf</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {syncJobs?.map(job => (
                        <TableRow key={job.id}>
                            <TableCell className="font-medium">{job.name}</TableCell>
                            <TableCell>{job.lastRun ? new Date(job.lastRun).toLocaleString() : 'Nie'}</TableCell>
                            <TableCell>
                                <Badge variant={job.lastStatus === 'success' ? 'default' : job.lastStatus === 'failed' ? 'destructive' : 'outline'}>
                                    {job.lastStatus}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    onClick={() => handleRunJob(job.id)}
                                    disabled={isJobRunning === job.id}
                                >
                                    {isJobRunning === job.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setSelectedJobMessage(job.lastMessage)}><FileText className="w-4 h-4" /></Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>

      <Card className="rounded-xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="p-8 bg-slate-50 dark:bg-slate-900/50 border-b shrink-0">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white flex items-center gap-3">
            <Server className="w-5 h-5 text-primary" /> LDAP-Parameter
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 space-y-10">
          <div className="flex items-center justify-between p-6 bg-primary/5 dark:bg-slate-950 rounded-xl border border-primary/10">
            <div className="space-y-1">
              <Label className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase">LDAP Integration aktiv</Label>
              <p className="text-[10px] uppercase font-bold text-slate-400 italic">Synchronisiert Identitäten und Gruppen automatisch.</p>
            </div>
            <Switch checked={!!tenantDraft.ldapEnabled} onCheckedChange={v => setTenantDraft({...tenantDraft, ldapEnabled: v})} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">LDAP Server URL</Label>
              <Input value={tenantDraft.ldapUrl || ''} onChange={e => setTenantDraft({...tenantDraft, ldapUrl: e.target.value})} placeholder="ldap://dc1.firma.local" className="rounded-xl h-12" />
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Port</Label>
              <Input value={tenantDraft.ldapPort || ''} onChange={e => setTenantDraft({...tenantDraft, ldapPort: e.target.value})} placeholder="389" className="rounded-xl h-12" />
            </div>
            <div className="space-y-3 lg:col-span-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Base DN</Label>
              <Input value={tenantDraft.ldapBaseDn || ''} onChange={e => setTenantDraft({...tenantDraft, ldapBaseDn: e.target.value})} placeholder="OU=Users,DC=firma,DC=local" className="rounded-xl h-12" />
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Bind-User (UPN)</Label>
              <Input value={tenantDraft.ldapBindDn || ''} onChange={e => setTenantDraft({...tenantDraft, ldapBindDn: e.target.value})} placeholder="sync@firma.de" className="rounded-xl h-12" />
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Passwort</Label>
              <Input type="password" value={tenantDraft.ldapBindPassword || ''} onChange={e => setTenantDraft({...tenantDraft, ldapBindPassword: e.target.value})} className="rounded-xl h-12" />
            </div>
            <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">LDAP Domain</Label>
                <Input value={tenantDraft.ldapDomain || ''} onChange={e => setTenantDraft({...tenantDraft, ldapDomain: e.target.value})} placeholder="firma.de" className="rounded-xl h-12" />
            </div>
            <div className="space-y-3 lg:col-span-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Benutzer-Filter</Label>
                <Input value={tenantDraft.ldapUserFilter || ''} onChange={e => setTenantDraft({...tenantDraft, ldapUserFilter: e.target.value})} placeholder="(&(objectClass=user)(memberOf=CN=AppUsers,OU=Groups,DC=firma,DC=local))" className="rounded-xl h-12" />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-100 dark:bg-slate-800 rounded-xl lg:col-span-3">
                <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-200">TLS verwenden</Label>
                </div>
                <Switch checked={!!tenantDraft.ldapUseTls} onCheckedChange={v => setTenantDraft({...tenantDraft, ldapUseTls: v})} />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-100 dark:bg-slate-800 rounded-xl lg:col-span-3">
                <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-200">Unsichere SSL-Zertifikate zulassen</Label>
                </div>
                <Switch checked={!!tenantDraft.ldapAllowInvalidSsl} onCheckedChange={v => setTenantDraft({...tenantDraft, ldapAllowInvalidSsl: v})} />
            </div>
          </div>

          <div className="flex justify-between items-center pt-8 border-t">
            <Button variant="outline" onClick={handleTestLdap} disabled={isTesting} className="rounded-xl h-11 px-10 font-bold text-[10px] uppercase border-slate-200">
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />} Testen
            </Button>
            <Button onClick={handleSaveLdap} disabled={isSaving} className="rounded-xl h-11 px-16 font-bold text-[10px] uppercase shadow-lg shadow-primary/20">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Speichern
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="p-8 bg-slate-50 dark:bg-slate-900/50 border-b shrink-0">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white flex items-center gap-3">
            <Users className="w-5 h-5 text-primary" /> Attribut-Mapping
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Benutzername</Label>
                  <Input value={tenantDraft.ldapAttrUsername || ''} onChange={e => setTenantDraft({...tenantDraft, ldapAttrUsername: e.target.value})} placeholder="sAMAccountName" className="rounded-xl h-12" />
              </div>
              <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Vorname</Label>
                  <Input value={tenantDraft.ldapAttrFirstname || ''} onChange={e => setTenantDraft({...tenantDraft, ldapAttrFirstname: e.target.value})} placeholder="givenName" className="rounded-xl h-12" />
              </div>
              <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nachname</Label>
                  <Input value={tenantDraft.ldapAttrLastname || ''} onChange={e => setTenantDraft({...tenantDraft, ldapAttrLastname: e.target.value})} placeholder="sn" className="rounded-xl h-12" />
              </div>
              <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Gruppen</Label>
                  <Input value={tenantDraft.ldapAttrGroups || ''} onChange={e => setTenantDraft({...tenantDraft, ldapAttrGroups: e.target.value})} placeholder="memberOf" className="rounded-xl h-12" />
              </div>
              <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Firma</Label>
                  <Input value={tenantDraft.ldapAttrCompany || ''} onChange={e => setTenantDraft({...tenantDraft, ldapAttrCompany: e.target.value})} placeholder="company" className="rounded-xl h-12" />
              </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 overflow-hidden flex flex-col rounded-2xl border-none shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-primary shadow-lg border border-white/10">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight">AD Benutzer Import Tool</DialogTitle>
                  <DialogDescription className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-1">Interaktive Selektion aus dem Active Directory</DialogDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsImportOpen(false)} className="text-white/50 hover:text-white"><X className="w-6 h-6" /></Button>
            </div>
          </DialogHeader>

          <div className="p-4 bg-slate-50 border-b flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="AD Suche (Name, E-Mail)..." value={adSearch} onChange={e => setAdSearch(e.target.value)} className="pl-10 h-11 bg-white rounded-xl shadow-none" />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-black uppercase text-slate-400">{selectedAdUsernames.length} ausgewählt</span>
              <Button variant="outline" size="sm" onClick={() => setSelectedAdUsernames(filteredAdUsers.map(u => u.username))} className="h-8 text-[10px] font-bold">Alle wählen</Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedAdUsernames([])} className="h-8 text-[10px] font-bold">Leeren</Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            {isFetchingAd ? (
              <div className="flex flex-col items-center justify-center py-40 gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" />
                <p className="text-[10px] font-bold uppercase text-slate-400 animate-pulse">Durchsuche Active Directory...</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead className="w-12 px-6"></TableHead>
                    <TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400 uppercase">AD Benutzer</TableHead>
                    <TableHead className="font-bold text-[11px] text-slate-400 uppercase">Abteilung (AD)</TableHead>
                    <TableHead className="font-bold text-[11px] text-slate-400 uppercase">Zugeordnete Firma (Hub-Match)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAdUsers.map((u) => (
                    <TableRow key={u.username} className={cn("group hover:bg-slate-50 transition-colors border-b", selectedAdUsernames.includes(u.username) && "bg-primary/5")}>
                      <TableCell className="px-6">
                        <Checkbox 
                          checked={selectedAdUsernames.includes(u.username)} 
                          onCheckedChange={(v) => setSelectedAdUsernames(prev => !!v ? [...prev, u.username] : prev.filter(n => n !== u.username))} 
                        />
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-slate-800">{u.first} {u.last}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{u.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] font-bold h-5 px-2 bg-slate-50">{u.dept}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className={cn("w-3.5 h-3.5", u.matchedTenantId ? "text-primary" : "text-amber-500")} />
                          <span className={cn("text-xs font-bold", u.matchedTenantId ? "text-slate-700" : "text-amber-600")}>
                            {u.matchedTenantName}
                          </span>
                          {!u.matchedTenantId && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger><AlertTriangle className="w-3 h-3 text-amber-500" /></TooltipTrigger>
                                <TooltipContent>Schreibweise im AD weicht stark ab. Fallback auf Standard-Mandant.</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>

          <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
              <Info className="w-4 h-4" />
              <span>Matching nutzt Fuzzy-Logik (z.B. Baecker ↔ Bäcker)</span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setIsImportOpen(false)} className="rounded-xl font-bold text-[10px] h-11 px-8 uppercase">Abbrechen</Button>
              <Button onClick={handleImportSelected} disabled={isImporting || selectedAdUsernames.length === 0} className="rounded-xl h-11 px-12 bg-primary text-white font-bold text-[10px] uppercase shadow-lg gap-2">
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" /> }
                Import starten ({selectedAdUsernames.length})
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedJobMessage} onOpenChange={() => setSelectedJobMessage(null)}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Job-Log</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-96">
                  <pre className="text-xs bg-slate-100 p-4 rounded-md">{selectedJobMessage}</pre>
              </ScrollArea>
          </DialogContent>
      </Dialog>

    </div>
  );
}
