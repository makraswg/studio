
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Save, 
  Database,
  Loader2,
  Building2,
  Network,
  Mail,
  BrainCircuit,
  Info,
  Scale,
  Upload,
  CheckCircle2,
  RefreshCw,
  Lock,
  ChevronRight,
  Users,
  Plus,
  Trash2,
  MoreHorizontal,
  Shield,
  FileCode,
  AlertTriangle,
  History,
  Terminal,
  Layers,
  FileUp,
  Settings as SettingsIcon,
  Fingerprint,
  Workflow,
  Table as TableIcon,
  FileCheck,
  Briefcase,
  Database as DbIcon,
  Key,
  Globe,
  Zap,
  Ticket,
  Clock,
  Activity,
  Play,
  Search,
  Eye,
  ArrowRight
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useSettings } from '@/context/settings-context';
import { usePlatformAuth } from '@/context/auth-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { 
  testJiraConnectionAction, 
  getJiraConfigs,
  getJiraProjectsAction,
  getJiraProjectMetadataAction,
  getJiraWorkspacesAction,
  getJiraSchemasAction,
  getJiraObjectTypesAction
} from '@/app/actions/jira-actions';
import { runBsiXmlImportAction } from '@/app/actions/bsi-import-actions';
import { runBsiCrossTableImportAction } from '@/app/actions/bsi-cross-table-actions';
import { triggerSyncJobAction } from '@/app/actions/sync-actions';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { Tenant, JiraConfig, AiConfig, PlatformUser, ImportRun, Catalog, SmtpConfig, DataSubjectGroup, Department, JobTitle, DataCategory, SyncJob } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { testSmtpConnectionAction } from '@/app/actions/smtp-actions';
import { testOllamaConnectionAction } from '@/app/actions/ai-actions';

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importName, setImportName] = useState('BSI Kompendium');
  const [importVersion, setImportVersion] = useState('2023');
  const [isImporting, setIsImporting] = useState(false);
  const [selectedExcel, setSelectedExcel] = useState<File | null>(null);
  const [isExcelImporting, setIsExcelImporting] = useState(false);

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
    if (jiraConfigs && jiraConfigs.length > 0) {
      setJiraDraft(jiraConfigs[0]);
    } else {
      setJiraDraft({ id: 'jira-default', enabled: false, issueTypeName: 'Task', approvedStatusName: 'Approved', doneStatusName: 'Done' });
    }
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
      else toast({ variant: "destructive", title: "Assets Fehler", description: wRes.error });

      if (jiraDraft.projectKey) {
        const meta = await getJiraProjectMetadataAction(jiraDraft, jiraDraft.projectKey);
        if (meta.success) {
          setJiraIssueTypes(meta.issueTypes || []);
          setJiraStatuses(meta.statuses || []);
        }
      }

      if (jiraDraft.workspaceId) {
        const sRes = await getJiraSchemasAction(jiraDraft, jiraDraft.workspaceId);
        if (sRes.success) setJiraSchemas(sRes.schemas || []);
      }

      toast({ title: "Jira Optionen geladen" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Systemfehler", description: e.message });
    } finally {
      setIsJiraFetching(false);
    }
  };

  // Kaskaden für Assets
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
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
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

  const handleTestJira = async () => {
    setIsTesting('jira');
    const res = await testJiraConnectionAction(jiraDraft);
    if (res.success) {
      toast({ title: "Jira OK", description: res.details });
      handleFetchJiraOptions();
    } else {
      toast({ variant: "destructive", title: "Jira Fehler", description: res.message });
    }
    setIsTesting(null);
  };

  const handleRunXmlImport = async () => {
    if (!selectedFile) return;
    setIsImporting(true);
    try {
      const xml = await selectedFile.text();
      const res = await runBsiXmlImportAction({ catalogName: importName, version: importVersion, xmlContent: xml }, dataSource);
      if (res.success) {
        toast({ title: "Import erfolgreich" });
        refreshImportRuns();
      }
    } finally {
      setIsImporting(false);
    }
  };

  const navItems = [
    { id: 'general', label: 'Organisation', icon: Building2 },
    { id: 'structure', label: 'Struktur & Stellen', icon: Briefcase },
    { id: 'pusers', label: 'Plattform-Nutzer', icon: Users },
    { id: 'sync', label: 'Identität & Sync', icon: Network },
    { id: 'integrations', label: 'Jira Gateway', icon: RefreshCw },
    { id: 'ai', label: 'KI Access Advisor', icon: BrainCircuit },
    { id: 'dsgvo', label: 'Datenschutz (DSGVO)', icon: FileCheck },
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
                key={item.id} 
                value={item.id}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-none border border-transparent transition-all text-left justify-start data-[state=active]:bg-white data-[state=active]:border-border data-[state=active]:shadow-sm data-[state=active]:text-primary text-muted-foreground hover:bg-muted/50",
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </aside>

        <div className="flex-1 min-w-0">
          <TabsContent value="general" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Mandanten-Stammdaten</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase">Unternehmensname</Label>
                    <Input value={tenantDraft.name || ''} onChange={e => setTenantDraft({...tenantDraft, name: e.target.value})} className="rounded-none h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase">Slug</Label>
                    <Input value={tenantDraft.slug || ''} disabled className="rounded-none h-10 bg-muted/20 font-mono" />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button onClick={() => handleSaveConfig('tenants', tenantDraft.id!, tenantDraft)} disabled={isSaving} className="rounded-none font-bold uppercase text-[10px] h-11 px-10">Speichern</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="mt-0 space-y-8">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Jira Service Management Gateway
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-10">
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 border bg-blue-50/20 rounded-none">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold">Jira Ticket-Gateway aktiv</Label>
                      <p className="text-xs text-muted-foreground">Automatisches Erstellen von Onboarding/Audit Tickets.</p>
                    </div>
                    <Switch checked={!!jiraDraft.enabled} onCheckedChange={(v) => setJiraDraft({...jiraDraft, enabled: v})} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Jira URL</Label><Input value={jiraDraft.url || ''} onChange={e => setJiraDraft({...jiraDraft, url: e.target.value})} placeholder="https://xyz.atlassian.net" className="rounded-none" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Admin Email</Label><Input value={jiraDraft.email || ''} onChange={e => setJiraDraft({...jiraDraft, email: e.target.value})} className="rounded-none" /></div>
                    <div className="space-y-2 md:col-span-2"><Label className="text-[10px] font-bold uppercase">API Token</Label><Input type="password" value={jiraDraft.apiToken || ''} onChange={e => setJiraDraft({...jiraDraft, apiToken: e.target.value})} className="rounded-none" /></div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-muted-foreground">Ticket Workflow</h3>
                    <Button variant="outline" size="sm" onClick={handleFetchJiraOptions} disabled={isJiraFetching} className="h-8 rounded-none text-[9px] font-bold uppercase gap-2">
                      {isJiraFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Optionen laden
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Projekt</Label>
                      <Select value={jiraDraft.projectKey || ''} onValueChange={(v) => setJiraDraft({...jiraDraft, projectKey: v})}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          {jiraProjects.map(p => <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Vorgangstyp</Label>
                      <Select value={jiraDraft.issueTypeName || ''} onValueChange={(v) => setJiraDraft({...jiraDraft, issueTypeName: v})}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          {jiraIssueTypes.map(it => <SelectItem key={it.name} value={it.name}>{it.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-emerald-600">Genehmigungs-Status</Label>
                      <Select value={jiraDraft.approvedStatusName || ''} onValueChange={(v) => setJiraDraft({...jiraDraft, approvedStatusName: v})}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          {jiraStatuses.map(s => <SelectItem key={`app-${s.name}`} value={s.name}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-blue-600">Erledigt-Status</Label>
                      <Select value={jiraDraft.doneStatusName || ''} onValueChange={(v) => setJiraDraft({...jiraDraft, doneStatusName: v})}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          {jiraStatuses.map(s => <SelectItem key={`done-${s.name}`} value={s.name}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-6">
                  <h3 className="text-xs font-black uppercase text-muted-foreground">Assets Discovery</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Workspace</Label>
                      <Select value={jiraDraft.workspaceId || ''} onValueChange={(v) => setJiraDraft({...jiraDraft, workspaceId: v, schemaId: '', objectTypeId: '', entitlementObjectTypeId: ''})}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          {jiraWorkspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Schema</Label>
                      <Select value={jiraDraft.schemaId || ''} onValueChange={(v) => setJiraDraft({...jiraDraft, schemaId: v, objectTypeId: '', entitlementObjectTypeId: ''})}>
                        <SelectTrigger className="rounded-none h-10" disabled={!jiraDraft.workspaceId}><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          {jiraSchemas.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Objekttyp Systeme</Label>
                      <Select value={jiraDraft.objectTypeId || ''} onValueChange={(v) => setJiraDraft({...jiraDraft, objectTypeId: v})}>
                        <SelectTrigger className="rounded-none h-10" disabled={!jiraDraft.schemaId}><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          {jiraObjectTypes.map(ot => <SelectItem key={ot.id} value={ot.id}>{ot.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Objekttyp Rollen</Label>
                      <Select value={jiraDraft.entitlementObjectTypeId || ''} onValueChange={(v) => setJiraDraft({...jiraDraft, entitlementObjectTypeId: v})}>
                        <SelectTrigger className="rounded-none h-10" disabled={!jiraDraft.schemaId}><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          {jiraObjectTypes.map(ot => <SelectItem key={`role-${ot.id}`} value={ot.id}>{ot.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-6 border-t">
                  <Button variant="outline" onClick={handleTestJira} disabled={isTesting === 'jira'} className="rounded-none text-[10px] font-bold uppercase h-11 px-8">
                    {isTesting === 'jira' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Verbindung Testen
                  </Button>
                  <Button onClick={() => handleSaveConfig('jiraConfigs', jiraDraft.id!, jiraDraft)} disabled={isSaving} className="rounded-none font-bold uppercase text-[10px] px-12 h-11 bg-slate-900 text-white">
                    Konfiguration Speichern
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ... Weitere Tabs analog zum vorherigen Stand ... */}
        </div>
      </Tabs>
    </div>
  );
}
