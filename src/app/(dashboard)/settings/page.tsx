
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Save, 
  Lock,
  Database,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Box,
  Plus,
  Building2,
  Trash2,
  Pencil,
  Search,
  RefreshCw,
  ChevronRight,
  Network,
  Contact,
  ShieldCheck,
  Globe,
  Terminal,
  Unplug
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useSettings } from '@/context/settings-context';
import { 
  getJiraConfigs, 
  testJiraConnectionAction, 
  getJiraWorkspacesAction,
} from '@/app/actions/jira-actions';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { cn } from '@/lib/utils';
import { 
  useFirestore, 
  setDocumentNonBlocking, 
} from '@/firebase';
import { doc } from 'firebase/firestore';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function SettingsPage() {
  const db = useFirestore();
  const { dataSource } = useSettings();
  
  const [activeTab, setActiveTab] = useState('general');

  // Tenant Management State
  const { data: tenants, isLoading: isTenantsLoading, refresh: refreshTenants } = usePluggableCollection<any>('tenants');
  const [isTenantDialogOpen, setIsTenantDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  
  // Service Partner State
  const { data: servicePartners, isLoading: isPartnersLoading, refresh: refreshPartners } = usePluggableCollection<any>('servicePartners');
  const [isPartnerDialogOpen, setIsPartnerDialogOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);

  // Tenant Form Fields
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [ldapEnabled, setLdapEnabled] = useState(false);
  const [ldapUrl, setLdapUrl] = useState('');
  const [ldapPort, setLdapPort] = useState('389');
  const [ldapBaseDn, setLdapBaseDn] = useState('');
  const [ldapBindDn, setLdapBindDn] = useState('');
  const [ldapBindPassword, setLdapBindPassword] = useState('');
  const [ldapUserFilter, setLdapUserFilter] = useState('(sAMAccountName=*)');

  // Partner Form Fields
  const [partnerName, setPartnerName] = useState('');
  const [partnerContact, setPartnerContact] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');
  const [partnerTenantId, setPartnerTenantId] = useState('global');

  // Jira State
  const [jiraConfigId, setJiraConfigId] = useState('');
  const [jiraUrl, setJiraUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [jiraProject, setJiraProject] = useState('');
  const [jiraIssueType, setJiraIssueType] = useState('Service Request');
  const [jiraApprovedStatus, setJiraApprovedStatus] = useState('Approved');
  const [jiraDoneStatus, setJiraDoneStatus] = useState('Done');
  const [jiraEnabled, setJiraEnabled] = useState(false);
  
  // Jira Assets State
  const [assetsWorkspaceId, setAssetsWorkspaceId] = useState('');
  const [assetsSchemaId, setAssetsSchemaId] = useState('');
  const [assetsResourceObjectTypeId, setAssetsResourceObjectTypeId] = useState('');
  const [assetsRoleObjectTypeId, setAssetsRoleObjectTypeId] = useState('');
  const [assetsResourceNameAttributeId, setAssetsResourceNameAttributeId] = useState('1');
  const [assetsRoleNameAttributeId, setAssetsRoleNameAttributeId] = useState('1');
  const [assetsSystemAttributeId, setAssetsSystemAttributeId] = useState('');

  // UI States
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingJira, setIsTestingJira] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const loadJira = async () => {
      const configs = await getJiraConfigs();
      if (configs.length > 0) {
        const c = configs[0];
        setJiraConfigId(c.id);
        setJiraUrl(c.url || '');
        setJiraEmail(c.email || '');
        setJiraToken(c.apiToken || '');
        setJiraProject(c.projectKey || '');
        setJiraIssueType(c.issueTypeName || 'Service Request');
        setJiraApprovedStatus(c.approvedStatusName || 'Approved');
        setJiraDoneStatus(c.doneStatusName || 'Done');
        setJiraEnabled(c.enabled || false);
        setAssetsWorkspaceId(c.assetsWorkspaceId || '');
        setAssetsSchemaId(c.assetsSchemaId || '');
        setAssetsResourceObjectTypeId(c.assetsResourceObjectTypeId || '');
        setAssetsRoleObjectTypeId(c.assetsRoleObjectTypeId || '');
        setAssetsResourceNameAttributeId(c.assetsResourceNameAttributeId || '1');
        setAssetsRoleNameAttributeId(c.assetsRoleNameAttributeId || '1');
        setAssetsSystemAttributeId(c.assetsSystemAttributeId || '');
      }
    };
    loadJira();
  }, []);

  const handleSaveJira = async () => {
    setIsSaving(true);
    const id = jiraConfigId || `jira-${Math.random().toString(36).substring(2, 7)}`;
    const data = {
      id,
      tenantId: 'global',
      name: 'Standard Jira Integration',
      url: jiraUrl,
      email: jiraEmail,
      apiToken: jiraToken,
      projectKey: jiraProject,
      issueTypeName: jiraIssueType,
      approvedStatusName: jiraApprovedStatus,
      doneStatusName: jiraDoneStatus,
      enabled: jiraEnabled,
      assetsWorkspaceId,
      assetsSchemaId,
      assetsResourceObjectTypeId,
      assetsRoleObjectTypeId,
      assetsResourceNameAttributeId,
      assetsRoleNameAttributeId,
      assetsSystemAttributeId,
    };

    try {
      if (dataSource === 'mysql') await saveCollectionRecord('jiraConfigs', id, data);
      else setDocumentNonBlocking(doc(db, 'jiraConfigs', id), data);
      toast({ title: "Jira Konfiguration gespeichert" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestJira = async () => {
    setIsTestingJira(true);
    setTestResult(null);
    const res = await testJiraConnectionAction({
      url: jiraUrl,
      email: jiraEmail,
      apiToken: jiraToken,
      projectKey: jiraProject,
      approvedStatusName: jiraApprovedStatus
    });
    setTestResult(res);
    setIsTestingJira(false);
    if (res.success) toast({ title: "Jira Verbindung OK" });
    else toast({ variant: "destructive", title: "Verbindungsfehler", description: res.message });
  };

  const handleSaveTenant = async () => {
    if (!tenantName || !tenantSlug) return;
    const id = selectedTenant?.id || `t-${Math.random().toString(36).substring(2, 7)}`;
    const data = {
      id, name: tenantName, slug: tenantSlug.toLowerCase(), createdAt: selectedTenant?.createdAt || new Date().toISOString(),
      ldapEnabled, ldapUrl, ldapPort, ldapBaseDn, ldapBindDn, ldapBindPassword, ldapUserFilter
    };
    if (dataSource === 'mysql') await saveCollectionRecord('tenants', id, data);
    else setDocumentNonBlocking(doc(db, 'tenants', id), data);
    toast({ title: "Mandant gespeichert" });
    setIsTenantDialogOpen(false);
    setTimeout(() => refreshTenants(), 200);
  };

  const handleSavePartner = async () => {
    if (!partnerName) return;
    const id = selectedPartner?.id || `sp-${Math.random().toString(36).substring(2, 7)}`;
    const data = {
      id, tenantId: partnerTenantId, name: partnerName, contactPerson: partnerContact, email: partnerEmail, phone: partnerPhone
    };
    if (dataSource === 'mysql') await saveCollectionRecord('servicePartners', id, data);
    else setDocumentNonBlocking(doc(db, 'servicePartners', id), data);
    toast({ title: "Partner gespeichert" });
    setIsPartnerDialogOpen(false);
    setTimeout(() => refreshPartners(), 200);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-20">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Systemeinstellungen</h1>
          <p className="text-muted-foreground mt-1">Plattform-Governance, Jira-Automatisierung und Partner-Management.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-card border h-12 p-1 gap-1 rounded-none w-full justify-start overflow-x-auto">
          <TabsTrigger value="general" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Settings className="w-3.5 h-3.5" /> Organisation</TabsTrigger>
          <TabsTrigger value="tenants" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Building2 className="w-3.5 h-3.5" /> Mandanten</TabsTrigger>
          <TabsTrigger value="partners" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Contact className="w-3.5 h-3.5" /> Service Partner</TabsTrigger>
          <TabsTrigger value="jira" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><ExternalLink className="w-3.5 h-3.5" /> JIRA Integration</TabsTrigger>
          <TabsTrigger value="data" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Database className="w-3.5 h-3.5" /> Datenquelle</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="rounded-none border shadow-none">
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest">Plattform Identität</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Anwendungs-Name</Label>
                  <Input defaultValue="ComplianceHub" className="rounded-none" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Sicherheits-Beauftragter (Global)</Label>
                  <Input placeholder="z.B. CISO Office" className="rounded-none" />
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/5 border-t py-3 flex justify-end">
              <Button size="sm" className="h-8 rounded-none font-bold uppercase text-[10px]"><Save className="w-3 h-3 mr-2" /> Speichern</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="tenants">
          <Card className="rounded-none border shadow-none">
            <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between">
              <div><CardTitle className="text-[10px] font-bold uppercase">Firmen / Standorte</CardTitle></div>
              <Button size="sm" className="h-8 text-[10px] font-bold uppercase rounded-none" onClick={() => { setSelectedTenant(null); setIsTenantDialogOpen(true); }}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Mandant hinzufügen
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow><TableHead className="font-bold uppercase text-[10px] py-4">Firma</TableHead><TableHead className="font-bold uppercase text-[10px]">Slug</TableHead><TableHead className="text-right font-bold uppercase text-[10px]">Aktion</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {tenants?.map((t: any) => (
                    <TableRow key={t.id} className="border-b">
                      <TableCell className="font-bold text-sm py-4">{t.name}</TableCell>
                      <TableCell className="font-mono text-[10px]">{t.slug}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedTenant(t); setTenantName(t.name); setTenantSlug(t.slug); setIsTenantDialogOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="partners">
          <Card className="rounded-none border shadow-none">
            <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between">
              <div><CardTitle className="text-[10px] font-bold uppercase">Service Partner</CardTitle></div>
              <Button size="sm" className="h-8 text-[10px] font-bold uppercase rounded-none" onClick={() => { setSelectedPartner(null); setIsPartnerDialogOpen(true); }}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Partner hinzufügen
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow><TableHead className="font-bold uppercase text-[10px] py-4">Firma</TableHead><TableHead className="font-bold uppercase text-[10px]">Kontakt</TableHead><TableHead className="text-right font-bold uppercase text-[10px]">Aktion</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {servicePartners?.map((p: any) => (
                    <TableRow key={p.id} className="border-b">
                      <TableCell className="font-bold text-sm py-4">{p.name}</TableCell>
                      <TableCell className="text-xs">{p.contactPerson} ({p.email})</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedPartner(p); setPartnerName(p.name); setPartnerContact(p.contactPerson); setPartnerEmail(p.email); setPartnerPhone(p.phone || ''); setIsPartnerDialogOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jira">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Jira Connection */}
              <Card className="rounded-none border shadow-none">
                <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-[10px] font-bold uppercase">1. Jira Cloud Verbindung</CardTitle>
                    <CardDescription className="text-[9px] uppercase font-bold">API-Zugriff für Ticket-Erstellung und Assets-Synchronisation.</CardDescription>
                  </div>
                  <Switch checked={jiraEnabled} onCheckedChange={setJiraEnabled} />
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label className="text-[10px] font-bold uppercase">Cloud Instanz URL</Label>
                      <Input value={jiraUrl} onChange={e => setJiraUrl(e.target.value)} placeholder="https://your-company.atlassian.net" className="rounded-none" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">API E-Mail</Label>
                      <Input value={jiraEmail} onChange={e => setJiraEmail(e.target.value)} className="rounded-none" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">API Token</Label>
                      <Input type="password" value={jiraToken} onChange={e => setJiraToken(e.target.value)} className="rounded-none" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Workflow Mapping */}
              <Card className="rounded-none border shadow-none">
                <CardHeader className="bg-muted/10 border-b">
                  <CardTitle className="text-[10px] font-bold uppercase">2. Workflow & Status Mapping</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Projekt Key</Label>
                      <Input value={jiraProject} onChange={e => setJiraProject(e.target.value)} placeholder="IAM" className="rounded-none" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Issue Type Name</Label>
                      <Input value={jiraIssueType} onChange={e => setJiraIssueType(e.target.value)} placeholder="Access Request" className="rounded-none" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Status: Genehmigt (Trigger Sync)</Label>
                      <Input value={jiraApprovedStatus} onChange={e => setJiraApprovedStatus(e.target.value)} placeholder="Approved" className="rounded-none" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Status: Abgeschlossen (Historie)</Label>
                      <Input value={jiraDoneStatus} onChange={e => setJiraDoneStatus(e.target.value)} placeholder="Done" className="rounded-none" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Assets Configuration */}
              <Card className="rounded-none border shadow-none">
                <CardHeader className="bg-muted/10 border-b">
                  <CardTitle className="text-[10px] font-bold uppercase">3. Jira Assets (JSM) Mapping</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Assets Workspace ID</Label>
                      <Input value={assetsWorkspaceId} onChange={e => setAssetsWorkspaceId(e.target.value)} className="rounded-none" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Object Schema ID</Label>
                      <Input value={assetsSchemaId} onChange={e => setAssetsSchemaId(e.target.value)} className="rounded-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Object Type: Ressourcen</Label>
                      <Input value={assetsResourceObjectTypeId} onChange={e => setAssetsResourceObjectTypeId(e.target.value)} className="rounded-none" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Object Type: Rollen</Label>
                      <Input value={assetsRoleObjectTypeId} onChange={e => setAssetsRoleObjectTypeId(e.target.value)} className="rounded-none" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="rounded-none border shadow-none bg-slate-900 text-white">
                <CardHeader className="pb-3"><CardTitle className="text-[10px] font-bold uppercase text-primary">Diagnose & Tools</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <Button variant="outline" className="w-full h-10 rounded-none bg-white/5 border-white/10 text-white hover:bg-white/10 text-[10px] font-bold uppercase" onClick={handleTestJira} disabled={isTestingJira}>
                    {isTestingJira ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Unplug className="w-3.5 h-3.5 mr-2" />} Verbindung testen
                  </Button>
                  {testResult && (
                    <div className={cn("p-3 text-[9px] font-bold uppercase border", testResult.success ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" : "border-red-500/50 bg-red-500/10 text-red-400")}>
                      {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5 inline mr-2" /> : <AlertTriangle className="w-3.5 h-3.5 inline mr-2" />}
                      {testResult.message}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="pt-0">
                  <Button className="w-full h-11 rounded-none text-[10px] font-bold uppercase gap-2" onClick={handleSaveJira} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Konfiguration Speichern
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Partner Dialog */}
      <Dialog open={isPartnerDialogOpen} onOpenChange={setIsPartnerDialogOpen}>
        <DialogContent className="rounded-none max-w-md">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">Service Partner pflegen</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">Firma / Stelle</Label>
              <Input value={partnerName} onChange={e => setPartnerName(e.target.value)} className="rounded-none" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">Ansprechpartner</Label>
              <Input value={partnerContact} onChange={e => setPartnerContact(e.target.value)} className="rounded-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">E-Mail</Label>
                <Input value={partnerEmail} onChange={e => setPartnerEmail(e.target.value)} className="rounded-none" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Telefon</Label>
                <Input value={partnerPhone} onChange={e => setPartnerPhone(e.target.value)} className="rounded-none" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPartnerDialogOpen(false)} className="rounded-none">Abbrechen</Button>
            <Button onClick={handleSavePartner} className="rounded-none font-bold uppercase text-[10px]">Partner speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tenant Dialog */}
      <Dialog open={isTenantDialogOpen} onOpenChange={setIsTenantDialogOpen}>
        <DialogContent className="rounded-none max-w-lg">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">Mandant konfigurieren</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Name</Label><Input value={tenantName} onChange={e => setTenantName(e.target.value)} className="rounded-none" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Slug</Label><Input value={tenantSlug} onChange={e => setTenantSlug(e.target.value)} className="rounded-none" /></div>
            </div>
            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-bold uppercase">LDAP Anbindung (Active Directory)</Label>
                <Switch checked={ldapEnabled} onCheckedChange={setLdapEnabled} />
              </div>
              {ldapEnabled && (
                <div className="space-y-4 animate-in slide-in-from-top-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 space-y-1"><Label className="text-[9px] font-bold uppercase">Server URL</Label><Input value={ldapUrl} onChange={e => setLdapUrl(e.target.value)} placeholder="ldaps://ad.company.com" className="h-8 rounded-none text-xs" /></div>
                    <div className="space-y-1"><Label className="text-[9px] font-bold uppercase">Port</Label><Input value={ldapPort} onChange={e => setLdapPort(e.target.value)} className="h-8 rounded-none text-xs" /></div>
                  </div>
                  <div className="space-y-1"><Label className="text-[9px] font-bold uppercase">Base DN (Nutzer-Ast)</Label><Input value={ldapBaseDn} onChange={e => setLdapBaseDn(e.target.value)} placeholder="OU=Users,OU=Acme,DC=company,DC=com" className="h-8 rounded-none text-xs" /></div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter><Button onClick={handleSaveTenant} className="rounded-none uppercase font-bold text-[10px]">Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
