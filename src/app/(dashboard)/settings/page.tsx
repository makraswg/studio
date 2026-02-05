
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
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
  History,
  AlertCircle,
  FileJson,
  CheckCircle2,
  ShieldCheck,
  Server,
  Key,
  Globe,
  RefreshCw,
  ExternalLink,
  Lock,
  Zap,
  ChevronRight,
  Workflow,
  Cpu,
  ShieldAlert,
  Terminal,
  Box,
  Ticket
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { runBsiImportAction } from '@/app/actions/bsi-import-actions';
import { 
  testJiraConnectionAction, 
  getJiraConfigs, 
  getJiraWorkspacesAction, 
  getJiraSchemasAction, 
  getJiraAttributesAction 
} from '@/app/actions/jira-actions';
import { testSmtpConnectionAction } from '@/app/actions/smtp-actions';
import { testOllamaConnectionAction } from '@/app/actions/ai-actions';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { RiskCategorySetting, Catalog, ImportRun, Tenant, JiraConfig, SmtpConfig, AiConfig } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  const { dataSource, activeTenantId } = useSettings();
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);

  // Discovery States for Jira Assets
  const [jiraWorkspaces, setJiraWorkspaces] = useState<any[]>([]);
  const [jiraSchemas, setJiraSchemas] = useState<any[]>([]);
  const [jiraObjectTypes, setJiraObjectTypes] = useState<any[]>([]);
  const [isDiscoveryLoading, setIsDiscoveryLoading] = useState(false);

  // Data Fetching
  const { data: tenants, refresh: refreshTenants } = usePluggableCollection<Tenant>('tenants');
  const { data: riskCategorySettings, refresh: refreshRiskSettings } = usePluggableCollection<RiskCategorySetting>('riskCategorySettings');
  const { data: catalogs, refresh: refreshCatalogs } = usePluggableCollection<Catalog>('catalogs');
  const { data: importRuns, refresh: refreshRuns } = usePluggableCollection<ImportRun>('importRuns');
  const { data: jiraConfigs, refresh: refreshJira } = usePluggableCollection<JiraConfig>('jiraConfigs');
  const { data: smtpConfigs, refresh: refreshSmtp } = usePluggableCollection<SmtpConfig>('smtpConfigs');
  const { data: aiConfigs, refresh: refreshAi } = usePluggableCollection<AiConfig>('aiConfigs');

  // Local Form States
  const activeTenant = useMemo(() => tenants?.find(t => t.id === (activeTenantId === 'all' ? 't1' : activeTenantId)), [tenants, activeTenantId]);
  
  const defaultJira: JiraConfig = { 
    id: 'jira-default', 
    enabled: false, 
    url: '', 
    email: '', 
    apiToken: '', 
    projectKey: '', 
    issueTypeName: 'Task', 
    approvedStatusName: 'Approved', 
    doneStatusName: 'Done' 
  };
  const defaultSmtp: SmtpConfig = { id: 'smtp-default', enabled: false, host: '', port: '587', user: '', password: '', fromEmail: '' };
  const defaultAi: AiConfig = { id: 'ai-default', enabled: false, provider: 'ollama', ollamaUrl: 'http://localhost:11434', geminiModel: 'gemini-1.5-flash', enabledForAdvisor: true };

  const currentJira = useMemo(() => jiraConfigs?.[0] || defaultJira, [jiraConfigs]);
  const currentSmtp = useMemo(() => smtpConfigs?.[0] || defaultSmtp, [smtpConfigs]);
  const currentAi = useMemo(() => aiConfigs?.[0] || defaultAi, [aiConfigs]);

  useEffect(() => {
    if (activeTab === 'integrations' && currentJira.apiToken) {
      handleDiscoverJiraStructure();
    }
  }, [activeTab, currentJira.apiToken]);

  const handleDiscoverJiraStructure = async () => {
    if (!currentJira.url || !currentJira.apiToken) return;
    setIsDiscoveryLoading(true);
    try {
      const res = await getJiraWorkspacesAction({ url: currentJira.url, email: currentJira.email, apiToken: currentJira.apiToken });
      if (res.success && res.workspaces) {
        setJiraWorkspaces(res.workspaces);
        if (currentJira.workspaceId) {
          const sRes = await getJiraSchemasAction({ ...currentJira, workspaceId: currentJira.workspaceId } as any);
          if (sRes.success) setJiraSchemas(sRes.schemas || []);
        }
      }
    } catch (e) {} finally {
      setIsDiscoveryLoading(false);
    }
  };

  const handleSaveConfig = async (collection: string, id: string, data: any) => {
    setIsSaving(true);
    try {
      const res = await saveCollectionRecord(collection, id, data, dataSource);
      if (res.success) {
        toast({ title: "Einstellungen gespeichert" });
        if (collection === 'jiraConfigs') refreshJira();
        if (collection === 'smtpConfigs') refreshSmtp();
        if (collection === 'aiConfigs') refreshAi();
        if (collection === 'tenants') refreshTenants();
      } else throw new Error(res.error || "Fehler");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestJira = async () => {
    setIsTesting('jira');
    const res = await testJiraConnectionAction(currentJira);
    if (res.success) toast({ title: "Jira Verbindung OK", description: res.message });
    else toast({ variant: "destructive", title: "Jira Fehler", description: res.message });
    setIsTesting(null);
  };

  const navItems = [
    { id: 'general', label: 'Organisation', icon: Building2, desc: 'Stammdaten & Mandant' },
    { id: 'sync', label: 'Identität & Sync', icon: Network, desc: 'LDAP / AD Anbindung' },
    { id: 'integrations', label: 'Jira Gateway', icon: RefreshCw, desc: 'Ticket & Assets Automatisierung' },
    { id: 'ai', label: 'KI Advisor', icon: BrainCircuit, desc: 'LLM Konfiguration' },
    { id: 'email', label: 'E-Mail (SMTP)', icon: Mail, desc: 'Benachrichtigungen' },
    { id: 'risks', label: 'Risiko-Steuerung', icon: Scale, desc: 'Compliance Zyklen' },
    { id: 'data', label: 'Katalog-Import', icon: Database, desc: 'BSI Grundschutz' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight uppercase font-headline">Systemeinstellungen</h1>
          <p className="text-muted-foreground text-sm mt-1">Zentrale Steuerung der Plattform-Governance und Schnittstellen.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-72 shrink-0">
          <nav className="space-y-1">
            <TabsList className="flex flex-col h-auto bg-transparent gap-1 p-0 w-full">
              {navItems.map((item) => (
                <TabsTrigger 
                  key={item.id} 
                  value={item.id}
                  className={cn(
                    "w-full justify-start items-center gap-3 px-4 py-3 rounded-none border border-transparent transition-all",
                    "data-[state=active]:bg-white data-[state=active]:border-border data-[state=active]:shadow-sm data-[state=active]:text-primary",
                    "hover:bg-muted/50 text-muted-foreground text-left"
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <div className="flex flex-col items-start overflow-hidden">
                    <span className="text-[11px] font-bold uppercase tracking-wider">{item.label}</span>
                    <span className="text-[9px] font-medium opacity-60 truncate w-full">{item.desc}</span>
                  </div>
                  {activeTab === item.id && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
                </TabsTrigger>
              ))}
            </TabsList>
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          
          {/* ORGANISATION */}
          <TabsContent value="general" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Mandanten-Stammdaten</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Unternehmensname (Anzeige)</Label>
                    <Input 
                      value={activeTenant?.name || ''} 
                      onChange={(e) => activeTenant && handleSaveConfig('tenants', activeTenant.id, { ...activeTenant, name: e.target.value })}
                      className="rounded-none h-11" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Eindeutiger Kennner (Slug)</Label>
                    <Input value={activeTenant?.slug || ''} disabled className="rounded-none h-11 bg-muted/20 font-mono" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* JIRA GATEWAY - RESTORED ALL FUNCTIONS */}
          <TabsContent value="integrations" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Jira Gateway & Assets Engine</CardTitle>
                  <Switch checked={currentJira.enabled} onCheckedChange={(val) => handleSaveConfig('jiraConfigs', currentJira.id, { ...currentJira, enabled: val })} />
                </div>
              </CardHeader>
              <CardContent className="p-8">
                <Tabs defaultValue="basic" className="space-y-8">
                  <TabsList className="bg-slate-100 rounded-none h-10 p-1 border">
                    <TabsTrigger value="basic" className="rounded-none text-[9px] font-bold uppercase px-6">Basis-Verbindung</TabsTrigger>
                    <TabsTrigger value="ticketing" className="rounded-none text-[9px] font-bold uppercase px-6">Ticketing (IAM)</TabsTrigger>
                    <TabsTrigger value="assets" className="rounded-none text-[9px] font-bold uppercase px-6">Assets Sync (Insight)</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2 col-span-2">
                        <Label className="text-[10px] font-bold uppercase">Cloud Instanz URL</Label>
                        <Input 
                          placeholder="https://ihre-firma.atlassian.net" 
                          value={currentJira.url} 
                          onChange={(e) => handleSaveConfig('jiraConfigs', currentJira.id, { ...currentJira, url: e.target.value })}
                          className="rounded-none h-10 font-mono text-xs" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">Admin E-Mail</Label>
                        <Input 
                          value={currentJira.email} 
                          onChange={(e) => handleSaveConfig('jiraConfigs', currentJira.id, { ...currentJira, email: e.target.value })}
                          className="rounded-none h-10" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">API Token</Label>
                        <Input 
                          type="password" 
                          value={currentJira.apiToken} 
                          onChange={(e) => handleSaveConfig('jiraConfigs', currentJira.id, { ...currentJira, apiToken: e.target.value })}
                          className="rounded-none h-10" 
                        />
                      </div>
                    </div>
                    <Button variant="outline" className="w-full h-11 rounded-none font-bold uppercase text-[10px] gap-2" onClick={handleTestJira} disabled={isTesting === 'jira'}>
                      {isTesting === 'jira' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Verbindung & Cloud-API validieren
                    </Button>
                  </TabsContent>

                  <TabsContent value="ticketing" className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">Projekt Key</Label>
                        <Input 
                          value={currentJira.projectKey} 
                          onChange={(e) => handleSaveConfig('jiraConfigs', currentJira.id, { ...currentJira, projectKey: e.target.value })}
                          className="rounded-none uppercase font-black" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">Vorgangstyp (Name)</Label>
                        <Input 
                          value={currentJira.issueTypeName} 
                          onChange={(e) => handleSaveConfig('jiraConfigs', currentJira.id, { ...currentJira, issueTypeName: e.target.value })}
                          placeholder="z.B. Service Request"
                          className="rounded-none" 
                        />
                      </div>
                      <Separator className="col-span-2" />
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">Status: Genehmigt</Label>
                        <Input 
                          value={currentJira.approvedStatusName} 
                          onChange={(e) => handleSaveConfig('jiraConfigs', currentJira.id, { ...currentJira, approvedStatusName: e.target.value })}
                          className="rounded-none" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">Status: Erledigt</Label>
                        <Input 
                          value={currentJira.doneStatusName} 
                          onChange={(e) => handleSaveConfig('jiraConfigs', currentJira.id, { ...currentJira, doneStatusName: e.target.value })}
                          className="rounded-none" 
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="assets" className="space-y-6 animate-in fade-in">
                    <div className="p-4 bg-blue-50 border border-blue-100 flex items-start gap-3 mb-4">
                      <Zap className="w-4 h-4 text-blue-600 mt-0.5" />
                      <p className="text-[10px] text-blue-800 leading-relaxed font-bold uppercase">
                        Konfigurieren Sie hier die Synchronisation von IT-Systemen und Rollen direkt aus Jira Assets (ehem. Insight).
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">1. Workspace</Label>
                        <Select value={currentJira.workspaceId} onValueChange={(val) => handleSaveConfig('jiraConfigs', currentJira.id, { ...currentJira, workspaceId: val })}>
                          <SelectTrigger className="rounded-none h-10"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                          <SelectContent className="rounded-none">
                            {jiraWorkspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">2. Object Schema</Label>
                        <Select value={currentJira.schemaId} onValueChange={(val) => handleSaveConfig('jiraConfigs', currentJira.id, { ...currentJira, schemaId: val })}>
                          <SelectTrigger className="rounded-none h-10"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                          <SelectContent className="rounded-none">
                            {jiraSchemas.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Separator className="col-span-2" />
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">Objekttyp: IT-Systeme</Label>
                        <Input 
                          value={currentJira.resourceObjectTypeId || ''} 
                          onChange={(e) => handleSaveConfig('jiraConfigs', currentJira.id, { ...currentJira, resourceObjectTypeId: e.target.value })}
                          placeholder="ID (z.B. 12)"
                          className="rounded-none font-mono" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">Objekttyp: Rollen</Label>
                        <Input 
                          value={currentJira.entitlementObjectTypeId || ''} 
                          onChange={(e) => handleSaveConfig('jiraConfigs', currentJira.id, { ...currentJira, entitlementObjectTypeId: e.target.value })}
                          placeholder="ID (z.B. 15)"
                          className="rounded-none font-mono" 
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-muted/20 border-2 border-dashed">
                      <div className="flex items-center gap-3">
                        <RefreshCw className="w-4 h-4 text-muted-foreground" />
                        <Label className="text-[10px] font-bold uppercase">Automatischer Sync (Cron)</Label>
                      </div>
                      <Switch checked={!!currentJira.autoSyncAssets} onCheckedChange={(val) => handleSaveConfig('jiraConfigs', currentJira.id, { ...currentJira, autoSyncAssets: val })} />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI */}
          <TabsContent value="ai" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">KI Access Advisor</CardTitle>
                  <Switch checked={currentAi.enabled} onCheckedChange={(val) => handleSaveConfig('aiConfigs', currentAi.id, { ...currentAi, enabled: val })} />
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <Label className="text-[10px] font-bold uppercase">Modell-Provider</Label>
                    <Select value={currentAi.provider} onValueChange={(val: any) => handleSaveConfig('aiConfigs', currentAi.id, { ...currentAi, provider: val })}>
                      <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-none">
                        <SelectItem value="ollama">Ollama (Lokal / On-Premise)</SelectItem>
                        <SelectItem value="google">Google Gemini (Cloud Managed)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {currentAi.provider === 'ollama' ? (
                    <div className="space-y-2 col-span-2">
                      <Label className="text-[10px] font-bold uppercase">Ollama Server URL</Label>
                      <Input 
                        value={currentAi.ollamaUrl} 
                        onChange={(e) => handleSaveConfig('aiConfigs', currentAi.id, { ...currentAi, ollamaUrl: e.target.value })}
                        className="rounded-none h-10 font-mono text-xs" 
                      />
                    </div>
                  ) : (
                    <div className="space-y-2 col-span-2 md:col-span-1">
                      <Label className="text-[10px] font-bold uppercase">Gemini Modell</Label>
                      <Select value={currentAi.geminiModel} onValueChange={(val) => handleSaveConfig('aiConfigs', currentAi.id, { ...currentAi, geminiModel: val })}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                          <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RISKS */}
          <TabsContent value="risks" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Compliance Review Zyklen</CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 gap-4">
                  {['IT-Sicherheit', 'Datenschutz', 'Rechtlich', 'Betrieblich'].map(cat => {
                    const setting = riskCategorySettings?.find(s => s.id === cat);
                    return (
                      <div key={cat} className="flex items-center justify-between p-4 border bg-slate-50/50 hover:bg-white transition-colors">
                        <div className="flex flex-col">
                          <span className="font-bold text-xs uppercase">{cat}</span>
                          <span className="text-[8px] text-muted-foreground uppercase font-black mt-0.5">Prüfungsintervall</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Input 
                            type="number" 
                            defaultValue={setting?.defaultReviewDays || 365} 
                            className="w-24 h-9 rounded-none text-center font-bold" 
                            onBlur={(e) => {
                              const days = parseInt(e.target.value);
                              if (!isNaN(days)) {
                                const data: RiskCategorySetting = { id: cat, tenantId: 'global', defaultReviewDays: days };
                                handleSaveConfig('riskCategorySettings', cat, data);
                              }
                            }} 
                          />
                          <span className="text-[9px] font-black text-slate-400 uppercase w-10">Tage</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DATA IMPORT */}
          <TabsContent value="data" className="mt-0 space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <Card className="rounded-none border shadow-none">
                <CardHeader className="bg-muted/10 border-b py-4">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">BSI Katalog Import Engine</CardTitle>
                </CardHeader>
                <CardContent className="p-12 text-center space-y-6 bg-white">
                  <div className="p-10 border-2 border-dashed bg-slate-50 flex flex-col items-center gap-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                      <FileJson className="w-8 h-8 text-primary opacity-60" />
                    </div>
                    <Button variant="default" className="rounded-none text-[10px] font-bold uppercase h-12 px-12 gap-3 tracking-widest" onClick={() => {}} disabled={isImporting}>
                      {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import-Prozess Starten
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-none border shadow-none">
                <CardHeader className="bg-slate-900 text-white py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-[10px] font-bold uppercase tracking-widest">Import Historie & Governance</CardTitle>
                    <Badge variant="outline" className="text-[8px] font-black border-slate-700 text-slate-400">{importRuns?.length || 0} Läufe</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[350px]">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="text-[9px] font-black uppercase py-4">Zeitpunkt</TableHead>
                          <TableHead className="text-[9px] font-black uppercase">Katalog / Version</TableHead>
                          <TableHead className="text-[9px] font-black uppercase text-center">Elemente</TableHead>
                          <TableHead className="text-[9px] font-black uppercase text-right pr-6">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importRuns?.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(run => {
                          const catalog = catalogs?.find(c => c.id === run.catalogId);
                          return (
                            <TableRow key={run.id} className="hover:bg-muted/5 group">
                              <TableCell className="text-[10px] font-mono py-4 text-muted-foreground">{new Date(run.timestamp).toLocaleString()}</TableCell>
                              <TableCell className="text-[10px] font-bold uppercase">
                                {catalog?.name || 'Unbekannter Katalog'}
                                <span className="block text-[8px] opacity-50 font-normal mt-0.5">{catalog?.version}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="rounded-none text-[9px] font-black bg-white">{run.itemCount}</Badge>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <Badge variant="outline" className={cn(
                                  "rounded-none text-[8px] font-black uppercase px-2",
                                  run.status === 'success' ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                                )}>
                                  {run.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
