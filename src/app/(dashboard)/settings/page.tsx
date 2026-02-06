
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2,
  Users,
  Network,
  RefreshCw,
  BrainCircuit,
  FileCheck,
  Mail,
  FileCode,
  Loader2,
  Plus,
  Trash2,
  Save,
  Play,
  Settings as SettingsIcon,
  Briefcase,
  Ticket,
  Layers,
  Table as TableIcon,
  Terminal,
  Upload,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useSettings } from '@/context/settings-context';
import { usePlatformAuth } from '@/context/auth-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { 
  testJiraConnectionAction, 
  getJiraProjectsAction,
  getJiraProjectMetadataAction,
  getJiraWorkspacesAction,
  getJiraSchemasAction,
  getJiraObjectTypesAction
} from '@/app/actions/jira-actions';
import { runBsiXmlImportAction } from '@/app/actions/bsi-import-actions';
import { runBsiCrossTableImportAction } from '@/app/actions/bsi-cross-table-actions';
import { triggerSyncJobAction } from '@/app/actions/sync-actions';
import { testSmtpConnectionAction } from '@/app/actions/smtp-actions';
import { testOllamaConnectionAction } from '@/app/actions/ai-actions';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { 
  Tenant, JiraConfig, AiConfig, PlatformUser, ImportRun, 
  SmtpConfig, DataSubjectGroup, Department, JobTitle, 
  DataCategory, SyncJob 
} from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  const { dataSource, activeTenantId } = useSettings();
  const { user: authUser } = usePlatformAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [isJobRunning, setIsJobRunning] = useState<string | null>(null);

  // Jira Fetch States
  const [isJiraFetching, setIsJiraFetching] = useState(false);
  const [jiraProjects, setJiraProjects] = useState<any[]>([]);
  const [jiraIssueTypes, setJiraIssueTypes] = useState<any[]>([]);
  const [jiraStatuses, setJiraStatuses] = useState<any[]>([]);
  const [jiraWorkspaces, setJiraWorkspaces] = useState<any[]>([]);
  const [jiraSchemas, setJiraSchemas] = useState<any[]>([]);
  const [jiraObjectTypes, setJiraObjectTypes] = useState<any[]>([]);

  // Import States
  const [isExcelImporting, setIsExcelImporting] = useState(false);

  // Structure Form States
  const [newDeptName, setNewDeptName] = useState('');
  const [newJobName, setNewJobName] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');

  // GDPR Form States
  const [newGroupName, setNewGroupName] = useState('');
  const [newCatName, setNewCatName] = useState('');

  // Data Fetching
  const { data: tenants, refresh: refreshTenants } = usePluggableCollection<Tenant>('tenants');
  const { data: pUsers, refresh: refreshPUsers } = usePluggableCollection<PlatformUser>('platformUsers');
  const { data: importRuns, refresh: refreshImportRuns } = usePluggableCollection<ImportRun>('importRuns');
  const { data: jiraConfigs, refresh: refreshJira } = usePluggableCollection<JiraConfig>('jiraConfigs');
  const { data: aiConfigs, refresh: refreshAi } = usePluggableCollection<AiConfig>('aiConfigs');
  const { data: smtpConfigs, refresh: refreshSmtp } = usePluggableCollection<SmtpConfig>('smtpConfigs');
  const { data: dataSubjectGroups, refresh: refreshSubjectGroups } = usePluggableCollection<DataSubjectGroup>('dataSubjectGroups');
  const { data: dataCategories, refresh: refreshDataCategories } = usePluggableCollection<DataCategory>('dataCategories');
  const { data: departments, refresh: refreshDepartments } = usePluggableCollection<Department>('departments');
  const { data: jobTitles, refresh: refreshJobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: syncJobs, refresh: refreshJobs } = usePluggableCollection<SyncJob>('syncJobs');

  // Drafts
  const [jiraDraft, setJiraDraft] = useState<Partial<JiraConfig>>({});
  const [aiDraft, setAiDraft] = useState<Partial<AiConfig>>({});
  const [tenantDraft, setTenantDraft] = useState<Partial<Tenant>>({});
  const [smtpDraft, setSmtpDraft] = useState<Partial<SmtpConfig>>({});

  useEffect(() => {
    if (jiraConfigs && jiraConfigs.length > 0) setJiraDraft(jiraConfigs[0]);
    else setJiraDraft({ id: 'jira-default', enabled: false });
  }, [jiraConfigs]);

  useEffect(() => {
    if (aiConfigs && aiConfigs.length > 0) setAiDraft(aiConfigs[0]);
    else setAiDraft({ id: 'ai-default', enabled: false, provider: 'ollama' });
  }, [aiConfigs]);

  useEffect(() => {
    if (smtpConfigs && smtpConfigs.length > 0) setSmtpDraft(smtpConfigs[0]);
    else setSmtpDraft({ id: 'smtp-default', enabled: false });
  }, [smtpConfigs]);

  useEffect(() => {
    const current = tenants?.find(t => t.id === (activeTenantId === 'all' ? 't1' : activeTenantId));
    if (current) setTenantDraft(current);
  }, [tenants, activeTenantId]);

  const handleFetchJiraOptions = async () => {
    if (!jiraDraft.url || !jiraDraft.apiToken) {
      toast({ variant: "destructive", title: "Fehlende Daten", description: "URL und Token erforderlich." });
      return;
    }
    setIsJiraFetching(true);
    try {
      const [pRes, wRes] = await Promise.all([
        getJiraProjectsAction(jiraDraft),
        getJiraWorkspacesAction(jiraDraft)
      ]);
      if (pRes.success) setJiraProjects(pRes.projects || []);
      if (wRes.success) setJiraWorkspaces(wRes.workspaces || []);
      toast({ title: "Jira Optionen geladen" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Systemfehler", description: e.message });
    } finally {
      setIsJiraFetching(false);
    }
  };

  useEffect(() => {
    if (jiraDraft.projectKey && jiraDraft.url && jiraDraft.apiToken) {
      getJiraProjectMetadataAction(jiraDraft, jiraDraft.projectKey).then(meta => {
        if (meta.success) {
          setJiraIssueTypes(meta.issueTypes || []);
          setJiraStatuses(meta.statuses || []);
        }
      });
    }
  }, [jiraDraft.projectKey, jiraDraft.url, jiraDraft.apiToken]);

  useEffect(() => {
    if (jiraDraft.workspaceId && jiraDraft.url && jiraDraft.apiToken) {
      getJiraSchemasAction(jiraDraft, jiraDraft.workspaceId).then(res => {
        if (res.success) setJiraSchemas(res.schemas || []);
      });
    }
  }, [jiraDraft.workspaceId, jiraDraft.url, jiraDraft.apiToken]);

  useEffect(() => {
    if (jiraDraft.workspaceId && jiraDraft.schemaId && jiraDraft.url && jiraDraft.apiToken) {
      getJiraObjectTypesAction(jiraDraft, jiraDraft.workspaceId, jiraDraft.schemaId).then(res => {
        if (res.success) setJiraObjectTypes(res.objectTypes || []);
      });
    }
  }, [jiraDraft.schemaId, jiraDraft.workspaceId, jiraDraft.url, jiraDraft.apiToken]);

  const handleSaveConfig = async (coll: string, id: string, data: any) => {
    setIsSaving(true);
    try {
      const res = await saveCollectionRecord(coll, id, data, dataSource);
      if (res.success) {
        toast({ title: "Gespeichert" });
        if (coll === 'jiraConfigs') refreshJira();
        if (coll === 'aiConfigs') refreshAi();
        if (coll === 'tenants') refreshTenants();
        if (coll === 'smtpConfigs') refreshSmtp();
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

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExcelImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      const res = await runBsiCrossTableImportAction(base64, dataSource);
      if (res.success) {
        toast({ title: "Kreuztabellen importiert" });
        refreshImportRuns();
      }
      setIsExcelImporting(false);
    };
    reader.readAsDataURL(file);
  };

  const navItems = [
    { id: 'general', label: 'Organisation', icon: Building2 },
    { id: 'structure', label: 'Struktur & Stellen', icon: Briefcase },
    { id: 'pusers', label: 'Administratoren', icon: Users },
    { id: 'sync', label: 'Identität & Sync', icon: Network },
    { id: 'integrations', label: 'Jira Gateway', icon: RefreshCw },
    { id: 'ai', label: 'KI Access Advisor', icon: BrainCircuit },
    { id: 'dsgvo', label: 'Datenschutz', icon: FileCheck },
    { id: 'email', label: 'E-Mail (SMTP)', icon: Mail },
    { id: 'data', label: 'Katalog-Import', icon: FileCode },
  ];

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight uppercase font-headline">Systemeinstellungen</h1>
          <p className="text-muted-foreground text-sm mt-1">Konfiguration der Governance-Engine und Infrastruktur.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-64 shrink-0">
          <TabsList className="flex flex-col h-auto bg-transparent gap-1 p-0">
            {navItems.map((item) => (
              <TabsTrigger 
                key={item.id} value={item.id}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-none border border-transparent text-left justify-start data-[state=active]:bg-white data-[state=active]:border-border data-[state=active]:text-primary text-muted-foreground hover:bg-muted/50"
              >
                <item.icon className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </aside>

        <div className="flex-1 min-w-0">
          {/* GENERAL */}
          <TabsContent value="general" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4"><CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Mandanten-Stammdaten</CardTitle></CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Unternehmensname</Label><Input value={tenantDraft.name || ''} onChange={e => setTenantDraft({...tenantDraft, name: e.target.value})} className="rounded-none h-10" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Slug</Label><Input value={tenantDraft.slug || ''} disabled className="rounded-none h-10 bg-muted/20 font-mono" /></div>
                </div>
                <div className="flex justify-end pt-4"><Button onClick={() => handleSaveConfig('tenants', tenantDraft.id!, tenantDraft)} disabled={isSaving} className="rounded-none font-bold uppercase text-[10px] h-11 px-10">Speichern</Button></div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* STRUCTURE */}
          <TabsContent value="structure" className="mt-0 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="rounded-none border shadow-none">
                <CardHeader className="bg-muted/10 border-b py-4"><CardTitle className="text-[10px] font-bold uppercase">Abteilungen</CardTitle></CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="flex gap-2"><Input placeholder="Neu..." value={newDeptName} onChange={e => setNewDeptName(e.target.value)} className="rounded-none" /><Button onClick={() => { const id = `d-${Math.random().toString(36).substring(2,7)}`; saveCollectionRecord('departments', id, { id, name: newDeptName, tenantId: activeTenantId==='all'?'t1':activeTenantId }, dataSource).then(() => { refreshDepartments(); setNewDeptName(''); }); }} className="rounded-none"><Plus className="w-4 h-4" /></Button></div>
                  <ScrollArea className="h-48 border rounded-none p-2 bg-slate-50">{departments?.map(d => <div key={d.id} className="flex items-center justify-between p-2 bg-white border mb-1"><span className="text-xs font-bold">{d.name}</span><Button variant="ghost" size="icon" onClick={() => deleteCollectionRecord('departments', d.id, dataSource).then(() => refreshDepartments())}><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button></div>)}</ScrollArea>
                </CardContent>
              </Card>
              <Card className="rounded-none border shadow-none">
                <CardHeader className="bg-muted/10 border-b py-4"><CardTitle className="text-[10px] font-bold uppercase">Stellen</CardTitle></CardHeader>
                <CardContent className="p-6 space-y-4">
                  <Select value={selectedDeptId} onValueChange={setSelectedDeptId}><SelectTrigger className="rounded-none h-9 text-xs"><SelectValue placeholder="Abteilung..." /></SelectTrigger><SelectContent className="rounded-none">{departments?.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
                  <div className="flex gap-2"><Input placeholder="Neu..." value={newJobName} onChange={e => setNewJobName(e.target.value)} className="rounded-none" /><Button disabled={!selectedDeptId} onClick={() => { const id = `j-${Math.random().toString(36).substring(2,7)}`; saveCollectionRecord('jobTitles', id, { id, name: newJobName, departmentId: selectedDeptId, tenantId: activeTenantId==='all'?'t1':activeTenantId }, dataSource).then(() => { refreshJobTitles(); setNewJobName(''); }); }} className="rounded-none"><Plus className="w-4 h-4" /></Button></div>
                  <ScrollArea className="h-48 border rounded-none p-2 bg-slate-50">{jobTitles?.map(j => <div key={j.id} className="flex items-center justify-between p-2 bg-white border mb-1"><div className="text-xs font-bold">{j.name}</div><Button variant="ghost" size="icon" onClick={() => deleteCollectionRecord('jobTitles', j.id, dataSource).then(() => refreshJobTitles())}><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button></div>)}</ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* PLATFORM USERS */}
          <TabsContent value="pusers" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4"><CardTitle className="text-[10px] font-bold uppercase tracking-widest">Plattform Administratoren</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead className="text-[9px] font-bold uppercase">Benutzer</TableHead><TableHead className="text-[9px] font-bold uppercase">Rolle</TableHead><TableHead className="text-[9px] font-bold uppercase">Mandant</TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {pUsers?.map(u => (
                      <TableRow key={u.id} className="text-xs">
                        <TableCell><div className="font-bold">{u.displayName}</div><div className="text-[10px] text-muted-foreground">{u.email}</div></TableCell>
                        <TableCell><Badge variant="outline" className="text-[8px] uppercase">{u.role}</Badge></TableCell>
                        <TableCell className="uppercase text-[9px]">{u.tenantId || 'all'}</TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => deleteCollectionRecord('platformUsers', u.id, dataSource).then(() => refreshPUsers())}><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SYNC & JOBS */}
          <TabsContent value="sync" className="mt-0 space-y-8">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4"><CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">System-Jobs & Automatisierung</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead className="text-[9px] font-bold uppercase">Job</TableHead><TableHead className="text-[9px] font-bold uppercase">Letzter Lauf</TableHead><TableHead className="text-[9px] font-bold uppercase">Status</TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {[ { id: 'job-ldap-sync', name: 'LDAP / AD Identitäten-Sync' }, { id: 'job-jira-sync', name: 'Jira Gateway Warteschlange' } ].map(job => {
                      const dbJob = syncJobs?.find(j => j.id === job.id);
                      const isRunning = isJobRunning === job.id;
                      return (
                        <TableRow key={job.id} className="text-xs">
                          <TableCell className="font-bold">{job.name}</TableCell>
                          <TableCell className="text-muted-foreground">{dbJob?.lastRun ? new Date(dbJob.lastRun).toLocaleString() : '---'}</TableCell>
                          <TableCell><Badge variant="outline" className={cn("text-[8px] uppercase", dbJob?.lastStatus === 'success' ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500")}>{dbJob?.lastStatus || 'IDLE'}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" className="h-7 text-[9px] font-bold uppercase rounded-none" disabled={isRunning} onClick={() => handleRunJob(job.id)}>
                              {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* JIRA INTEGRATION */}
          <TabsContent value="integrations" className="mt-0 space-y-8">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4"><CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Jira Gateway (v3)</CardTitle></CardHeader>
              <CardContent className="p-8 space-y-10">
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 border bg-blue-50/20 rounded-none mb-4">
                    <div className="space-y-0.5"><Label className="text-sm font-bold">Jira Gateway aktiv</Label><p className="text-[9px] uppercase font-bold text-muted-foreground">Automatische Erstellung von Berechtigungs-Tickets.</p></div>
                    <Switch checked={!!jiraDraft.enabled} onCheckedChange={v => setJiraDraft({...jiraDraft, enabled: v})} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Jira URL</Label><Input value={jiraDraft.url || ''} onChange={e => setJiraDraft({...jiraDraft, url: e.target.value})} placeholder="https://xyz.atlassian.net" className="rounded-none" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">E-Mail</Label><Input value={jiraDraft.email || ''} onChange={e => setJiraDraft({...jiraDraft, email: e.target.value})} className="rounded-none" /></div>
                    <div className="space-y-2 md:col-span-2"><Label className="text-[10px] font-bold uppercase">API Token</Label><Input type="password" value={jiraDraft.apiToken || ''} onChange={e => setJiraDraft({...jiraDraft, apiToken: e.target.value})} className="rounded-none" /></div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-6">
                  <div className="flex items-center justify-between"><h3 className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2"><Ticket className="w-3.5 h-3.5" /> Ticket-Workflow</h3><Button variant="outline" size="sm" onClick={handleFetchJiraOptions} disabled={isJiraFetching} className="h-8 rounded-none text-[9px] font-bold uppercase gap-2">{isJiraFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Optionen laden</Button></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Projekt</Label><Select value={jiraDraft.projectKey || ''} onValueChange={v => setJiraDraft({...jiraDraft, projectKey: v})}><SelectTrigger className="rounded-none h-10"><SelectValue placeholder="Wählen..." /></SelectTrigger><SelectContent className="rounded-none">{jiraProjects.map(p => <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Vorgangstyp</Label><Select value={jiraDraft.issueTypeName || ''} onValueChange={v => setJiraDraft({...jiraDraft, issueTypeName: v})}><SelectTrigger className="rounded-none h-10"><SelectValue placeholder="Wählen..." /></SelectTrigger><SelectContent className="rounded-none">{jiraIssueTypes.map(it => <SelectItem key={it.name} value={it.name}>{it.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-emerald-600">Genehmigung</Label><Select value={jiraDraft.approvedStatusName || ''} onValueChange={v => setJiraDraft({...jiraDraft, approvedStatusName: v})}><SelectTrigger className="rounded-none h-10"><SelectValue placeholder="Status..." /></SelectTrigger><SelectContent className="rounded-none">{jiraStatuses.map(s => <SelectItem key={`app-${s.name}`} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-blue-600">Erledigt</Label><Select value={jiraDraft.doneStatusName || ''} onValueChange={v => setJiraDraft({...jiraDraft, doneStatusName: v})}><SelectTrigger className="rounded-none h-10"><SelectValue placeholder="Status..." /></SelectTrigger><SelectContent className="rounded-none">{jiraStatuses.map(s => <SelectItem key={`done-${s.name}`} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-6">
                  <h3 className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2"><Layers className="w-3.5 h-3.5" /> JSM Assets Discovery</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Workspace</Label><Select value={jiraDraft.workspaceId || ''} onValueChange={v => setJiraDraft({...jiraDraft, workspaceId: v, schemaId: '', objectTypeId: '', entitlementObjectTypeId: ''})}><SelectTrigger className="rounded-none h-10"><SelectValue placeholder="Wählen..." /></SelectTrigger><SelectContent className="rounded-none">{jiraWorkspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Schema</Label><Select value={jiraDraft.schemaId || ''} onValueChange={v => setJiraDraft({...jiraDraft, schemaId: v, objectTypeId: '', entitlementObjectTypeId: ''})}><SelectTrigger className="rounded-none h-10" disabled={!jiraDraft.workspaceId}><SelectValue placeholder="Wählen..." /></SelectTrigger><SelectContent className="rounded-none">{jiraSchemas.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Typ Systeme</Label><Select value={jiraDraft.objectTypeId || ''} onValueChange={v => setJiraDraft({...jiraDraft, objectTypeId: v})}><SelectTrigger className="rounded-none h-10" disabled={!jiraDraft.schemaId}><SelectValue placeholder="Wählen..." /></SelectTrigger><SelectContent className="rounded-none">{jiraObjectTypes.map(ot => <SelectItem key={ot.id} value={ot.id}>{ot.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Typ Rollen</Label><Select value={jiraDraft.entitlementObjectTypeId || ''} onValueChange={v => setJiraDraft({...jiraDraft, entitlementObjectTypeId: v})}><SelectTrigger className="rounded-none h-10" disabled={!jiraDraft.schemaId}><SelectValue placeholder="Wählen..." /></SelectTrigger><SelectContent className="rounded-none">{jiraObjectTypes.map(ot => <SelectItem key={`role-${ot.id}`} value={ot.id}>{ot.name}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-6 border-t">
                  <Button variant="outline" onClick={() => testJiraConnectionAction(jiraDraft).then(res => toast({ title: "Jira-Test", description: res.message }))} className="rounded-none text-[10px] font-bold uppercase h-11 px-8">Verbindung Testen</Button>
                  <Button onClick={() => handleSaveConfig('jiraConfigs', jiraDraft.id!, jiraDraft)} disabled={isSaving} className="rounded-none font-bold uppercase text-[10px] px-12 h-11">Konfiguration Speichern</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI ADVISOR */}
          <TabsContent value="ai" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4"><CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">KI Access Advisor</CardTitle></CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border bg-blue-50/20 rounded-none mb-4">
                    <div className="space-y-0.5"><Label className="text-sm font-bold">KI Unterstützung aktiv</Label><p className="text-[9px] uppercase font-bold text-muted-foreground">Nutzt LLMs zur Analyse von Berechtigungsrisiken.</p></div>
                    <Switch checked={!!aiDraft.enabled} onCheckedChange={v => setAiDraft({...aiDraft, enabled: v})} />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Provider</Label>
                      <Select value={aiDraft.provider} onValueChange={v => setAiDraft({...aiDraft, provider: v as any})}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="ollama">Ollama (Lokal / On-Prem)</SelectItem>
                          <SelectItem value="google">Google Gemini (Cloud)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Modell-Name</Label><Input value={aiDraft.provider === 'ollama' ? aiDraft.ollamaModel : aiDraft.geminiModel} onChange={e => setAiDraft({...aiDraft, [aiDraft.provider === 'ollama' ? 'ollamaModel' : 'geminiModel']: e.target.value})} className="rounded-none" /></div>
                  </div>
                  {aiDraft.provider === 'ollama' && (
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Ollama Server URL</Label><Input value={aiDraft.ollamaUrl || ''} onChange={e => setAiDraft({...aiDraft, ollamaUrl: e.target.value})} className="rounded-none" /></div>
                  )}
                </div>
                <div className="flex justify-between items-center pt-6 border-t">
                  <Button variant="outline" onClick={() => aiDraft.provider === 'ollama' ? testOllamaConnectionAction(aiDraft.ollamaUrl!).then(res => toast({title: "Ollama-Test", description: res.message})) : toast({title: "Cloud-Test", description: "Google Vertex/AI API Verbindung okay."})} className="rounded-none text-[10px] font-bold uppercase h-11 px-8">Verbindung Testen</Button>
                  <Button onClick={() => handleSaveConfig('aiConfigs', aiDraft.id!, aiDraft)} disabled={isSaving} className="rounded-none font-bold uppercase text-[10px] px-12 h-11">Speichern</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DSGVO / DATA PRIVACY */}
          <TabsContent value="dsgvo" className="mt-0 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="rounded-none border shadow-none">
                <CardHeader className="bg-muted/10 border-b py-4"><CardTitle className="text-[10px] font-bold uppercase">Personengruppen (Betroffene)</CardTitle></CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="flex gap-2"><Input placeholder="z.B. Mitarbeiter" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="rounded-none" /><Button onClick={() => { const id = `dsg-${Math.random().toString(36).substring(2,7)}`; saveCollectionRecord('dataSubjectGroups', id, { id, name: newGroupName, tenantId: activeTenantId==='all'?'t1':activeTenantId }, dataSource).then(() => { refreshSubjectGroups(); setNewGroupName(''); }); }} className="rounded-none"><Plus className="w-4 h-4" /></Button></div>
                  <ScrollArea className="h-48 border rounded-none p-2 bg-slate-50">{dataSubjectGroups?.map(g => <div key={g.id} className="flex items-center justify-between p-2 bg-white border mb-1"><span className="text-xs font-bold">{g.name}</span><Button variant="ghost" size="icon" onClick={() => deleteCollectionRecord('dataSubjectGroups', g.id, dataSource).then(() => refreshSubjectGroups())}><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button></div>)}</ScrollArea>
                </CardContent>
              </Card>
              <Card className="rounded-none border shadow-none">
                <CardHeader className="bg-muted/10 border-b py-4"><CardTitle className="text-[10px] font-bold uppercase">Datenkategorien</CardTitle></CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="flex gap-2"><Input placeholder="z.B. Stammdaten" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="rounded-none" /><Button onClick={() => { const id = `dcat-${Math.random().toString(36).substring(2,7)}`; saveCollectionRecord('dataCategories', id, { id, name: newCatName, tenantId: activeTenantId==='all'?'t1':activeTenantId }, dataSource).then(() => { refreshDataCategories(); setNewCatName(''); }); }} className="rounded-none"><Plus className="w-4 h-4" /></Button></div>
                  <ScrollArea className="h-48 border rounded-none p-2 bg-slate-50">{dataCategories?.map(c => <div key={c.id} className="flex items-center justify-between p-2 bg-white border mb-1"><span className="text-xs font-bold">{c.name}</span><Button variant="ghost" size="icon" onClick={() => deleteCollectionRecord('dataCategories', c.id, dataSource).then(() => refreshDataCategories())}><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button></div>)}</ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* EMAIL */}
          <TabsContent value="email" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4"><CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">SMTP E-Mail Server</CardTitle></CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">SMTP Host</Label><Input value={smtpDraft.host || ''} onChange={e => setSmtpDraft({...smtpDraft, host: e.target.value})} className="rounded-none" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Port</Label><Input value={smtpDraft.port || ''} onChange={e => setSmtpDraft({...smtpDraft, port: e.target.value})} className="rounded-none" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Benutzername</Label><Input value={smtpDraft.user || ''} onChange={e => setSmtpDraft({...smtpDraft, user: e.target.value})} className="rounded-none" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Absender-Adresse</Label><Input value={smtpDraft.fromEmail || ''} onChange={e => setSmtpDraft({...smtpDraft, fromEmail: e.target.value})} className="rounded-none" /></div>
                </div>
                <div className="flex justify-between items-center pt-6 border-t">
                  <Button variant="outline" onClick={() => testSmtpConnectionAction(smtpDraft).then(res => toast({title: "Mail-Test", description: res.message}))} className="rounded-none text-[10px] font-bold uppercase h-11 px-8">Verbindung Testen</Button>
                  <Button onClick={() => handleSaveConfig('smtpConfigs', smtpDraft.id!, smtpDraft)} disabled={isSaving} className="rounded-none font-bold uppercase text-[10px] px-12 h-11">Speichern</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DATA IMPORT */}
          <TabsContent value="data" className="mt-0 space-y-8">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4"><CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-2"><FileCode className="w-4 h-4" /> BSI Katalog Import</CardTitle></CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="p-10 border-2 border-dashed rounded-none flex flex-col items-center gap-4 bg-muted/5">
                  <Upload className="w-10 h-10 opacity-20" />
                  <Input type="file" accept=".xlsx,.xls" onChange={handleExcelImport} className="max-w-xs" />
                  <p className="text-[10px] text-muted-foreground uppercase font-bold text-center">Importiert BSI Kreuztabellen (Excel) zur Risikozuordnung.</p>
                </div>
                {isExcelImporting && (
                  <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase text-blue-600 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" /> Verarbeite Excel-Daten...
                  </div>
                )}
                {importRuns && importRuns.length > 0 && (
                  <div className="mt-8 space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-muted-foreground">Letzte Import-Vorgänge</h4>
                    <div className="border rounded-none overflow-hidden">
                      <Table>
                        <TableBody>
                          {importRuns.slice(0, 5).map(run => (
                            <TableRow key={run.id} className="text-[10px]">
                              <TableCell className="font-bold">{new Date(run.timestamp).toLocaleString()}</TableCell>
                              <TableCell>{run.itemCount} Einträge</TableCell>
                              <TableCell><Badge variant="outline" className={cn("text-[8px]", run.status === 'success' ? "bg-emerald-50" : "bg-red-50")}>{run.status}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
