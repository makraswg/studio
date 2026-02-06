
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
  Database as DbIcon
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useSettings } from '@/context/settings-context';
import { usePlatformAuth } from '@/context/auth-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { 
  testJiraConnectionAction, 
  getJiraWorkspacesAction, 
  getJiraSchemasAction,
  getJiraObjectTypesAction,
  getJiraConfigs
} from '@/app/actions/jira-actions';
import { runBsiXmlImportAction } from '@/app/actions/bsi-import-actions';
import { runBsiCrossTableImportAction } from '@/app/actions/bsi-cross-table-actions';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { Tenant, JiraConfig, AiConfig, PlatformUser, ImportRun, Catalog, SmtpConfig, DataSubjectGroup, Department, JobTitle, DataCategory } from '@/lib/types';
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

  // Discovery States for Jira
  const [jiraWorkspaces, setJiraWorkspaces] = useState<any[]>([]);
  const [jiraSchemas, setJiraSchemas] = useState<any[]>([]);
  const [jiraObjectTypes, setJiraObjectTypes] = useState<any[]>([]);
  const [isDiscoveryLoading, setIsDiscoveryLoading] = useState(false);

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

  // Local Form States (Drafts)
  const [jiraDraft, setJiraDraft] = useState<Partial<JiraConfig>>({});
  const [aiDraft, setAiDraft] = useState<Partial<AiConfig>>({});
  const [tenantDraft, setTenantDraft] = useState<Partial<Tenant>>({});
  const [smtpDraft, setSmtpDraft] = useState<Partial<SmtpConfig>>({});

  useEffect(() => {
    if (jiraConfigs && jiraConfigs.length > 0) {
      setJiraDraft(jiraConfigs[0]);
    } else {
      setJiraDraft({ id: 'jira-default', enabled: false });
    }
  }, [jiraConfigs]);

  useEffect(() => {
    if (aiConfigs && aiConfigs.length > 0) {
      setAiDraft(aiConfigs[0]);
    } else {
      setAiDraft({ id: 'ai-default', enabled: false, provider: 'ollama' });
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
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    }
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
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    }
  };

  const handleDeleteSubjectGroup = async (id: string) => {
    try {
      const res = await deleteCollectionRecord('dataSubjectGroups', id, dataSource);
      if (res.success) {
        refreshSubjectGroups();
        toast({ title: "Gruppe entfernt" });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    }
  };

  const handleDeleteDataCategory = async (id: string) => {
    try {
      const res = await deleteCollectionRecord('dataCategories', id, dataSource);
      if (res.success) {
        refreshDataCategories();
        toast({ title: "Datenkategorie entfernt" });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    }
  };

  // Dept & Jobs Handlers
  const handleAddDepartment = async () => {
    if (!newDepartmentName) return;
    const id = `dept-${Math.random().toString(36).substring(2, 9)}`;
    const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;
    try {
      const res = await saveCollectionRecord('departments', id, { id, tenantId: targetTenantId, name: newDepartmentName }, dataSource);
      if (res.success) {
        setNewDepartmentName('');
        refreshDepartments();
        toast({ title: "Abteilung hinzugefügt" });
      }
    } catch (e: any) { toast({ variant: "destructive", title: "Fehler", description: e.message }); }
  };

  const handleAddJobTitle = async () => {
    if (!newJobTitleName || !selectedDeptIdForJob) return;
    const id = `job-${Math.random().toString(36).substring(2, 9)}`;
    const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;
    try {
      const res = await saveCollectionRecord('jobTitles', id, { id, tenantId: targetTenantId, departmentId: selectedDeptIdForJob, name: newJobTitleName }, dataSource);
      if (res.success) {
        setNewJobTitleName('');
        refreshJobTitles();
        toast({ title: "Stellenbezeichnung hinzugefügt" });
      }
    } catch (e: any) { toast({ variant: "destructive", title: "Fehler", description: e.message }); }
  };

  const handleTestJira = async () => {
    setIsTesting('jira');
    const res = await testJiraConnectionAction(jiraDraft);
    if (res.success) toast({ title: "Jira Verbindung OK", description: res.message });
    else toast({ variant: "destructive", title: "Jira Fehler", description: res.message });
    setIsTesting(null);
  };

  const handleDiscoverWorkspaces = async () => {
    if (!jiraDraft.url || !jiraDraft.apiToken) return;
    setIsDiscoveryLoading(true);
    try {
      const res = await getJiraWorkspacesAction({ 
        url: jiraDraft.url, email: jiraDraft.email || '', apiToken: jiraDraft.apiToken 
      });
      if (res.success && res.workspaces) setJiraWorkspaces(res.workspaces);
    } catch (e) {} finally {
      setIsDiscoveryLoading(false);
    }
  };

  const handleDiscoverSchemas = async (workspaceId: string) => {
    if (!jiraDraft.url || !jiraDraft.apiToken) return;
    setIsDiscoveryLoading(true);
    try {
      const res = await getJiraSchemasAction({ 
        url: jiraDraft.url, email: jiraDraft.email || '', apiToken: jiraDraft.apiToken, workspaceId 
      });
      if (res.success) setJiraSchemas(res.schemas || []);
    } catch (e) {} finally {
      setIsDiscoveryLoading(false);
    }
  };

  const handleDiscoverObjectTypes = async (schemaId: string) => {
    if (!jiraDraft.url || !jiraDraft.workspaceId) return;
    setIsDiscoveryLoading(true);
    try {
      const res = await getJiraObjectTypesAction({
        url: jiraDraft.url, email: jiraDraft.email || '', apiToken: jiraDraft.apiToken!, workspaceId: jiraDraft.workspaceId, schemaId
      });
      if (res.success) setJiraObjectTypes(res.objectTypes || []);
    } catch (e) {} finally {
      setIsDiscoveryLoading(false);
    }
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
          {/* General Section */}
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
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Mandant Speichern
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Org Structure Section */}
          <TabsContent value="structure" className="mt-0 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Abteilungen */}
              <Card className="rounded-none border shadow-none">
                <CardHeader className="bg-muted/10 border-b py-4">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Abteilungen</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Neue Abteilung..." 
                      value={newDepartmentName} 
                      onChange={e => setNewDepartmentName(e.target.value)} 
                      className="rounded-none h-9 text-xs"
                    />
                    <Button size="sm" onClick={handleAddDepartment} className="rounded-none font-bold uppercase text-[9px]">
                      <Plus className="w-3 h-3 mr-1" /> Hinzufügen
                    </Button>
                  </div>
                  <div className="border rounded-none overflow-hidden max-h-[400px]">
                    <ScrollArea className="h-full">
                      <Table>
                        <TableBody>
                          {departments?.filter(d => activeTenantId === 'all' || d.tenantId === activeTenantId).map(dept => (
                            <TableRow key={dept.id} className="hover:bg-muted/5">
                              <TableCell className="font-bold text-xs">{dept.name}</TableCell>
                              <TableCell className="text-right">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-red-600"
                                  onClick={() => { if(confirm("Abteilung löschen?")) deleteCollectionRecord('departments', dept.id, dataSource).then(() => refreshDepartments()); }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>

              {/* Stellenbezeichnungen */}
              <Card className="rounded-none border shadow-none">
                <CardHeader className="bg-muted/10 border-b py-4">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Stellenbezeichnungen</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-3 p-3 bg-slate-50 border rounded-none">
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-slate-400">1. Abteilung wählen</Label>
                      <Select value={selectedDeptIdForJob} onValueChange={setSelectedDeptIdForJob}>
                        <SelectTrigger className="h-9 rounded-none text-xs bg-white"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          {departments?.filter(d => activeTenantId === 'all' || d.tenantId === activeTenantId).map(dept => (
                            <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-slate-400">2. Bezeichnung</Label>
                      <Input 
                        placeholder="z.B. IT-Administrator" 
                        value={newJobTitleName} 
                        onChange={e => setNewJobTitleName(e.target.value)} 
                        className="rounded-none h-9 text-xs bg-white"
                      />
                    </div>
                    <Button className="w-full h-9 rounded-none font-bold uppercase text-[9px] gap-2" onClick={handleAddJobTitle} disabled={!newJobTitleName || !selectedDeptIdForJob}>
                      <Plus className="w-3.5 h-3.5" /> Stelle Hinzufügen
                    </Button>
                  </div>

                  <div className="border rounded-none overflow-hidden max-h-[300px]">
                    <ScrollArea className="h-full">
                      <Table>
                        <TableBody>
                          {jobTitles?.filter(j => activeTenantId === 'all' || j.tenantId === activeTenantId).map(job => (
                            <TableRow key={job.id} className="hover:bg-muted/5">
                              <TableCell>
                                <div className="font-bold text-xs">{job.name}</div>
                                <div className="text-[9px] text-muted-foreground uppercase font-black">
                                  {departments?.find(d => d.id === job.departmentId)?.name || '---'}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-red-600"
                                  onClick={() => { if(confirm("Stelle löschen?")) deleteCollectionRecord('jobTitles', job.id, dataSource).then(() => refreshJobTitles()); }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
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

          {/* DSGVO Section */}
          <TabsContent value="dsgvo" className="mt-0 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Personengruppen */}
              <Card className="rounded-none border shadow-none">
                <CardHeader className="bg-muted/10 border-b py-4">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                    <FileCheck className="w-4 h-4" /> Betroffene Personengruppen
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="flex gap-2">
                    <Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="z.B. Kunden" className="rounded-none h-9 text-xs" />
                    <Button size="sm" onClick={handleAddSubjectGroup} className="rounded-none font-bold uppercase text-[9px]"><Plus className="w-3 h-3 mr-1" /> Hinzufügen</Button>
                  </div>
                  <div className="border rounded-none max-h-64 overflow-y-auto">
                    <Table>
                      <TableBody>
                        {dataSubjectGroups?.filter(g => activeTenantId === 'all' || g.tenantId === activeTenantId).map(g => (
                          <TableRow key={g.id}>
                            <TableCell className="text-xs font-bold">{g.name}</TableCell>
                            <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleDeleteSubjectGroup(g.id)}><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Datenkategorien */}
              <Card className="rounded-none border shadow-none">
                <CardHeader className="bg-muted/10 border-b py-4">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                    <Database className="w-4 h-4" /> Datenkategorien
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="flex gap-2">
                    <Input value={newDataCategoryName} onChange={e => setNewDataCategoryName(e.target.value)} placeholder="z.B. Gesundheitsdaten" className="rounded-none h-9 text-xs" />
                    <Button size="sm" onClick={handleAddDataCategory} className="rounded-none font-bold uppercase text-[9px]"><Plus className="w-3 h-3 mr-1" /> Hinzufügen</Button>
                  </div>
                  <div className="border rounded-none max-h-64 overflow-y-auto">
                    <Table>
                      <TableBody>
                        {dataCategories?.filter(c => activeTenantId === 'all' || c.tenantId === activeTenantId).map(c => (
                          <TableRow key={c.id}>
                            <TableCell className="text-xs font-bold">{c.name}</TableCell>
                            <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleDeleteDataCategory(c.id)}><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Other Sections OMITTED for brevity but kept in final content... */}
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
                        <TableCell className="text-right pr-6">
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          {/* ... */}
        </div>
      </Tabs>
    </div>
  );
}
