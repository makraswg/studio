
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Network, 
  Loader2, 
  Play, 
  Lock,
  Database,
  Save
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { triggerSyncJobAction } from '@/app/actions/sync-actions';
import { Tenant, SyncJob } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { usePlatformAuth } from '@/context/auth-context';

export default function SyncSettingsPage() {
  const { dataSource, activeTenantId } = useSettings();
  const { user: authUser } = usePlatformAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isJobRunning, setIsJobRunning] = useState<string | null>(null);
  
  const [tenantDraft, setTenantDraft] = useState<Partial<Tenant>>({});

  const { data: tenants, refresh: refreshTenants } = usePluggableCollection<Tenant>('tenants');
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
              <p className="text-[10px] uppercase font-bold text-slate-400 italic">Synchronisiert Identitäten und Abteilungen automatisch.</p>
            </div>
            <Switch 
              checked={!!tenantDraft.ldapEnabled} 
              onCheckedChange={v => setTenantDraft({...tenantDraft, ldapEnabled: v})} 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">LDAP Server URL</Label>
              <Input 
                value={tenantDraft.ldapUrl || ''} 
                onChange={e => setTenantDraft({...tenantDraft, ldapUrl: e.target.value})} 
                placeholder="ldap://dc1.firma.local" 
                className="rounded-xl h-12 border-slate-200 dark:border-slate-800" 
              />
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Port</Label>
              <Input 
                value={tenantDraft.ldapPort || ''} 
                onChange={e => setTenantDraft({...tenantDraft, ldapPort: e.target.value})} 
                placeholder="389 / 636" 
                className="rounded-xl h-12 border-slate-200 dark:border-slate-800" 
              />
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Base DN (Suche)</Label>
              <Input 
                value={tenantDraft.ldapBaseDn || ''} 
                onChange={e => setTenantDraft({...tenantDraft, ldapBaseDn: e.target.value})} 
                placeholder="OU=Users,DC=firma,DC=local" 
                className="rounded-xl h-12 border-slate-200 dark:border-slate-800" 
              />
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">User Filter</Label>
              <Input 
                value={tenantDraft.ldapUserFilter || ''} 
                onChange={e => setTenantDraft({...tenantDraft, ldapUserFilter: e.target.value})} 
                placeholder="(&(objectClass=user)(memberOf=...))" 
                className="rounded-xl h-12 border-slate-200 dark:border-slate-800" 
              />
            </div>
          </div>

          <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white flex items-center gap-2 tracking-widest">
              <Lock className="w-4 h-4 text-primary" /> Bind Credentials
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Bind DN (Nutzer)</Label>
                <Input 
                  value={tenantDraft.ldapBindDn || ''} 
                  onChange={e => setTenantDraft({...tenantDraft, ldapBindDn: e.target.value})} 
                  placeholder="CN=ServiceAccount,..." 
                  className="rounded-xl h-12 border-slate-200 dark:border-slate-800" 
                />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Passwort</Label>
                <Input 
                  type="password"
                  value={tenantDraft.ldapBindPassword || ''} 
                  onChange={e => setTenantDraft({...tenantDraft, ldapBindPassword: e.target.value})} 
                  className="rounded-xl h-12 border-slate-200 dark:border-slate-800 font-mono" 
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-8 border-t border-slate-100 dark:border-slate-800">
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
                <TableHead className="text-right px-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[ 
                { id: 'job-ldap-sync', name: 'LDAP / AD Identitäten-Sync', desc: 'Abgleich der Aufbauorganisation' }, 
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
                      <Badge variant="outline" className={cn(
                        "text-[8px] font-black uppercase rounded-full border-none px-3 h-5", 
                        dbJob?.lastStatus === 'success' ? "bg-emerald-50 text-emerald-700 shadow-sm" : "bg-slate-100 text-slate-500"
                      )}>
                        {dbJob?.lastStatus || 'IDLE'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <Button size="sm" variant="ghost" className="h-9 font-black uppercase text-[10px] tracking-widest px-6 gap-2 hover:bg-primary/10 hover:text-primary transition-all rounded-lg opacity-0 group-hover:opacity-100" disabled={isRunning} onClick={() => handleRunJob(job.id)}>
                        {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        Trigger Job
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
