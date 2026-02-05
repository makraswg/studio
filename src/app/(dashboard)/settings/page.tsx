
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
  Ticket,
  Users,
  Plus,
  Trash2,
  Pencil,
  MoreHorizontal,
  Shield
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
  getJiraWorkspacesAction, 
  getJiraSchemasAction 
} from '@/app/actions/jira-actions';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { RiskCategorySetting, Catalog, ImportRun, Tenant, JiraConfig, SmtpConfig, AiConfig, PlatformUser } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function SettingsPage() {
  const { dataSource, activeTenantId } = useSettings();
  const { user: authUser } = usePlatformAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);

  // Modals for CRUD
  const [isUserDialogOpen, setIsUserAddOpen] = useState(false);
  const [isTenantDialogOpen, setIsTenantAddOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  // Discovery States for Jira
  const [jiraWorkspaces, setJiraWorkspaces] = useState<any[]>([]);
  const [jiraSchemas, setJiraSchemas] = useState<any[]>([]);
  const [isDiscoveryLoading, setIsDiscoveryLoading] = useState(false);

  // Data Fetching
  const { data: tenants, refresh: refreshTenants } = usePluggableCollection<Tenant>('tenants');
  const { data: pUsers, refresh: refreshPUsers } = usePluggableCollection<PlatformUser>('platformUsers');
  const { data: riskCategorySettings } = usePluggableCollection<RiskCategorySetting>('riskCategorySettings');
  const { data: catalogs } = usePluggableCollection<Catalog>('catalogs');
  const { data: importRuns } = usePluggableCollection<ImportRun>('importRuns');
  const { data: jiraConfigs, refresh: refreshJira } = usePluggableCollection<JiraConfig>('jiraConfigs');
  const { data: smtpConfigs, refresh: refreshSmtp } = usePluggableCollection<SmtpConfig>('smtpConfigs');
  const { data: aiConfigs, refresh: refreshAi } = usePluggableCollection<AiConfig>('aiConfigs');

  const currentJira = useMemo(() => jiraConfigs?.[0] || { id: 'jira-default', enabled: false } as JiraConfig, [jiraConfigs]);
  const currentAi = useMemo(() => aiConfigs?.[0] || { id: 'ai-default', enabled: false, provider: 'ollama' } as AiConfig, [aiConfigs]);
  const activeTenant = useMemo(() => tenants?.find(t => t.id === (activeTenantId === 'all' ? 't1' : activeTenantId)), [tenants, activeTenantId]);

  useEffect(() => {
    if (activeTab === 'integrations' && currentJira.apiToken) {
      handleDiscoverJiraStructure();
    }
  }, [activeTab]);

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
        if (collection === 'aiConfigs') refreshAi();
        if (collection === 'tenants') refreshTenants();
        if (collection === 'platformUsers') refreshPUsers();
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
    { id: 'pusers', label: 'Plattform-Nutzer', icon: Users, desc: 'Admins & Berechtigungen' },
    { id: 'sync', label: 'Identität & Sync', icon: Network, desc: 'LDAP / AD Anbindung' },
    { id: 'integrations', label: 'Jira Gateway', icon: RefreshCw, desc: 'Tickets & Assets' },
    { id: 'ai', label: 'KI Advisor', icon: BrainCircuit, desc: 'LLM Konfiguration' },
    { id: 'email', label: 'E-Mail (SMTP)', icon: Mail, desc: 'Benachrichtigungen' },
    { id: 'risks', label: 'Risiko-Steuerung', icon: Scale, desc: 'Review Zyklen' },
    { id: 'data', label: 'Katalog-Import', icon: Database, desc: 'BSI Grundschutz' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight uppercase font-headline">Systemeinstellungen</h1>
          <p className="text-muted-foreground text-sm mt-1">Zentrale Steuerung der Governance-Plattform.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-64 shrink-0">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button 
                key={item.id} 
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-none border border-transparent transition-all text-left group",
                  activeTab === item.id 
                    ? "bg-white border-border shadow-sm text-primary" 
                    : "hover:bg-muted/50 text-muted-foreground"
                )}
              >
                <item.icon className={cn("w-4 h-4 shrink-0", activeTab === item.id ? "text-primary" : "group-hover:text-foreground")} />
                <div className="flex flex-col items-start overflow-hidden">
                  <span className="text-[11px] font-bold uppercase tracking-wider">{item.label}</span>
                  <span className="text-[9px] font-medium opacity-60 truncate w-full">{item.desc}</span>
                </div>
                {activeTab === item.id && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          
          {/* ORGANISATION */}
          <TabsContent value="general" className="mt-0 space-y-6 block">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Aktiver Mandant</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Unternehmensname</Label>
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

            {authUser?.role === 'superAdmin' && (
              <Card className="rounded-none border shadow-none">
                <CardHeader className="bg-slate-900 text-white py-3 flex flex-row items-center justify-between shrink-0">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest">Alle Mandanten (Global)</CardTitle>
                  <Button size="sm" variant="outline" className="h-7 text-[9px] border-white/20 hover:bg-white/10 text-white rounded-none" onClick={() => setIsTenantAddOpen(true)}>
                    <Plus className="w-3 h-3 mr-1" /> Neu
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow><TableHead className="text-[9px] font-bold uppercase py-3">Name</TableHead><TableHead className="text-[9px] font-bold uppercase">Slug</TableHead><TableHead className="text-[9px] font-bold uppercase text-right">Aktionen</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {tenants?.map(t => (
                        <TableRow key={t.id} className="hover:bg-muted/5">
                          <TableCell className="text-xs font-bold py-3">{t.name}</TableCell>
                          <TableCell className="text-[10px] font-mono">{t.slug}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="w-3 h-3" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* PLATTFORM-NUTZER */}
          <TabsContent value="pusers" className="mt-0 space-y-6 block">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4 flex flex-row items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Plattform-Benutzerverwaltung</CardTitle>
                  <CardDescription className="text-[9px] uppercase font-medium">Berechtigte Personen für den ComplianceHub</CardDescription>
                </div>
                <Button size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => { setSelectedUser(null); setIsUserAddOpen(true); }}>
                  <Plus className="w-3.5 h-3.5 mr-2" /> Administrator hinzufügen
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold uppercase py-4">Benutzer</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Rolle</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Mandant</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Status</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-right pr-6">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pUsers?.map(pu => (
                      <TableRow key={pu.id} className="hover:bg-muted/5">
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-none bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] uppercase">
                              {pu.displayName?.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-xs">{pu.displayName}</div>
                              <div className="text-[9px] text-muted-foreground font-mono">{pu.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="rounded-none text-[8px] font-black uppercase border-primary/20 text-primary">
                            {pu.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] font-bold uppercase text-slate-500">
                          {pu.tenantId === 'all' ? 'Global (Alle)' : pu.tenantId}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <div className={cn("w-1.5 h-1.5 rounded-full", pu.enabled ? "bg-emerald-500" : "bg-red-500")} />
                            <span className="text-[9px] font-bold uppercase">{pu.enabled ? 'Aktiv' : 'Gesperrt'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-none w-48">
                              <DropdownMenuItem><Pencil className="w-3.5 h-3.5 mr-2" /> Bearbeiten</DropdownMenuItem>
                              <DropdownMenuItem><Lock className="w-3.5 h-3.5 mr-2" /> Passwort zurücksetzen</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600"><Trash2 className="w-3.5 h-3.5 mr-2" /> Deaktivieren</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* JIRA GATEWAY */}
          <TabsContent value="integrations" className="mt-0 space-y-6 block">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Jira Gateway & Assets Engine</CardTitle>
                <Switch checked={currentJira.enabled} onCheckedChange={(val) => handleSaveConfig('jiraConfigs', currentJira.id, { ...currentJira, enabled: val })} />
              </CardHeader>
              <CardContent className="p-8">
                <Tabs defaultValue="basic" className="space-y-8">
                  <TabsList className="bg-slate-100 rounded-none h-10 p-1 border">
                    <TabsTrigger value="basic" className="rounded-none text-[9px] font-bold uppercase px-6">Basis-Verbindung</TabsTrigger>
                    <TabsTrigger value="ticketing" className="rounded-none text-[9px] font-bold uppercase px-6">Ticketing (IAM)</TabsTrigger>
                    <TabsTrigger value="assets" className="rounded-none text-[9px] font-bold uppercase px-6">Assets Sync</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2 col-span-2">
                        <Label className="text-[10px] font-bold uppercase">Cloud Instanz URL</Label>
                        <Input placeholder="https://firma.atlassian.net" value={currentJira.url} onChange={(e) => handleSaveConfig('jiraConfigs', currentJira.id, { ...currentJira, url: e.target.value })} className="rounded-none h-10" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">Admin E-Mail</Label>
                        <Input value={currentJira.email} onChange={(e) => handleSaveConfig('jiraConfigs', currentJira.id, { ...currentJira, email: e.target.value })} className="rounded-none h-10" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">API Token</Label>
                        <Input type="password" value={currentJira.apiToken} onChange={(e) => handleSaveConfig('jiraConfigs', currentJira.id, { ...currentJira, apiToken: e.target.value })} className="rounded-none h-10" />
                      </div>
                    </div>
                    <Button variant="outline" className="w-full h-11 rounded-none font-bold uppercase text-[10px] gap-2" onClick={handleTestJira} disabled={isTesting === 'jira'}>
                      {isTesting === 'jira' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Verbindung validieren
                    </Button>
                  </TabsContent>

                  <TabsContent value="ticketing" className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">Projekt Key</Label>
                        <Input value={currentJira.projectKey} onChange={(e) => handleSaveConfig('jiraConfigs', currentJira.id, { ...currentJira, projectKey: e.target.value })} className="rounded-none font-black" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">Vorgangstyp</Label>
                        <Input value={currentJira.issueTypeName} onChange={(e) => handleSaveConfig('jiraConfigs', currentJira.id, { ...currentJira, issueTypeName: e.target.value })} className="rounded-none" />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI ADVISOR */}
          <TabsContent value="ai" className="mt-0 block">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">KI Access Advisor</CardTitle>
                <Switch checked={currentAi.enabled} onCheckedChange={(val) => handleSaveConfig('aiConfigs', currentAi.id, { ...currentAi, enabled: val })} />
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase">Modell-Provider</Label>
                    <Select value={currentAi.provider} onValueChange={(val: any) => handleSaveConfig('aiConfigs', currentAi.id, { ...currentAi, provider: val })}>
                      <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-none">
                        <SelectItem value="ollama">Ollama (On-Premise)</SelectItem>
                        <SelectItem value="google">Google Gemini (Cloud)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {currentAi.provider === 'google' && (
                    <div className="space-y-2">
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
          <TabsContent value="risks" className="mt-0 block">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Review Zyklen</CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 gap-4">
                  {['IT-Sicherheit', 'Datenschutz', 'Rechtlich', 'Betrieblich'].map(cat => {
                    const setting = riskCategorySettings?.find(s => s.id === cat);
                    return (
                      <div key={cat} className="flex items-center justify-between p-4 border bg-slate-50/50">
                        <span className="font-bold text-xs uppercase">{cat}</span>
                        <div className="flex items-center gap-3">
                          <Input type="number" defaultValue={setting?.defaultReviewDays || 365} className="w-24 h-9 rounded-none text-center font-bold" />
                          <span className="text-[9px] font-black text-slate-400 uppercase">Tage</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DATA IMPORT */}
          <TabsContent value="data" className="mt-0 block space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4 text-center">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">BSI Katalog Import</CardTitle>
              </CardHeader>
              <CardContent className="p-12 flex flex-col items-center gap-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <FileJson className="w-8 h-8 text-primary opacity-60" />
                </div>
                <Button className="rounded-none text-[10px] font-bold uppercase h-12 px-12 gap-3 tracking-widest">
                  Import-Prozess Starten
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-none border shadow-none overflow-hidden">
              <CardHeader className="bg-slate-900 text-white py-3">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest">Import Historie</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[250px]">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="text-[9px] font-black uppercase py-4">Zeitpunkt</TableHead>
                        <TableHead className="text-[9px] font-black uppercase">Status</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-center">Elemente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importRuns?.map(run => (
                        <TableRow key={run.id}>
                          <TableCell className="text-[10px] font-mono py-4">{new Date(run.timestamp).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("rounded-none text-[8px] uppercase", run.status === 'success' ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
                              {run.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-bold text-[10px]">{run.itemCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

        </div>
      </div>

      {/* User CRUD Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserAddOpen}>
        <DialogContent className="rounded-none max-w-md">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">Administrator hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Name</Label><Input className="rounded-none" /></div>
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">E-Mail</Label><Input className="rounded-none" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Rolle</Label>
                <Select defaultValue="admin">
                  <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="superAdmin">Super Admin</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Zugehörigkeit</Label>
                <Select defaultValue="all">
                  <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="all">Alle (Global)</SelectItem>
                    {tenants?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserAddOpen(false)} className="rounded-none uppercase text-[10px]">Abbrechen</Button>
            <Button className="rounded-none uppercase text-[10px] font-bold px-8">Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
