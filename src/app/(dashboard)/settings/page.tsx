
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
  Contact
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useSettings } from '@/context/settings-context';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  getJiraConfigs, 
  testJiraConnectionAction, 
  getJiraWorkspacesAction,
  getJiraAttributesAction
} from '@/app/actions/jira-actions';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { cn } from '@/lib/utils';
import { 
  useFirestore, 
  setDocumentNonBlocking, 
  addDocumentNonBlocking,
  deleteDocumentNonBlocking,
  useUser as useAuthUser
} from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function SettingsPage() {
  const db = useFirestore();
  const { user: authUser } = useAuthUser();
  const { dataSource } = useSettings();
  
  const [activeTab, setActiveTab] = useState('general');

  // Tenant Management State
  const { data: tenants, isLoading: isTenantsLoading, refresh: refreshTenants } = usePluggableCollection<any>('tenants');
  const [isTenantDialogOpen, setIsTenantDialogOpen] = useState(false);
  const [isTenantDeleteOpen, setIsTenantDeleteOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  
  // Service Partner State
  const { data: servicePartners, isLoading: isPartnersLoading, refresh: refreshPartners } = usePluggableCollection<any>('servicePartners');
  const [isPartnerDialogOpen, setIsPartnerDialogOpen] = useState(false);
  const [isPartnerDeleteOpen, setIsPartnerDeleteOpen] = useState(false);
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
  const [jiraUrl, setJiraUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [jiraProject, setJiraProject] = useState('');
  const [jiraIssueType, setJiraIssueType] = useState('Zugriffs- und Berechtigungsanfrage');
  const [jiraApprovedStatus, setJiraApprovedStatus] = useState('Erteilt');
  const [jiraDoneStatus, setJiraDoneStatus] = useState('Erledigt');
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
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [isFetchingWorkspaces, setIsFetchingWorkspaces] = useState(false);
  const [isWorkspaceDialogOpen, setIsWorkspaceDialogOpen] = useState(false);
  const [isSavingJira, setIsSavingJira] = useState(false);
  const [isTestingJira, setIsTestingJira] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);

  useEffect(() => {
    const loadJira = async () => {
      const configs = await getJiraConfigs();
      if (configs.length > 0) {
        const c = configs[0];
        setJiraUrl(c.url || '');
        setJiraEmail(c.email || '');
        setJiraToken(c.apiToken || '');
        setJiraProject(c.projectKey || '');
        setJiraIssueType(c.issueTypeName || 'Zugriffs- und Berechtigungsanfrage');
        setJiraApprovedStatus(c.approvedStatusName || 'Erteilt');
        setJiraDoneStatus(c.doneStatusName || 'Erledigt');
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

  const openEditPartner = (p: any) => {
    setSelectedPartner(p);
    setPartnerName(p.name);
    setPartnerContact(p.contactPerson || '');
    setPartnerEmail(p.email || '');
    setPartnerPhone(p.phone || '');
    setPartnerTenantId(p.tenantId || 'global');
    setIsPartnerDialogOpen(true);
  };

  const fetchWorkspaces = async () => {
    if (!jiraUrl) return;
    setIsFetchingWorkspaces(true);
    const res = await getJiraWorkspacesAction({ url: jiraUrl, email: jiraEmail, apiToken: jiraToken });
    if (res.success) { setWorkspaces(res.workspaces!); setIsWorkspaceDialogOpen(true); }
    setIsFetchingWorkspaces(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Systemeinstellungen</h1>
          <p className="text-muted-foreground mt-1">Plattform-Governance und Partner-Management.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-card border h-12 p-1 gap-1 rounded-none w-full justify-start overflow-x-auto">
          <TabsTrigger value="general" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Settings className="w-3.5 h-3.5" /> Organisation</TabsTrigger>
          <TabsTrigger value="tenants" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Building2 className="w-3.5 h-3.5" /> Mandanten</TabsTrigger>
          <TabsTrigger value="partners" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Contact className="w-3.5 h-3.5" /> Service Partner</TabsTrigger>
          <TabsTrigger value="jira" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><ExternalLink className="w-3.5 h-3.5" /> JIRA</TabsTrigger>
          <TabsTrigger value="data" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Database className="w-3.5 h-3.5" /> Datenquelle</TabsTrigger>
        </TabsList>

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
              <div>
                <CardTitle className="text-[10px] font-bold uppercase">Betriebsverantwortliche & Service Partner</CardTitle>
                <CardDescription className="text-[9px] uppercase font-bold">Zentrale Liste der Firmen und Kontakte für den Betrieb von IT-Systemen.</CardDescription>
              </div>
              <Button size="sm" className="h-8 text-[10px] font-bold uppercase rounded-none" onClick={() => { setSelectedPartner(null); setIsPartnerDialogOpen(true); }}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Partner hinzufügen
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-bold uppercase text-[10px] py-4">Firma (Partner)</TableHead>
                    <TableHead className="font-bold uppercase text-[10px]">Kontaktperson</TableHead>
                    <TableHead className="font-bold uppercase text-[10px]">E-Mail / Telefon</TableHead>
                    <TableHead className="text-right font-bold uppercase text-[10px]">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isPartnersLoading ? (
                    <TableRow><TableCell colSpan={4} className="h-32 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : servicePartners?.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic text-xs">Keine Partner hinterlegt.</TableCell></TableRow>
                  ) : (
                    servicePartners?.map((p: any) => (
                      <TableRow key={p.id} className="border-b">
                        <TableCell className="font-bold text-sm py-4">{p.name}</TableCell>
                        <TableCell className="text-xs">{p.contactPerson}</TableCell>
                        <TableCell className="text-[10px] font-mono">
                          {p.email}<br/>{p.phone}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEditPartner(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jira">
          {/* Bestehende Jira UI hier... */}
          <Card className="rounded-none border shadow-none">
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle className="text-[10px] font-bold uppercase">Jira Integration</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Cloud URL</Label>
                  <Input value={jiraUrl} onChange={e => setJiraUrl(e.target.value)} className="rounded-none" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Projekt Key</Label>
                  <Input value={jiraProject} onChange={e => setJiraProject(e.target.value)} className="rounded-none" />
                </div>
              </div>
            </CardContent>
          </Card>
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
          </div>
          <DialogFooter><Button onClick={handleSaveTenant} className="rounded-none uppercase font-bold text-[10px]">Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
