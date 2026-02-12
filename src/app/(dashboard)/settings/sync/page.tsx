
"use client";

import { useState, useEffect } from 'react';
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
  X
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { triggerSyncJobAction, testLdapConnectionAction } from '@/app/actions/sync-actions';
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

export default function SyncSettingsPage() {
  const router = useRouter();
  const { dataSource, activeTenantId } = useSettings();
  const { user: authUser } = usePlatformAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isJobRunning, setIsJobRunning] = useState<string | null>(null);
  
  const [tenantDraft, setTenantDraft] = useState<Partial<Tenant>>({});
  const [selectedJobMessage, setSelectedJobMessage] = useState<string | null>(null);

  const { data: tenants, refresh: refreshTenants, isLoading: isTenantsLoading } = usePluggableCollection<Tenant>('tenants');
  const { data: syncJobs, refresh: refreshJobs } = usePluggableCollection<SyncJob>('syncJobs');

  useEffect(() => {
    const current = tenants?.find(t => t.id === (activeTenantId === 'all' ? 't1' : activeTenantId));
    if (current) setTenantDraft(current);
  }, [tenants, activeTenantId]);

  const handleSaveLdap = async () => {
    if (!tenantDraft.id) {
      toast({ variant: "destructive", title: "Speichern nicht möglich", description: "Kein Mandant geladen. Bitte unter 'Setup' initialisieren." });
      return;
    }
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
      toast({ 
        title: "LDAP Verbindungstest", 
        description: res.message,
        variant: res.success ? "default" : "destructive" 
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRunJob = async (jobId: string) => {
    setIsJobRunning(jobId);
    try {
      const res = await triggerSyncJobAction(jobId, dataSource, authUser?.email || 'system');
      if (res.success) {
        toast({ title: "Job abgeschlossen" });
        refreshJobs();
      } else {
        toast({ variant: "destructive", title: "Job fehlgeschlagen", description: res.error });
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
        <h3 className="font-bold text-lg text-slate-900">Kein Mandant für Konfiguration gefunden</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
          Es konnte kein Mandanten-Datensatz für die Speicherung der LDAP-Daten identifiziert werden. Bitte führen Sie zuerst die Datenbank-Initialisierung unter „Setup“ durch.
        </p>
        <Button className="mt-6 rounded-xl font-bold px-8 bg-slate-900" onClick={() => router.push('/setup')}>Zum Setup-Center</Button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <Card className="rounded-xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="p-8 bg-slate-50 dark:bg-slate-900/50 border-b shrink-0">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
              <Network className="w-7 h-7" />
            </div>
            <div>
              <CardTitle className="text-xl font-headline font-bold uppercase tracking-tight text-slate-900 dark:text-white">LDAP / Active Directory Sync</CardTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5">Zentrale Identitäts-Synchronisation</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-10">
          <div className="flex items-center justify-between p-6 bg-primary/5 dark:bg-slate-950 rounded-xl border border-primary/10">
            <div className="space-y-1">
              <Label className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase">LDAP Integration aktiv</Label>
              <p className="text-[10px] uppercase font-bold text-slate-400 italic">Synchronisiert Identitäten und Gruppen automatisch.</p>
            </div>
            <Switch 
              checked={!!tenantDraft.ldapEnabled} 
              onCheckedChange={v => setTenantDraft({...tenantDraft, ldapEnabled: v})} 
            />
          </div>

          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-widest">1. Verbindung & Domäne</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">LDAP Server URL</Label>
                <Input value={tenantDraft.ldapUrl || ''} onChange={e => setTenantDraft({...tenantDraft, ldapUrl: e.target.value})} placeholder="ldap://dc1.firma.local" className="rounded-xl h-12" />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Port</Label>
                <Input value={tenantDraft.ldapPort || ''} onChange={e => setTenantDraft({...tenantDraft, ldapPort: e.target.value})} placeholder="389 / 636" className="rounded-xl h-12" />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">AD Domäne</Label>
                <Input value={tenantDraft.ldapDomain || ''} onChange={e => setTenantDraft({...tenantDraft, ldapDomain: e.target.value})} placeholder="firma.local" className="rounded-xl h-12" />
              </div>
              <div className="space-y-3 lg:col-span-3">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Base DN (Suche)</Label>
                <Input value={tenantDraft.ldapBaseDn || ''} onChange={e => setTenantDraft({...tenantDraft, ldapBaseDn: e.target.value})} placeholder="OU=Users,DC=firma,DC=local" className="rounded-xl h-12" />
              </div>
            </div>
          </div>

          <Separator className="bg-slate-100 dark:bg-slate-800" />

          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <KeyRound className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-widest">2. Authentifizierung & Sicherheit</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Bind-Nutzer (UPN Format)</Label>
                <Input value={tenantDraft.ldapBindDn || ''} onChange={e => setTenantDraft({...tenantDraft, ldapBindDn: e.target.value})} placeholder="benutzer@domäne.local" className="rounded-xl h-12" />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Passwort</Label>
                <Input type="password" value={tenantDraft.ldapBindPassword || ''} onChange={e => setTenantDraft({...tenantDraft, ldapBindPassword: e.target.value})} className="rounded-xl h-12 font-mono" />
              </div>
              
              <div className="space-y-6 md:col-span-2 p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap gap-10">
                  <div className="flex items-center gap-3">
                    <Switch checked={!!tenantDraft.ldapUseTls} onCheckedChange={v => setTenantDraft({...tenantDraft, ldapUseTls: v})} />
                    <Label className="text-[10px] font-black uppercase text-slate-700">TLS verwenden</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={!!tenantDraft.ldapAllowInvalidSsl} onCheckedChange={v => setTenantDraft({...tenantDraft, ldapAllowInvalidSsl: v})} />
                    <Label className="text-[10px] font-black uppercase text-slate-700">Unsichere SSL Zertifikate erlauben</Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Client-Side TLS Zertifikat (Public Key)</Label>
                  <Textarea value={tenantDraft.ldapClientCert || ''} onChange={e => setTenantDraft({...tenantDraft, ldapClientCert: e.target.value})} placeholder="-----BEGIN CERTIFICATE----- ..." className="min-h-[100px] font-mono text-[10px] bg-white dark:bg-slate-900" />
                </div>
              </div>
            </div>
          </div>

          <Separator className="bg-slate-100 dark:bg-slate-800" />

          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <FileCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-widest">3. Filter & Attribut-Mapping</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="space-y-3 lg:col-span-3">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">User Filter (LDAP Query)</Label>
                <Input value={tenantDraft.ldapUserFilter || ''} onChange={e => setTenantDraft({...tenantDraft, ldapUserFilter: e.target.value})} placeholder="(&(objectClass=user)(memberOf=...))" className="rounded-xl h-12" />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Attribut: Benutzername</Label>
                <Input value={tenantDraft.ldapAttrUsername || ''} onChange={e => setTenantDraft({...tenantDraft, ldapAttrUsername: e.target.value})} placeholder="sAMAccountName" className="rounded-xl h-12" />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Attribut: Vorname</Label>
                <Input value={tenantDraft.ldapAttrFirstname || ''} onChange={e => setTenantDraft({...tenantDraft, ldapAttrFirstname: e.target.value})} placeholder="givenName" className="rounded-xl h-12" />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Attribut: Nachname</Label>
                <Input value={tenantDraft.ldapAttrLastname || ''} onChange={e => setTenantDraft({...tenantDraft, ldapAttrLastname: e.target.value})} placeholder="sn" className="rounded-xl h-12" />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-indigo-600 ml-1">Attribut: Gruppen (memberOf)</Label>
                <Input value={tenantDraft.ldapAttrGroups || ''} onChange={e => setTenantDraft({...tenantDraft, ldapAttrGroups: e.target.value})} placeholder="memberOf" className="rounded-xl h-12 border-indigo-100" />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-blue-600 ml-1">Attribut: Firma / Organisation</Label>
                <Input value={tenantDraft.ldapAttrCompany || ''} onChange={e => setTenantDraft({...tenantDraft, ldapAttrCompany: e.target.value})} placeholder="company" className="rounded-xl h-12 border-blue-100" />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center pt-10 border-t border-slate-100 dark:border-slate-800 gap-6">
            <Button 
              variant="outline" 
              onClick={handleTestLdap} 
              disabled={isTesting}
              className="rounded-xl h-12 px-10 font-black uppercase text-[10px] tracking-widest border-slate-200 dark:border-slate-800 hover:bg-slate-50 transition-all active:scale-95 gap-2"
            >
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Verbindung Testen
            </Button>
            <Button onClick={handleSaveLdap} disabled={isSaving} className="rounded-xl font-black uppercase text-xs tracking-[0.1em] h-12 px-16 gap-3 bg-primary text-white shadow-lg shadow-primary/20 transition-all active:scale-95">
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              LDAP Einstellungen Speichern
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="p-6 bg-slate-50 dark:bg-slate-900/50 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center text-indigo-600 shadow-inner">
              <Database className="w-5 h-5" />
            </div>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">System-Jobs & Automatisierung</CardTitle>
          </div>
          <Badge className="bg-emerald-100 text-emerald-700 border-none rounded-full text-[8px] font-black uppercase h-5 px-3">Real-time Monitor</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/30">
              <TableRow className="border-slate-100 dark:border-slate-800">
                <TableHead className="py-4 px-6 text-[9px] font-black uppercase text-slate-400 tracking-widest">Sync-Job</TableHead>
                <TableHead className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Letzter Lauf</TableHead>
                <TableHead className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Status</TableHead>
                <TableHead className="text-right px-6 font-bold text-[9px] text-slate-400 uppercase">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[ 
                { id: 'job-ldap-sync', name: 'LDAP / AD Identitäten-Sync', desc: 'Abgleich der Aufbauorganisation & Gruppen' }, 
                { id: 'job-jira-sync', name: 'Jira Gateway Warteschlange', desc: 'Ticket-Status-Abfrage' } 
              ].map(job => {
                const dbJob = syncJobs?.find(j => j.id === job.id);
                const isRunning = isJobRunning === job.id;
                return (
                  <TableRow key={job.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-slate-100 dark:border-slate-800">
                    <TableCell className="py-4 px-6">
                      <div>
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{job.name}</div>
                        <div className="text-[10px] text-slate-400 font-medium italic mt-0.5">{job.desc}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      {dbJob?.lastRun ? new Date(dbJob.lastRun).toLocaleString() : '---'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn(
                          "text-[8px] font-black uppercase rounded-full border-none px-3 h-5", 
                          dbJob?.lastStatus === 'success' ? "bg-emerald-50 text-emerald-700 shadow-sm" : 
                          dbJob?.lastStatus === 'error' ? "bg-red-50 text-red-700 shadow-sm" :
                          "bg-slate-100 text-slate-500"
                        )}>
                          {dbJob?.lastStatus || 'IDLE'}
                        </Badge>
                        {dbJob?.lastStatus === 'error' && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600 animate-pulse" onClick={() => setSelectedJobMessage(dbJob.lastMessage || 'Kein Log vorhanden')}>
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex items-center justify-end gap-2">
                        {dbJob?.lastMessage && (
                          <Button variant="ghost" size="sm" className="h-8 text-[9px] font-black uppercase text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setSelectedJobMessage(dbJob.lastMessage!)}>
                            <FileText className="w-3 h-3 mr-1.5" /> Log
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-9 font-black uppercase text-[10px] tracking-widest px-6 gap-2 hover:bg-primary/10 hover:text-primary transition-all rounded-lg opacity-0 group-hover:opacity-100" disabled={isRunning} onClick={() => handleRunJob(job.id)}>
                          {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                          Trigger Job
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedJobMessage} onOpenChange={v => !v && setSelectedJobMessage(null)}>
        <DialogContent className="max-w-2xl rounded-2xl p-0 overflow-hidden border-none shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center text-primary shadow-lg border border-white/10">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-headline font-bold uppercase tracking-tight">System Log & Diagnose</DialogTitle>
                  <DialogDescription className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-0.5">Letzter Lauf Ergebnis</DialogDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-white/50 hover:text-white" onClick={() => setSelectedJobMessage(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </DialogHeader>
          <div className="p-8">
            <div className="rounded-2xl bg-slate-50 border p-6 shadow-inner">
              <ScrollArea className="max-h-[300px]">
                <pre className="text-xs font-mono text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedJobMessage}
                </pre>
              </ScrollArea>
            </div>
            <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-700 font-medium leading-relaxed italic">
                Falls der Fehler weiterhin besteht, prüfen Sie bitte die Firewall-Freischaltungen für den LDAP-Port und stellen Sie sicher, dass der Bind-Nutzer nicht gesperrt ist.
              </p>
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t">
            <Button className="w-full sm:w-auto rounded-xl font-bold text-xs h-11 px-10 bg-slate-900" onClick={() => setSelectedJobMessage(null)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
