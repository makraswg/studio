
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

  // Discovery States for Jira
  const [jiraWorkspaces, setJiraWorkspaces] = useState<any[]>([]);
  const [jiraSchemas, setJiraSchemas] = useState<any[]>([]);
  const [isDiscoveryLoading, setIsDiscoveryLoading] = useState(false);

  // Modals for CRUD
  const [isUserDialogOpen, setIsUserAddOpen] = useState(false);
  const [isTenantDialogOpen, setIsTenantAddOpen] = useState(false);

  // Data Fetching
  const { data: tenants, refresh: refreshTenants } = usePluggableCollection<Tenant>('tenants');
  const { data: pUsers, refresh: refreshPUsers } = usePluggableCollection<PlatformUser>('platformUsers');
  const { data: riskCategorySettings } = usePluggableCollection<RiskCategorySetting>('riskCategorySettings');
  const { data: importRuns } = usePluggableCollection<ImportRun>('importRuns');
  const { data: jiraConfigs, refresh: refreshJira } = usePluggableCollection<JiraConfig>('jiraConfigs');
  const { data: aiConfigs, refresh: refreshAi } = usePluggableCollection<AiConfig>('aiConfigs');

  // Local Form States (Drafts)
  const [jiraDraft, setJiraDraft] = useState<Partial<JiraConfig>>({});
  const [aiDraft, setAiDraft] = useState<Partial<AiConfig>>({});
  const [tenantDraft, setTenantDraft] = useState<Partial<Tenant>>({});

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
    const current = tenants?.find(t => t.id === (activeTenantId === 'all' ? 't1' : activeTenantId));
    if (current) setTenantDraft(current);
  }, [tenants, activeTenantId]);

  const handleDiscoverJiraStructure = async () => {
    if (!jiraDraft.url || !jiraDraft.apiToken) return;
    setIsDiscoveryLoading(true);
    try {
      const res = await getJiraWorkspacesAction({ 
        url: jiraDraft.url, 
        email: jiraDraft.email || '', 
        apiToken: jiraDraft.apiToken 
      });
      if (res.success && res.workspaces) {
        setJiraWorkspaces(res.workspaces);
        if (jiraDraft.workspaceId) {
          const sRes = await getJiraSchemasAction({ 
            url: jiraDraft.url,
            email: jiraDraft.email || '',
            apiToken: jiraDraft.apiToken,
            workspaceId: jiraDraft.workspaceId 
          });
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
    const res = await testJiraConnectionAction(jiraDraft);
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col lg:flex-row gap-8">
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
          
          <TabsContent value="general" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Aktiver Mandant</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Unternehmensname</Label>
                    <Input 
                      value={tenantDraft.name || ''} 
                      onChange={(e) => setTenantDraft({ ...tenantDraft, name: e.target.value })}
                      className="rounded-none h-11" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Eindeutiger Kennner (Slug)</Label>
                    <Input value={tenantDraft.slug || ''} disabled className="rounded-none h-11 bg-muted/20 font-mono" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => handleSaveConfig('tenants', tenantDraft.id!, tenantDraft)} disabled={isSaving} className="rounded-none font-bold uppercase text-[10px] gap-2">
                    {isSaving && <Loader2 className="w-3 h-3 animate-spin" />} <Save className="w-3.5 h-3.5" /> Mandant speichern
                  </Button>
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

          <TabsContent value="pusers" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4 flex flex-row items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Plattform-Benutzerverwaltung</CardTitle>
                  <CardDescription className="text-[9px] uppercase font-medium">Berechtigte Personen für den ComplianceHub</CardDescription>
                </div>
                <Button size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => setIsUserAddOpen(true)}>
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

          <TabsContent value="sync" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">LDAP / Active Directory Anbindung</CardTitle>
                <Switch 
                  checked={!!tenantDraft.ldapEnabled} 
                  onCheckedChange={(val) => setTenantDraft({ ...tenantDraft, ldapEnabled: val })} 
                />
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <Label className="text-[10px] font-bold uppercase">LDAP URL</Label>
                    <Input 
                      placeholder="ldap://dc01.firma.local" 
                      value={tenantDraft.ldapUrl || ''} 
                      onChange={(e) => setTenantDraft({ ...tenantDraft, ldapUrl: e.target.value })} 
                      className="rounded-none h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase">Port</Label>
                    <Input 
                      placeholder="389" 
                      value={tenantDraft.ldapPort || ''} 
                      onChange={(e) => setTenantDraft({ ...tenantDraft, ldapPort: e.target.value })} 
                      className="rounded-none h-10"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label className="text-[10px] font-bold uppercase">Base DN</Label>
                    <Input 
                      placeholder="DC=firma,DC=local" 
                      value={tenantDraft.ldapBaseDn || ''} 
                      onChange={(e) => setTenantDraft({ ...tenantDraft, ldapBaseDn: e.target.value })} 
                      className="rounded-none h-10 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase">Bind DN</Label>
                    <Input 
                      placeholder="CN=svc_compliance,OU=ServiceAccounts,..." 
                      value={tenantDraft.ldapBindDn || ''} 
                      onChange={(e) => setTenantDraft({ ...tenantDraft, ldapBindDn: e.target.value })} 
                      className="rounded-none h-10 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase">Bind Passwort</Label>
                    <Input 
                      type="password" 
                      value={tenantDraft.ldapBindPassword || ''} 
                      onChange={(e) => setTenantDraft({ ...tenantDraft, ldapBindPassword: e.target.value })} 
                      className="rounded-none h-10"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => handleSaveConfig('tenants', tenantDraft.id!, tenantDraft)} disabled={isSaving} className="rounded-none font-bold uppercase text-[10px] gap-2">
                    {isSaving && <Loader2 className="w-3 h-3 animate-spin" />} <Save className="w-3.5 h-3.5" /> Sync-Daten speichern
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Jira Gateway & Assets Engine</CardTitle>
                <Switch checked={!!jiraDraft.enabled} onCheckedChange={(val) => setJiraDraft({ ...jiraDraft, enabled: val })} />
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
                        <Input placeholder="https://firma.atlassian.net" value={jiraDraft.url || ''} onChange={(e) => setJiraDraft({...jiraDraft, url: e.target.value})} className="rounded-none h-10" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">Admin E-Mail</Label>
                        <Input value={jiraDraft.email || ''} onChange={(e) => setJiraDraft({...jiraDraft, email: e.target.value})} className="rounded-none h-10" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">API Token</Label>
                        <Input type="password" value={jiraDraft.apiToken || ''} onChange={(e) => setJiraDraft({...jiraDraft, apiToken: e.target.value})} className="rounded-none h-10" />
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
                        <Input value={jiraDraft.projectKey || ''} onChange={(e) => setJiraDraft({...jiraDraft, projectKey: e.target.value})} className="rounded-none font-black" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">Vorgangstyp</Label>
                        <Input value={jiraDraft.issueTypeName || ''} onChange={(e) => setJiraDraft({...jiraDraft, issueTypeName: e.target.value})} className="rounded-none" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-emerald-600">Genehmigt-Status (Trigger)</Label>
                        <Input placeholder="Approved" value={jiraDraft.approvedStatusName || ''} onChange={(e) => setJiraDraft({...jiraDraft, approvedStatusName: e.target.value})} className="rounded-none" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-blue-600">Abschluss-Status (Sync)</Label>
                        <Input placeholder="Done" value={jiraDraft.doneStatusName || ''} onChange={(e) => setJiraDraft({...jiraDraft, doneStatusName: e.target.value})} className="rounded-none" />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="assets" className="space-y-6">
                    <div className="p-4 bg-blue-50/50 border border-blue-100 flex items-start gap-3">
                      <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                      <p className="text-[10px] text-blue-800 leading-relaxed font-bold uppercase">
                        Konfigurieren Sie hier den Abgleich Ihrer IT-Assets (Systeme und Rollen) direkt aus der Jira Assets Datenbank (Insight).
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">Workspace ID</Label>
                        <Select value={jiraDraft.workspaceId || ''} onValueChange={(val) => setJiraDraft({...jiraDraft, workspaceId: val})}>
                          <SelectTrigger className="rounded-none h-10">
                            <SelectValue placeholder={isDiscoveryLoading ? "Lade..." : "Workspace wählen..."} />
                          </SelectTrigger>
                          <SelectContent className="rounded-none">
                            {jiraWorkspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">Schema ID</Label>
                        <Select value={jiraDraft.schemaId || ''} onValueChange={(val) => setJiraDraft({...jiraDraft, schemaId: val})}>
                          <SelectTrigger className="rounded-none h-10">
                            <SelectValue placeholder="Schema wählen..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-none">
                            {jiraSchemas.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 text-[9px] font-bold uppercase" onClick={handleDiscoverJiraStructure}>
                      <RefreshCw className="w-3 h-3 mr-2" /> Assets-Struktur laden
                    </Button>
                  </TabsContent>
                </Tabs>
                <Separator className="my-8" />
                <div className="flex justify-end">
                  <Button onClick={() => handleSaveConfig('jiraConfigs', jiraDraft.id!, jiraDraft)} disabled={isSaving} className="rounded-none font-bold uppercase text-[10px] gap-2 px-12 h-11">
                    {isSaving && <Loader2 className="w-3 h-3 animate-spin" />} <Save className="w-4 h-4" /> Jira Konfiguration speichern
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">KI Access Advisor</CardTitle>
                <Switch checked={!!aiDraft.enabled} onCheckedChange={(val) => setAiDraft({ ...aiDraft, enabled: val })} />
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase">Modell-Provider</Label>
                    <Select value={aiDraft.provider} onValueChange={(val: any) => setAiDraft({ ...aiDraft, provider: val })}>
                      <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-none">
                        <SelectItem value="ollama">Ollama (On-Premise)</SelectItem>
                        <SelectItem value="google">Google Gemini (Cloud)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase">Endpoint / Modell</Label>
                    {aiDraft.provider === 'ollama' ? (
                      <Input placeholder="http://localhost:11434" value={aiDraft.ollamaUrl || ''} onChange={(e) => setAiDraft({ ...aiDraft, ollamaUrl: e.target.value })} className="rounded-none h-10" />
                    ) : (
                      <Select value={aiDraft.geminiModel || ''} onValueChange={(val) => setAiDraft({ ...aiDraft, geminiModel: val })}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash (Schnell)</SelectItem>
                          <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro (Präzise)</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => handleSaveConfig('aiConfigs', aiDraft.id!, aiDraft)} disabled={isSaving} className="rounded-none font-bold uppercase text-[10px] gap-2 px-12 h-11">
                    {isSaving && <Loader2 className="w-3 h-3 animate-spin" />} <Save className="w-4 h-4" /> KI Konfiguration speichern
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">E-Mail (SMTP) Benachrichtigungen</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <Label className="text-[10px] font-bold uppercase">SMTP Host</Label>
                    <Input placeholder="smtp.office365.com" className="rounded-none h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase">Port</Label>
                    <Input placeholder="587" className="rounded-none h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase">Benutzer</Label>
                    <Input className="rounded-none h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase">Passwort</Label>
                    <Input type="password" title="Passwort" className="rounded-none h-10" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button disabled className="rounded-none font-bold uppercase text-[10px] gap-2">
                    <Save className="w-3.5 h-3.5" /> SMTP speichern
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="risks" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Globale Risiko Review Zyklen</CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 gap-4">
                  {['IT-Sicherheit', 'Datenschutz', 'Rechtlich', 'Betrieblich'].map(cat => {
                    const setting = riskCategorySettings?.find(s => s.id === cat);
                    return (
                      <div key={cat} className="flex items-center justify-between p-4 border bg-slate-50/50">
                        <span className="font-bold text-xs uppercase">{cat}</span>
                        <div className="flex items-center gap-3">
                          <Input 
                            type="number" 
                            defaultValue={setting?.defaultReviewDays || 365} 
                            onBlur={(e) => handleSaveConfig('riskCategorySettings', cat, { id: cat, tenantId: activeTenantId, defaultReviewDays: parseInt(e.target.value) })}
                            className="w-24 h-9 rounded-none text-center font-bold" 
                          />
                          <span className="text-[9px] font-black text-slate-400 uppercase">Tage</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4 text-center">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">BSI Katalog Import Engine</CardTitle>
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
                      {importRuns?.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(run => (
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
      </Tabs>

      {/* User CRUD Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserAddOpen}>
        <DialogContent className="rounded-none max-w-md">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">Plattform-Nutzer hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Anzeigename</Label><Input className="rounded-none" /></div>
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">E-Mail Adresse</Label><Input className="rounded-none" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Rolle</Label>
                <Select defaultValue="admin">
                  <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="superAdmin">Super Admin</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="editor">Bearbeiter</SelectItem>
                    <SelectItem value="viewer">Betrachter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Zuständigkeit</Label>
                <Select defaultValue="all">
                  <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="all">Alle Standorte</SelectItem>
                    {tenants?.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserAddOpen(false)} className="rounded-none uppercase text-[10px]">Abbrechen</Button>
            <Button className="rounded-none uppercase text-[10px] font-bold px-8">Nutzer speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
