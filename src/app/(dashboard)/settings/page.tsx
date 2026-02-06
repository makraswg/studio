
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

  // Import State XML
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importName, setImportName] = useState('BSI Kompendium');
  const [importVersion, setImportVersion] = useState('2023');
  const [isImporting, setIsImporting] = useState(false);

  // Import State Excel (Cross Table)
  const [selectedExcel, setSelectedExcel] = useState<File | null>(null);
  const [isExcelImporting, setIsExcelImporting] = useState(false);

  // GDPR State
  const [newGroupName, setNewGroupName] = useState('');
  const [newDataCategoryName, setNewDataCategoryName] = useState('');

  // Org Structure State
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newJobTitleName, setNewJobTitleName] = useState('');
  const [selectedDeptIdForJob, setSelectedDeptIdForJob] = useState('');

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

  // Local Form States (Drafts)
  const [jiraDraft, setJiraDraft] = useState<Partial<JiraConfig>>({});
  const [aiDraft, setAiDraft] = useState<Partial<AiConfig>>({});
  const [tenantDraft, setTenantDraft] = useState<Partial<Tenant>>({});
  const [smtpDraft, setSmtpDraft] = useState<Partial<SmtpConfig>>({});

  useEffect(() => {
    if (jiraConfigs && jiraConfigs.length > 0) {
      setJiraDraft(jiraConfigs[0]);
    } else {
      setJiraDraft({ 
        id: 'jira-default', 
        enabled: false, 
        projectKey: '', 
        url: '', 
        email: '', 
        apiToken: '',
        issueTypeName: 'Task',
        approvedStatusName: 'Approved',
        doneStatusName: 'Done',
        autoSyncAssets: false
      });
    }
  }, [jiraConfigs]);

  useEffect(() => {
    if (aiConfigs && aiConfigs.length > 0) {
      setAiDraft(aiConfigs[0]);
    } else {
      setAiDraft({ id: 'ai-default', enabled: false, provider: 'ollama', ollamaUrl: 'http://localhost:11434' });
    }
  }, [aiConfigs]);

  useEffect(() => {
    if (smtpConfigs && smtpConfigs.length > 0) {
      setSmtpDraft(smtpConfigs[0]);
    } else {
      setSmtpDraft({ id: 'smtp-default', enabled: false });
    }
  }, [smtpConfigs]);

  useEffect(() => {
    const current = tenants?.find(t => t.id === (activeTenantId === 'all' ? 't1' : activeTenantId));
    if (current) setTenantDraft(current);
  }, [tenants, activeTenantId]);

  const handleFetchJiraOptions = async () => {
    if (!jiraDraft.url || !jiraDraft.email || !jiraDraft.apiToken) {
      toast({ variant: "destructive", title: "Fehlende Daten", description: "Bitte URL, E-Mail und Token eingeben." });
      return;
    }
    setIsJiraFetching(true);
    try {
      const pRes = await getJiraProjectsAction(jiraDraft);
      if (pRes.success) setJiraProjects(pRes.projects || []);
      
      const wRes = await getJiraWorkspacesAction(jiraDraft);
      if (wRes.success) setJiraWorkspaces(wRes.workspaces || []);

      if (jiraDraft.projectKey) {
        const meta = await getJiraProjectMetadataAction(jiraDraft, jiraDraft.projectKey);
        if (meta.success) {
          setJiraIssueTypes(meta.issueTypes || []);
          setJiraStatuses(meta.statuses || []);
        }
      }

      if (jiraDraft.workspaceId && jiraDraft.schemaId) {
        const sRes = await getJiraSchemasAction(jiraDraft, jiraDraft.workspaceId);
        if (sRes.success) setJiraSchemas(sRes.schemas || []);
        const otRes = await getJiraObjectTypesAction(jiraDraft, jiraDraft.workspaceId, jiraDraft.schemaId);
        if (otRes.success) setJiraObjectTypes(otRes.objectTypes || []);
      }

      toast({ title: "Jira Optionen geladen" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler beim Laden", description: e.message });
    } finally {
      setIsJiraFetching(false);
    }
  };

  const handleSaveConfig = async (collection: string, id: string, data: any) => {
    setIsSaving(true);
    try {
      const res = await saveCollectionRecord(collection, id, data, dataSource);
      if (res.success) {
        toast({ title: "Einstellungen gespeichert" });
        if (collection === 'jiraConfigs') refreshJira();
        if (collection === 'aiConfigs') refreshAi();
        if (collection === 'tenants') refreshTenants();
        if (collection === 'platformUsers') refreshPUsers();
        if (collection === 'smtpConfigs') refreshSmtp();
      } else throw new Error(res.error || "Fehler");
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
      } else {
        throw new Error(res.error || "Fehler bei Job-Ausführung");
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Job Fehler", description: e.message });
    } finally {
      setIsJobRunning(null);
    }
  };

  const handleAddSubjectGroup = async () => {
    if (!newGroupName) return;
    const id = `dsg-${Math.random().toString(36).substring(2, 9)}`;
    const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;
    try {
      const res = await saveCollectionRecord('dataSubjectGroups', id, { id, tenantId: targetTenantId, name: newGroupName }, dataSource);
      if (res.success) {
        setNewGroupName('');
        refreshSubjectGroups();
        toast({ title: "Personengruppe hinzugefügt" });
      }
    } catch (e: any) { toast({ variant: "destructive", title: "Fehler", description: e.message }); }
  };

  const handleAddDataCategory = async () => {
    if (!newDataCategoryName) return;
    const id = `dcat-${Math.random().toString(36).substring(2, 9)}`;
    const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;
    try {
      const res = await saveCollectionRecord('dataCategories', id, { id, tenantId: targetTenantId, name: newDataCategoryName }, dataSource);
      if (res.success) {
        setNewDataCategoryName('');
        refreshDataCategories();
        toast({ title: "Datenkategorie hinzugefügt" });
      }
    } catch (e: any) { toast({ variant: "destructive", title: "Fehler", description: e.message }); }
  };

  const handleDeleteSubjectGroup = async (id: string) => {
    try {
      const res = await deleteCollectionRecord('dataSubjectGroups', id, dataSource);
      if (res.success) { refreshSubjectGroups(); toast({ title: "Gruppe entfernt" }); }
    } catch (e: any) { toast({ variant: "destructive", title: "Fehler", description: e.message }); }
  };

  const handleDeleteDataCategory = async (id: string) => {
    try {
      const res = await deleteCollectionRecord('dataCategories', id, dataSource);
      if (res.success) { refreshDataCategories(); toast({ title: "Datenkategorie entfernt" }); }
    } catch (e: any) { toast({ variant: "destructive", title: "Fehler", description: e.message }); }
  };

  const handleAddDepartment = async () => {
    if (!newDepartmentName) return;
    const id = `dept-${Math.random().toString(36).substring(2, 9)}`;
    const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;
    try {
      const res = await saveCollectionRecord('departments', id, { id, tenantId: targetTenantId, name: newDepartmentName }, dataSource);
      if (res.success) { setNewDepartmentName(''); refreshDepartments(); toast({ title: "Abteilung hinzugefügt" }); }
    } catch (e: any) { toast({ variant: "destructive", title: "Fehler", description: e.message }); }
  };

  const handleAddJobTitle = async () => {
    if (!newJobTitleName || !selectedDeptIdForJob) return;
    const id = `job-${Math.random().toString(36).substring(2, 9)}`;
    const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;
    try {
      const res = await saveCollectionRecord('jobTitles', id, { id, tenantId: targetTenantId, departmentId: selectedDeptIdForJob, name: newJobTitleName }, dataSource);
      if (res.success) { setNewJobTitleName(''); refreshJobTitles(); toast({ title: "Stellenbezeichnung hinzugefügt" }); }
    } catch (e: any) { toast({ variant: "destructive", title: "Fehler", description: e.message }); }
  };

  const handleTestJira = async () => {
    setIsTesting('jira');
    const res = await testJiraConnectionAction(jiraDraft);
    if (res.success) {
      toast({ title: "Jira Verbindung OK", description: res.details });
      handleFetchJiraOptions();
    } else {
      toast({ variant: "destructive", title: "Jira Fehler", description: res.message });
    }
    setIsTesting(null);
  };

  const handleTestSmtp = async () => {
    setIsTesting('smtp');
    const res = await testSmtpConnectionAction(smtpDraft);
    if (res.success) toast({ title: "SMTP Test erfolgreich", description: res.message });
    else toast({ variant: "destructive", title: "SMTP Fehler", description: res.message });
    setIsTesting(null);
  };

  const handleTestAi = async () => {
    if (!aiDraft.ollamaUrl) return;
    setIsTesting('ai');
    const res = await testOllamaConnectionAction(aiDraft.ollamaUrl);
    if (res.success) toast({ title: "Ollama Verbindung OK", description: res.message });
    else toast({ variant: "destructive", title: "Ollama Fehler", description: res.message });
    setIsTesting(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.xml')) {
        toast({ variant: "destructive", title: "Ungültiges Format", description: "Bitte laden Sie eine XML-Datei hoch." });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleExcelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        toast({ variant: "destructive", title: "Ungültiges Format", description: "Bitte laden Sie eine Excel-Datei (.xlsx) hoch." });
        return;
      }
      setSelectedExcel(file);
    }
  };

  const handleRunXmlImport = async () => {
    if (!selectedFile) return;
    setIsImporting(true);
    try {
      const reader = new FileReader();
      const xmlContent = await new Promise<string>((resolve, reject) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error("Fehler beim Lesen der Datei"));
        reader.readAsText(selectedFile);
      });
      const res = await runBsiXmlImportAction({ catalogName: importName, version: importVersion, xmlContent }, dataSource);
      if (res.success) {
        toast({ title: "Import erfolgreich", description: res.message });
        setSelectedFile(null);
        refreshImportRuns();
      } else throw new Error(res.message);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Import fehlgeschlagen", description: e.message });
    } finally {
      setIsImporting(false);
    }
  };

  const handleRunExcelImport = async () => {
    if (!selectedExcel) return;
    setIsExcelImporting(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = (e) => {
          const res = e.target?.result as string;
          resolve(res.split(',')[1]);
        };
        reader.readAsDataURL(selectedExcel);
      });
      const res = await runBsiCrossTableImportAction(base64, dataSource);
      if (res.success) {
        toast({ title: "Excel Import erfolgreich", description: res.message });
        setSelectedExcel(null);
      } else throw new Error(res.message);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Excel Import fehlgeschlagen", description: e.message });
    } finally {
      setIsExcelImporting(false);
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
    { id: 'risks', label: 'Risiko-Steuerung', icon: Scale },
    { id: 'data', label: 'Katalog-Import', icon: FileCode },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
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
                    <Label className="text-[10px] font-bold uppercase">Eindeutiger Slug</Label>
                    <Input value={tenantDraft.slug || ''} disabled className="rounded-none h-10 bg-muted/20 font-mono" />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button onClick={() => handleSaveConfig('tenants', tenantDraft.id!, tenantDraft)} disabled={isSaving} className="rounded-none font-bold uppercase text-[10px] gap-2 px-10 h-11">
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-2" />} Mandant Speichern
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="structure" className="mt-0 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="rounded-none border shadow-none">
                <CardHeader className="bg-muted/10 border-b py-4">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Abteilungen</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="flex gap-2">
                    <Input placeholder="Neue Abteilung..." value={newDepartmentName} onChange={e => setNewDepartmentName(e.target.value)} className="rounded-none h-9 text-xs" />
                    <Button size="sm" onClick={handleAddDepartment} className="rounded-none font-bold uppercase text-[9px]">Hinzufügen</Button>
                  </div>
                  <div className="border rounded-none overflow-hidden max-h-[400px]">
                    <ScrollArea className="h-full">
                      <Table>
                        <TableBody>
                          {departments?.filter(d => activeTenantId === 'all' || d.tenantId === activeTenantId).map(dept => (
                            <TableRow key={dept.id} className="hover:bg-muted/5">
                              <TableCell className="font-bold text-xs">{dept.name}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => { if(confirm("Abteilung löschen?")) deleteCollectionRecord('departments', dept.id, dataSource).then(() => refreshDepartments()); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-none border shadow-none">
                <CardHeader className="bg-muted/10 border-b py-4">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Stellenbezeichnungen</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-3 p-3 bg-slate-50 border rounded-none">
                    <Select value={selectedDeptIdForJob} onValueChange={setSelectedDeptIdForJob}>
                      <SelectTrigger className="h-9 rounded-none text-xs bg-white"><SelectValue placeholder="Abteilung wählen..." /></SelectTrigger>
                      <SelectContent className="rounded-none">{departments?.filter(d => activeTenantId === 'all' || d.tenantId === activeTenantId).map(dept => <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input placeholder="Stellenbezeichnung..." value={newJobTitleName} onChange={e => setNewJobTitleName(e.target.value)} className="rounded-none h-9 text-xs bg-white" />
                    <Button className="w-full h-9 rounded-none font-bold uppercase text-[9px]" onClick={handleAddJobTitle} disabled={!newJobTitleName || !selectedDeptIdForJob}>Hinzufügen</Button>
                  </div>
                  <div className="border rounded-none overflow-hidden max-h-[300px]">
                    <ScrollArea className="h-full">
                      <Table>
                        <TableBody>
                          {jobTitles?.filter(j => activeTenantId === 'all' || j.tenantId === activeTenantId).map(job => (
                            <TableRow key={job.id} className="hover:bg-muted/5">
                              <TableCell>
                                <div className="font-bold text-xs">{job.name}</div>
                                <div className="text-[9px] text-muted-foreground uppercase font-black">{departments?.find(d => d.id === job.departmentId)?.name || '---'}</div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => { if(confirm("Stelle löschen?")) deleteCollectionRecord('jobTitles', job.id, dataSource).then(() => refreshJobTitles()); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="pusers" className="mt-0">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Plattform-Administratoren</CardTitle>
                <Button size="sm" className="h-8 rounded-none text-[9px] font-bold uppercase"><Plus className="w-3.5 h-3.5 mr-1" /> Neu hinzufügen</Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold uppercase py-3 px-6">Nutzer</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Rolle</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-right pr-6">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pUsers?.map(pu => (
                      <TableRow key={pu.id}>
                        <TableCell className="py-3 px-6">
                          <div className="font-bold text-xs">{pu.displayName}</div>
                          <div className="text-[9px] text-muted-foreground">{pu.email}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-[8px] uppercase font-bold rounded-none">{pu.role}</Badge></TableCell>
                        <TableCell className="text-right pr-6"><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-3.5 h-3.5" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sync" className="mt-0 space-y-8">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">LDAP / Active Directory Sync</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="flex items-center justify-between p-4 border bg-muted/5">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold">Verzeichnis-Synchronisation aktiv</Label>
                    <p className="text-xs text-muted-foreground">Benutzer automatisch aus dem LDAP/AD importieren.</p>
                  </div>
                  <Switch checked={!!tenantDraft.ldapEnabled} onCheckedChange={(v) => setTenantDraft({...tenantDraft, ldapEnabled: v})} />
                </div>
                <div className="grid grid-cols-2 gap-6 opacity-80">
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">LDAP URL</Label><Input value={tenantDraft.ldapUrl || ''} onChange={e => setTenantDraft({...tenantDraft, ldapUrl: e.target.value})} placeholder="ldap://domain.local" className="rounded-none h-10" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">LDAP Port</Label><Input value={tenantDraft.ldapPort || '389'} onChange={e => setTenantDraft({...tenantDraft, ldapPort: e.target.value})} className="rounded-none h-10" /></div>
                  <div className="space-y-2 col-span-2"><Label className="text-[10px] font-bold uppercase">Base DN</Label><Input value={tenantDraft.ldapBaseDn || ''} onChange={e => setTenantDraft({...tenantDraft, ldapBaseDn: e.target.value})} placeholder="dc=example,dc=com" className="rounded-none h-10" /></div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button onClick={() => handleSaveConfig('tenants', tenantDraft.id!, tenantDraft)} disabled={isSaving} className="rounded-none font-bold uppercase text-[10px] h-11 px-8">Sync Einstellungen Speichern</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                  <Activity className="w-4 h-4" /> System-Wartung & Jobverarbeitung
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold uppercase py-3 px-6">Aufgabe / Job</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Letzter Lauf</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Status</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-right pr-6">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { id: 'job-ldap-sync', name: 'LDAP/AD Identitäten-Abgleich', icon: Users },
                      { id: 'job-jira-sync', name: 'Jira Gateway Ticket-Sync', icon: RefreshCw }
                    ].map(jobBase => {
                      const dbJob = syncJobs?.find(j => j.id === jobBase.id);
                      const isRunning = isJobRunning === jobBase.id;
                      
                      return (
                        <TableRow key={jobBase.id}>
                          <TableCell className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-slate-100 rounded-none border"><jobBase.icon className="w-3.5 h-3.5 text-slate-600" /></div>
                              <div>
                                <div className="font-bold text-xs">{jobBase.name}</div>
                                <div className="text-[9px] text-muted-foreground uppercase font-mono max-w-xs truncate">{dbJob?.lastMessage || 'Kein Verlauf vorhanden'}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                              <Clock className="w-3 h-3" />
                              {dbJob?.lastRun ? new Date(dbJob.lastRun).toLocaleString() : 'Nie ausgeführt'}
                            </div>
                          </TableCell>
                          <TableCell>
                            {dbJob?.lastStatus ? (
                              <Badge className={cn(
                                "rounded-none text-[8px] font-black uppercase px-2 h-5",
                                dbJob.lastStatus === 'success' ? "bg-emerald-50 text-emerald-700" : 
                                dbJob.lastStatus === 'running' ? "bg-blue-50 text-blue-700 animate-pulse" : 
                                "bg-red-50 text-red-700"
                              )}>
                                {dbJob.lastStatus}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="rounded-none text-[8px] font-black uppercase px-2 h-5">Bereit</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 rounded-none text-[9px] font-black uppercase gap-2 hover:bg-primary hover:text-white transition-all"
                              onClick={() => handleRunJob(jobBase.id)}
                              disabled={isRunning}
                            >
                              {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                              Starten
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
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Jira Cloud URL</Label>
                      <Input value={jiraDraft.url || ''} onChange={e => setJiraDraft({...jiraDraft, url: e.target.value})} placeholder="https://company.atlassian.net" className="rounded-none h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Admin Email</Label>
                      <Input value={jiraDraft.email || ''} onChange={e => setJiraDraft({...jiraDraft, email: e.target.value})} className="rounded-none h-10" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-[10px] font-bold uppercase flex items-center justify-between">
                        API Token
                        <span className="text-[8px] font-black uppercase text-amber-600">Sicherheitskritisch</span>
                      </Label>
                      <Input type="password" value={jiraDraft.apiToken || ''} onChange={e => setJiraDraft({...jiraDraft, apiToken: e.target.value})} className="rounded-none h-10" />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Ticket className="w-3.5 h-3.5" /> Ticket- & Workflow Steuerung
                    </h3>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 rounded-none text-[9px] font-bold uppercase gap-2"
                      onClick={handleFetchJiraOptions}
                      disabled={isJiraFetching}
                    >
                      {isJiraFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Optionen aus Jira laden
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Projekt</Label>
                      <Select value={jiraDraft.projectKey || ''} onValueChange={(v) => setJiraDraft({...jiraDraft, projectKey: v})}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          {jiraProjects.map(p => <SelectItem key={p.key} value={p.key}>{p.name} ({p.key})</SelectItem>)}
                          {jiraProjects.length === 0 && <SelectItem value="none" disabled>Bitte erst Optionen laden</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Vorgangstyp</Label>
                      <Select value={jiraDraft.issueTypeName || ''} onValueChange={(v) => setJiraDraft({...jiraDraft, issueTypeName: v})}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          {jiraIssueTypes.map(it => <SelectItem key={it.id} value={it.name}>{it.name}</SelectItem>)}
                          {jiraIssueTypes.length === 0 && <SelectItem value="none" disabled>Bitte erst Optionen laden</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Genehmigungs-Status</Label>
                      <Select value={jiraDraft.approvedStatusName || ''} onValueChange={(v) => setJiraDraft({...jiraDraft, approvedStatusName: v})}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          {jiraStatuses.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                          {jiraStatuses.length === 0 && <SelectItem value="none" disabled>Bitte erst Optionen laden</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" /> JSM Assets Discovery (Insight)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Workspace</Label>
                      <Select value={jiraDraft.workspaceId || ''} onValueChange={(v) => setJiraDraft({...jiraDraft, workspaceId: v})}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          {jiraWorkspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Assets Schema</Label>
                      <Select value={jiraDraft.schemaId || ''} onValueChange={(v) => setJiraDraft({...jiraDraft, schemaId: v})}>
                        <SelectTrigger className="rounded-none h-10" disabled={!jiraDraft.workspaceId}><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          {jiraSchemas.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Objekttyp für Ressourcen</Label>
                      <Select value={jiraDraft.objectTypeId || ''} onValueChange={(v) => setJiraDraft({...jiraDraft, objectTypeId: v})}>
                        <SelectTrigger className="rounded-none h-10" disabled={!jiraDraft.schemaId}><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          {jiraObjectTypes.map(ot => <SelectItem key={ot.id} value={ot.id}>{ot.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 border bg-slate-50/50 rounded-none">
                    <div className="space-y-0.5">
                      <Label className="text-[10px] font-bold uppercase block">Automatischer Ressourcen-Sync</Label>
                      <span className="text-[8px] text-muted-foreground uppercase">Systeme automatisch mit Jira Assets abgleichen</span>
                    </div>
                    <Switch checked={!!jiraDraft.autoSyncAssets} onCheckedChange={(v) => setJiraDraft({...jiraDraft, autoSyncAssets: v})} />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-6 border-t">
                  <Button variant="outline" onClick={handleTestJira} disabled={isTesting === 'jira'} className="rounded-none text-[10px] font-bold uppercase px-8 h-11 gap-2 border-slate-200">
                    {isTesting === 'jira' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Verbindung Validieren
                  </Button>
                  <Button onClick={() => handleSaveConfig('jiraConfigs', jiraDraft.id!, jiraDraft)} disabled={isSaving} className="rounded-none font-bold uppercase text-[10px] px-12 h-11 bg-slate-900 text-white gap-2">
                    <Save className="w-3.5 h-3.5" /> Jira Konfiguration Speichern
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">KI-Modell & Provider</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-4">
                  <Label className="text-[10px] font-bold uppercase">KI-Anbieter wählen</Label>
                  <Select value={aiDraft.provider} onValueChange={(v: any) => setAiDraft({...aiDraft, provider: v})}>
                    <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="ollama">Ollama (Lokal / On-Premise)</SelectItem>
                      <SelectItem value="google">Google Gemini (Cloud)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {aiDraft.provider === 'ollama' && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Ollama Server URL</Label><Input value={aiDraft.ollamaUrl || ''} onChange={e => setAiDraft({...aiDraft, ollamaUrl: e.target.value})} className="rounded-none h-10" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Modell-Name</Label><Input value={aiDraft.ollamaModel || 'llama3'} onChange={e => setAiDraft({...aiDraft, ollamaModel: e.target.value})} className="rounded-none h-10" /></div>
                  </div>
                )}
                {aiDraft.provider === 'google' && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Gemini Modell</Label><Input value={aiDraft.geminiModel || 'gemini-1.5-flash'} onChange={e => setAiDraft({...aiDraft, geminiModel: e.target.value})} className="rounded-none h-10" /></div>
                  </div>
                )}
                <div className="flex justify-between items-center pt-4">
                  <Button variant="outline" onClick={handleTestAi} disabled={isTesting === 'ai'} className="rounded-none text-[10px] font-bold uppercase h-11 px-8">Modell-Status prüfen</Button>
                  <Button onClick={() => handleSaveConfig('aiConfigs', aiDraft.id!, aiDraft)} disabled={isSaving} className="rounded-none font-bold uppercase text-[10px] h-11 px-10">KI Einstellungen Speichern</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dsgvo" className="mt-0 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="rounded-none border shadow-none">
                <CardHeader className="bg-muted/10 border-b py-4"><CardTitle className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-2"><FileCheck className="w-4 h-4" /> Betroffene Personengruppen</CardTitle></CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="flex gap-2">
                    <Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="z.B. Kunden" className="rounded-none h-9 text-xs" />
                    <Button size="sm" onClick={handleAddSubjectGroup} className="rounded-none font-bold uppercase text-[9px]">Hinzufügen</Button>
                  </div>
                  <div className="border rounded-none max-h-64 overflow-y-auto">
                    <Table><TableBody>{dataSubjectGroups?.filter(g => activeTenantId === 'all' || g.tenantId === activeTenantId).map(g => (
                      <TableRow key={g.id}><TableCell className="text-xs font-bold">{g.name}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleDeleteSubjectGroup(g.id)}><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button></TableCell></TableRow>
                    ))}</TableBody></Table>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-none border shadow-none">
                <CardHeader className="bg-muted/10 border-b py-4"><CardTitle className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-2"><Database className="w-4 h-4" /> Datenkategorien</CardTitle></CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="flex gap-2">
                    <Input value={newDataCategoryName} onChange={e => setNewDataCategoryName(e.target.value)} placeholder="z.B. Gesundheitsdaten" className="rounded-none h-9 text-xs" />
                    <Button size="sm" onClick={handleAddDataCategory} className="rounded-none font-bold uppercase text-[9px]">Hinzufügen</Button>
                  </div>
                  <div className="border rounded-none max-h-64 overflow-y-auto">
                    <Table><TableBody>{dataCategories?.filter(c => activeTenantId === 'all' || c.tenantId === activeTenantId).map(c => (
                      <TableRow key={c.id}><TableCell className="text-xs font-bold">{c.name}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleDeleteDataCategory(c.id)}><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button></TableCell></TableRow>
                    ))}</TableBody></Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="email" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">E-Mail Versand (SMTP)</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2 col-span-2"><Label className="text-[10px] font-bold uppercase">SMTP Host</Label><Input value={smtpDraft.host || ''} onChange={e => setSmtpDraft({...smtpDraft, host: e.target.value})} placeholder="smtp.office365.com" className="rounded-none h-10" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Port</Label><Input value={smtpDraft.port || '587'} onChange={e => setSmtpDraft({...smtpDraft, port: e.target.value})} className="rounded-none h-10" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Absender Adresse</Label><Input value={smtpDraft.fromEmail || ''} onChange={e => setSmtpDraft({...smtpDraft, fromEmail: e.target.value})} placeholder="no-reply@firma.de" className="rounded-none h-10" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">SMTP Benutzer</Label><Input value={smtpDraft.user || ''} onChange={e => setSmtpDraft({...smtpDraft, user: e.target.value})} className="rounded-none h-10" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Passwort</Label><Input type="password" value={smtpDraft.password || ''} onChange={e => setSmtpDraft({...smtpDraft, password: e.target.value})} className="rounded-none h-10" /></div>
                </div>
                <div className="flex justify-between items-center pt-4">
                  <Button variant="outline" onClick={handleTestSmtp} disabled={isTesting === 'smtp'} className="rounded-none text-[10px] font-bold uppercase h-11 px-8">Testmail Senden</Button>
                  <Button onClick={() => handleSaveConfig('smtpConfigs', smtpDraft.id!, smtpDraft)} disabled={isSaving} className="rounded-none font-bold uppercase text-[10px] h-11 px-10">SMTP Speichern</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="risks" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Risiko-Grenzwerte & Steuerung</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="p-4 border bg-orange-50/20 text-[10px] font-bold uppercase text-orange-800 flex items-start gap-3">
                  <Info className="w-4 h-4 shrink-0" />
                  Hier können Sie globale Parameter für die Risiko-Bewertung festlegen. (Standard: BSI 1-5 Matrix).
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Akzeptanz-Grenzwert</Label><Input type="number" defaultValue="8" className="rounded-none h-10" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Review Zyklus (Monate)</Label><Input type="number" defaultValue="12" className="rounded-none h-10" /></div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button className="rounded-none font-bold uppercase text-[10px] h-11 px-10">Parameter Speichern</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="mt-0 space-y-8">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4"><CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-2"><Upload className="w-4 h-4" /> DocBook XML Import (BSI Katalog)</CardTitle></CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Katalog Name</Label><Input value={importName} onChange={e => setImportName(e.target.value)} className="rounded-none" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Version</Label><Input value={importVersion} onChange={e => setImportVersion(e.target.value)} className="rounded-none" /></div>
                </div>
                <div className="border-2 border-dashed p-10 flex flex-col items-center justify-center gap-4 bg-muted/5">
                  <FileUp className="w-10 h-10 text-muted-foreground" />
                  <div className="text-center"><p className="text-xs font-bold uppercase">{selectedFile ? selectedFile.name : 'Keine Datei ausgewählt'}</p><p className="text-[10px] text-muted-foreground mt-1">Nur .xml Dateien (BSI DocBook Format)</p></div>
                  <Input type="file" accept=".xml" onChange={handleFileChange} className="hidden" id="xml-upload" /><Button variant="outline" size="sm" className="rounded-none uppercase font-bold text-[10px]" asChild><label htmlFor="xml-upload" className="cursor-pointer">Datei wählen</label></Button>
                </div>
                <div className="flex justify-end pt-4"><Button onClick={handleRunXmlImport} disabled={!selectedFile || isImporting} className="rounded-none font-bold uppercase text-[10px] gap-2 px-10 h-11">{isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 fill-current" />} Import Starten</Button></div>
              </CardContent>
            </Card>
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4"><CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-2"><TableIcon className="w-4 h-4" /> BSI Kreuztabelle Import (Excel)</CardTitle></CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="border-2 border-dashed p-10 flex flex-col items-center justify-center gap-4 bg-muted/5">
                  <FileCode className="w-10 h-10 text-muted-foreground" />
                  <div className="text-center"><p className="text-xs font-bold uppercase">{selectedExcel ? selectedExcel.name : 'Keine Excel-Datei gewählt'}</p><p className="text-[10px] text-muted-foreground mt-1">Nur .xlsx Dateien (BSI Kreuztabelle)</p></div>
                  <Input type="file" accept=".xlsx" onChange={handleExcelChange} className="hidden" id="excel-upload" /><Button variant="outline" size="sm" className="rounded-none uppercase font-bold text-[10px]" asChild><label htmlFor="excel-upload" className="cursor-pointer">Datei wählen</label></Button>
                </div>
                <div className="flex justify-end pt-4"><Button onClick={handleRunExcelImport} disabled={!selectedExcel || isExcelImporting} className="rounded-none font-bold uppercase text-[10px] gap-2 px-10 h-11">{isExcelImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />} Excel Importieren</Button></div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
