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
  getJiraSchemasAction,
  getJiraObjectTypesAction,
  getJiraAttributesAction
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
  const [jiraObjectTypes, setJiraObjectTypes] = useState<any[]>([]);
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

  const handleDiscoverWorkspaces = async () => {
    if (!jiraDraft.url || !jiraDraft.apiToken) return;
    setIsDiscoveryLoading(true);
    try {
      const res = await getJiraWorkspacesAction({ 
        url: jiraDraft.url, 
        email: jiraDraft.email || '', 
        apiToken: jiraDraft.apiToken 
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

  const handleDiscoverAttributes = async (type: 'resource' | 'entitlement', objectTypeId: string) => {
    if (!jiraDraft.url || !jiraDraft.workspaceId) return;
    try {
      const res = await getJiraAttributesAction({
        url: jiraDraft.url,
        email: jiraDraft.email || '',
        apiToken: jiraDraft.apiToken!,
        workspaceId: jiraDraft.workspaceId,
        objectTypeId,
        targetObjectTypeId: type === 'entitlement' ? jiraDraft.resourceObjectTypeId : undefined
      });
      if (res.success) {
        if (type === 'resource') {
          setJiraDraft(prev => ({ ...prev, resourceLabelAttrId: res.labelAttributeId }));
        } else {
          setJiraDraft(prev => ({ ...prev, entitlementLabelAttrId: res.labelAttributeId, resourceToEntitlementAttrId: res.referenceAttributeId }));
        }
      }
    } catch (e) {}
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

                  <TabsContent value="assets" className="space-y-8">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-bold uppercase">1. Workspace</Label>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleDiscoverWorkspaces}><RefreshCw className="w-3 h-3" /></Button>
                        </div>
                        <Select value={jiraDraft.workspaceId || ''} onValueChange={(val) => { setJiraDraft({...jiraDraft, workspaceId: val, schemaId: undefined}); handleDiscoverSchemas(val); }}>
                          <SelectTrigger className="rounded-none h-10"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                          <SelectContent className="rounded-none">
                            {jiraWorkspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-bold uppercase">2. Schema</Label>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => jiraDraft.workspaceId && handleDiscoverSchemas(jiraDraft.workspaceId)}><RefreshCw className="w-3 h-3" /></Button>
                        </div>
                        <Select value={jiraDraft.schemaId || ''} onValueChange={(val) => { setJiraDraft({...jiraDraft, schemaId: val}); handleDiscoverObjectTypes(val); }}>
                          <SelectTrigger className="rounded-none h-10"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                          <SelectContent className="rounded-none">
                            {jiraSchemas.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-12">
                      {/* IT System Mapping */}
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase text-primary border-b pb-1">IT-Systeme Mapping</h4>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-[9px] font-bold uppercase">Objekttyp (z.B. IT Assets)</Label>
                            <Select value={jiraDraft.resourceObjectTypeId || ''} onValueChange={(val) => { setJiraDraft({...jiraDraft, resourceObjectTypeId: val}); handleDiscoverAttributes('resource', val); }}>
                              <SelectTrigger className="rounded-none h-9"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                              <SelectContent className="rounded-none">
                                {jiraObjectTypes.map(ot => <SelectItem key={ot.id} value={ot.id}>{ot.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[9px] font-bold uppercase">Namens-Attribut (Label)</Label>
                            <Input value={jiraDraft.resourceLabelAttrId || ''} onChange={e => setJiraDraft({...jiraDraft, resourceLabelAttrId: e.target.value})} className="rounded-none h-9 font-mono text-[10px]" />
                          </div>
                        </div>
                      </div>

                      {/* Entitlement Mapping */}
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase text-primary border-b pb-1">Rollen Mapping</h4>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-[9px] font-bold uppercase">Objekttyp (z.B. Rollen)</Label>
                            <Select value={jiraDraft.entitlementObjectTypeId || ''} onValueChange={(val) => { setJiraDraft({...jiraDraft, entitlementObjectTypeId: val}); handleDiscoverAttributes('entitlement', val); }}>
                              <SelectTrigger className="rounded-none h-9"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                              <SelectContent className="rounded-none">
                                {jiraObjectTypes.map(ot => <SelectItem key={ot.id} value={ot.id}>{ot.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[9px] font-bold uppercase">Verknüpfung zu System (Ref-ID)</Label>
                            <Input value={jiraDraft.resourceToEntitlementAttrId || ''} onChange={e => setJiraDraft({...jiraDraft, resourceToEntitlementAttrId: e.target.value})} className="rounded-none h-9 font-mono text-[10px]" />
                          </div>
                        </div>
                      </div>
                    </div>
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

          <TabsContent value="pusers" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4 flex flex-row items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Plattform-Benutzerverwaltung</CardTitle>
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
                      <TableHead className="text-[10px] font-bold uppercase text-right pr-6">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pUsers?.map(pu => (
                      <TableRow key={pu.id}>
                        <TableCell className="py-4">
                          <div className="font-bold text-xs">{pu.displayName}</div>
                          <div className="text-[9px] text-muted-foreground">{pu.email}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-[8px] uppercase">{pu.role}</Badge></TableCell>
                        <TableCell className="text-right pr-6">
                          <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
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
                <Switch checked={!!tenantDraft.ldapEnabled} onCheckedChange={(val) => setTenantDraft({ ...tenantDraft, ldapEnabled: val })} />
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 col-span-2 md:col-span-1"><Label className="text-[10px] font-bold uppercase">LDAP URL</Label><Input placeholder="ldap://dc01.firma.local" value={tenantDraft.ldapUrl || ''} onChange={(e) => setTenantDraft({ ...tenantDraft, ldapUrl: e.target.value })} className="rounded-none h-10" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Port</Label><Input placeholder="389" value={tenantDraft.ldapPort || ''} onChange={(e) => setTenantDraft({ ...tenantDraft, ldapPort: e.target.value })} className="rounded-none h-10" /></div>
                  <div className="space-y-2 col-span-2"><Label className="text-[10px] font-bold uppercase">Base DN</Label><Input placeholder="DC=firma,DC=local" value={tenantDraft.ldapBaseDn || ''} onChange={(e) => setTenantDraft({ ...tenantDraft, ldapBaseDn: e.target.value })} className="rounded-none h-10 font-mono text-xs" /></div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => handleSaveConfig('tenants', tenantDraft.id!, tenantDraft)} disabled={isSaving} className="rounded-none font-bold uppercase text-[10px] gap-2">
                    {isSaving && <Loader2 className="w-3 h-3 animate-spin" />} <Save className="w-3.5 h-3.5" /> Sync speichern
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
                    <Label className="text-[10px] font-bold uppercase">Modell / URL</Label>
                    {aiDraft.provider === 'ollama' ? (
                      <Input placeholder="http://localhost:11434" value={aiDraft.ollamaUrl || ''} onChange={(e) => setAiDraft({ ...aiDraft, ollamaUrl: e.target.value })} className="rounded-none h-10" />
                    ) : (
                      <Select value={aiDraft.geminiModel || ''} onValueChange={(val) => setAiDraft({ ...aiDraft, geminiModel: val })}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                          <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => handleSaveConfig('aiConfigs', aiDraft.id!, aiDraft)} disabled={isSaving} className="rounded-none font-bold uppercase text-[10px] h-11 px-12">Speichern</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4"><CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">E-Mail (SMTP)</CardTitle></CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">SMTP Host</Label><Input className="rounded-none" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Port</Label><Input className="rounded-none" /></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="risks" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4"><CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">Risiko Review Zyklen</CardTitle></CardHeader>
              <CardContent className="p-8">
                <div className="space-y-4">
                  {['IT-Sicherheit', 'Datenschutz', 'Rechtlich', 'Betrieblich'].map(cat => (
                    <div key={cat} className="flex justify-between items-center p-4 border bg-muted/5">
                      <span className="font-bold text-xs">{cat}</span>
                      <Input type="number" defaultValue="365" className="w-24 h-9 rounded-none text-center" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="mt-0 space-y-6">
            <Card className="rounded-none border shadow-none">
              <CardHeader className="bg-muted/10 border-b py-4"><CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">BSI Katalog Import</CardTitle></CardHeader>
              <CardContent className="p-12 flex flex-col items-center gap-6">
                <FileJson className="w-12 h-12 text-muted-foreground opacity-40" />
                <Button className="rounded-none font-bold uppercase text-[10px] h-12 px-12">Import Starten</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
