
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Save, 
  Database,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Building2,
  Pencil,
  Network,
  Contact,
  Wand2,
  FileSearch,
  Unplug,
  Calendar,
  AlertCircle,
  Users,
  ShieldCheck,
  Trash2,
  Lock,
  Mail,
  Send
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useSettings } from '@/context/settings-context';
import { 
  testJiraConnectionAction, 
  getJiraWorkspacesAction,
  getJiraSchemasAction,
  getJiraAttributesAction
} from '@/app/actions/jira-actions';
import { testSmtpConnectionAction } from '@/app/actions/smtp-actions';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlatformUser, Role, SmtpConfig } from '@/lib/types';

export default function SettingsPage() {
  const db = useFirestore();
  const { dataSource } = useSettings();
  
  const [activeTab, setActiveTab] = useState('general');

  // Load Configs via Pluggable Hook
  const { data: jiraConfigs, refresh: refreshJira } = usePluggableCollection<any>('jiraConfigs');
  const { data: smtpConfigs, refresh: refreshSmtp } = usePluggableCollection<SmtpConfig>('smtpConfigs');
  const { data: tenants, refresh: refreshTenants } = usePluggableCollection<any>('tenants');
  const { data: servicePartners, refresh: refreshPartners } = usePluggableCollection<any>('servicePartners');
  const { data: platformUsers, refresh: refreshPlatformUsers } = usePluggableCollection<PlatformUser>('platformUsers');

  // Platform User Management State
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<Role>('viewer');
  const [userTenantId, setUserTenantId] = useState('all');
  const [userEnabled, setUserEnabled] = useState(true);

  // SMTP State
  const [smtpId, setSmtpId] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFromEmail, setSmtpFromEmail] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('ComplianceHub');
  const [smtpEncryption, setSmtpEncryption] = useState<'none' | 'ssl' | 'tls'>('tls');
  const [smtpEnabled, setSmtpEnabled] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);

  // Tenant Management State
  const [isTenantDialogOpen, setIsTenantDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  
  // Service Partner State
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
  const [jiraTokenExpiresAt, setJiraTokenExpiresAt] = useState('');
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
  const [isDiscovering, setIsDiscovering] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Hydrate SMTP Form
  useEffect(() => {
    if (smtpConfigs && smtpConfigs.length > 0) {
      const s = smtpConfigs[0];
      setSmtpId(s.id);
      setSmtpHost(s.host || '');
      setSmtpPort(s.port || '587');
      setSmtpUser(s.user || '');
      setSmtpPass(s.pass || '');
      setSmtpFromEmail(s.fromEmail || '');
      setSmtpFromName(s.fromName || 'ComplianceHub');
      setSmtpEncryption(s.encryption || 'tls');
      setSmtpEnabled(!!s.enabled);
    }
  }, [smtpConfigs]);

  // Hydrate Jira Form when data is loaded
  useEffect(() => {
    if (jiraConfigs && jiraConfigs.length > 0) {
      const c = jiraConfigs[0];
      setJiraConfigId(c.id);
      setJiraUrl(c.url || '');
      setJiraEmail(c.email || '');
      setJiraToken(c.apiToken || '');
      setJiraTokenExpiresAt(c.apiTokenExpiresAt || '');
      setJiraProject(c.projectKey || '');
      setJiraIssueType(c.issueTypeName || 'Service Request');
      setJiraApprovedStatus(c.approvedStatusName || 'Approved');
      setJiraDoneStatus(c.doneStatusName || 'Done');
      setJiraEnabled(!!c.enabled);
      setAssetsWorkspaceId(c.assetsWorkspaceId || '');
      setAssetsSchemaId(c.assetsSchemaId || '');
      setAssetsResourceObjectTypeId(c.assetsResourceObjectTypeId || '');
      setAssetsRoleObjectTypeId(c.assetsRoleObjectTypeId || '');
      setAssetsResourceNameAttributeId(c.assetsResourceNameAttributeId || '1');
      setAssetsRoleNameAttributeId(c.assetsRoleNameAttributeId || '1');
      setAssetsSystemAttributeId(c.assetsSystemAttributeId || '');
    }
  }, [jiraConfigs]);

  const tokenExpiryStatus = useMemo(() => {
    if (!jiraTokenExpiresAt) return null;
    const expiryDate = new Date(jiraTokenExpiresAt);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffTime < 0) {
      return { type: 'expired', title: 'Token abgelaufen', message: 'Das Jira API Token ist ungültig. Bitte neues Token generieren.' };
    }
    if (diffDays <= 14) {
      return { type: 'warning', title: 'Token läuft bald ab', message: `Das Jira API Token läuft in ${diffDays} Tagen ab. Bitte rechtzeitig erneuern.` };
    }
    return null;
  }, [jiraTokenExpiresAt]);

  const handleSaveSmtp = async () => {
    setIsSaving(true);
    const id = smtpId || 'smtp-config-default';
    const data = {
      id, host: smtpHost, port: smtpPort, user: smtpUser, pass: smtpPass,
      fromEmail: smtpFromEmail, fromName: smtpFromName, encryption: smtpEncryption,
      enabled: smtpEnabled
    };
    try {
      if (dataSource === 'mysql') await saveCollectionRecord('smtpConfigs', id, data);
      else setDocumentNonBlocking(doc(db, 'smtpConfigs', id), data);
      toast({ title: "SMTP Konfiguration gespeichert" });
      setTimeout(() => refreshSmtp(), 200);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    setIsTestingSmtp(true);
    const res = await testSmtpConnectionAction({ host: smtpHost, port: smtpPort, user: smtpUser });
    setIsTestingSmtp(false);
    if (res.success) toast({ title: "SMTP Test erfolgreich", description: res.message });
    else toast({ variant: "destructive", title: "SMTP Test fehlgeschlagen", description: res.message });
  };

  const handleSaveJira = async () => {
    setIsSaving(true);
    const id = jiraConfigId || `jira-config-01`;
    const data = {
      id,
      tenantId: 'global',
      name: 'Standard Jira Integration',
      url: jiraUrl,
      email: jiraEmail,
      apiToken: jiraToken,
      apiTokenExpiresAt: jiraTokenExpiresAt,
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
      if (dataSource === 'mysql') {
        await saveCollectionRecord('jiraConfigs', id, data);
      } else {
        setDocumentNonBlocking(doc(db, 'jiraConfigs', id), data);
      }
      toast({ title: "Jira Konfiguration gespeichert" });
      setTimeout(() => refreshJira(), 200);
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

  const handleDiscoverWorkspace = async () => {
    setIsDiscovering('workspace');
    const res = await getJiraWorkspacesAction({ url: jiraUrl, email: jiraEmail, apiToken: jiraToken });
    setIsDiscovering(null);
    if (res.success && res.workspaces && res.workspaces.length > 0) {
      setAssetsWorkspaceId(res.workspaces[0].id);
      toast({ title: "Workspace gefunden", description: `Verwende: ${res.workspaces[0].name}` });
    } else {
      toast({ variant: "destructive", title: "Fehler", description: res.error || "Kein Workspace gefunden." });
    }
  };

  const handleDiscoverSchema = async () => {
    if (!assetsWorkspaceId) return toast({ title: "Hinweis", description: "Zuerst Workspace ID benötigt." });
    setIsDiscovering('schema');
    const res = await getJiraSchemasAction({ url: jiraUrl, email: jiraEmail, apiToken: jiraToken, workspaceId: assetsWorkspaceId });
    setIsDiscovering(null);
    if (res.success && res.schemas && res.schemas.length > 0) {
      setAssetsSchemaId(res.schemas[0].id);
      toast({ title: "Schema gefunden", description: `Verwende: ${res.schemas[0].name}` });
    } else {
      toast({ variant: "destructive", title: "Fehler", description: res.error || "Kein Schema gefunden." });
    }
  };

  const handleDiscoverAttributes = async (type: 'resource' | 'role') => {
    const objectTypeId = type === 'resource' ? assetsResourceObjectTypeId : assetsRoleObjectTypeId;
    if (!objectTypeId || !assetsWorkspaceId) return toast({ title: "Hinweis", description: "Objekttyp ID und Workspace ID erforderlich." });
    
    setIsDiscovering(`attr-${type}`);
    const res = await getJiraAttributesAction({ 
      url: jiraUrl, email: jiraEmail, apiToken: jiraToken, 
      workspaceId: assetsWorkspaceId, 
      objectTypeId,
      targetObjectTypeId: type === 'role' ? assetsResourceObjectTypeId : undefined
    });
    setIsDiscovering(null);

    if (res.success) {
      if (type === 'resource') {
        if (res.labelAttributeId) setAssetsResourceNameAttributeId(res.labelAttributeId);
      } else {
        if (res.labelAttributeId) setAssetsRoleNameAttributeId(res.labelAttributeId);
        if (res.referenceAttributeId) setAssetsSystemAttributeId(res.referenceAttributeId);
      }
      toast({ title: "Attribute analysiert", description: "Mapping-Felder wurden automatisch befüllt." });
    } else {
      toast({ variant: "destructive", title: "Fehler", description: res.error });
    }
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

  const handleSavePlatformUser = async () => {
    if (!userName || !userEmail) return;
    const id = selectedUser?.id || `puser-${Math.random().toString(36).substring(2, 7)}`;
    
    // Wir bauen das Objekt dynamisch auf, um leere Passwörter (keine Änderung) 
    // nicht mitzusenden, was das Überschreiben in der DB verhindert.
    const userData: any = {
      id,
      email: userEmail,
      displayName: userName,
      role: userRole,
      tenantId: userTenantId,
      enabled: userEnabled,
      createdAt: selectedUser?.createdAt || new Date().toISOString()
    };

    // Nur mitsenden, wenn tatsächlich ein neues Passwort eingegeben wurde
    if (userPassword && userPassword.trim() !== '') {
      userData.password = userPassword;
    }

    if (dataSource === 'mysql') {
      await saveCollectionRecord('platformUsers', id, userData);
    } else {
      // Für Firestore nutzen wir merge: true, um das Passwort nicht zu löschen, wenn es nicht gesendet wird
      setDocumentNonBlocking(doc(db, 'platformUsers', id), userData, { merge: true });
    }

    toast({ title: "Plattform-Nutzer gespeichert" });
    setIsUserDialogOpen(false);
    setTimeout(() => refreshPlatformUsers(), 200);
  };

  const handleDeletePlatformUser = async (id: string) => {
    if (dataSource === 'mysql') await deleteCollectionRecord('platformUsers', id);
    else {
      // Non-blocking delete for Firestore
      const { deleteDocumentNonBlocking } = await import('@/firebase');
      deleteDocumentNonBlocking(doc(db, 'platformUsers', id));
    }
    toast({ title: "Nutzer entfernt" });
    setTimeout(() => refreshPlatformUsers(), 200);
  };

  const getTenantSlug = (id?: string | null) => {
    if (!id || id === 'all' || id === 'global') return 'Global';
    const tenant = tenants?.find(t => t.id === id);
    return tenant ? tenant.slug : id;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-20">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Systemeinstellungen</h1>
          <p className="text-muted-foreground mt-1">Plattform-Governance, Jira-Automatisierung und Benutzerverwaltung.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-card border h-12 p-1 gap-1 rounded-none w-full justify-start overflow-x-auto">
          <TabsTrigger value="general" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Settings className="w-3.5 h-3.5" /> Organisation</TabsTrigger>
          <TabsTrigger value="users" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Users className="w-3.5 h-3.5" /> Plattform-Nutzer</TabsTrigger>
          <TabsTrigger value="tenants" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Building2 className="w-3.5 h-3.5" /> Mandanten</TabsTrigger>
          <TabsTrigger value="partners" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Contact className="w-3.5 h-3.5" /> Service Partner</TabsTrigger>
          <TabsTrigger value="jira" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><ExternalLink className="w-3.5 h-3.5" /> JIRA Integration</TabsTrigger>
          <TabsTrigger value="smtp" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Mail className="w-3.5 h-3.5" /> E-Mail (SMTP)</TabsTrigger>
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

        <TabsContent value="users">
          <Card className="rounded-none border shadow-none">
            <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-[10px] font-bold uppercase">Administratoren & Operatoren</CardTitle>
                <CardDescription className="text-[9px] font-bold uppercase mt-1">Verwalten Sie den Zugriff auf dieses System.</CardDescription>
              </div>
              <Button size="sm" className="h-8 text-[10px] font-bold uppercase rounded-none" onClick={() => { 
                setSelectedUser(null); setUserName(''); setUserEmail(''); setUserPassword(''); setUserRole('viewer'); setUserTenantId('all'); setUserEnabled(true);
                setIsUserDialogOpen(true); 
              }}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Nutzer hinzufügen
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-bold uppercase text-[10px] py-4">Name / E-Mail</TableHead>
                    <TableHead className="font-bold uppercase text-[10px]">Rolle</TableHead>
                    <TableHead className="font-bold uppercase text-[10px]">Mandant</TableHead>
                    <TableHead className="font-bold uppercase text-[10px]">Status</TableHead>
                    <TableHead className="text-right font-bold uppercase text-[10px]">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {platformUsers?.map((u) => (
                    <TableRow key={u.id} className="border-b">
                      <TableCell className="py-4">
                        <div className="font-bold text-sm">{u.displayName}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{u.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-none text-[9px] font-bold uppercase bg-slate-50">{u.role}</Badge>
                      </TableCell>
                      <TableCell className="text-[10px] font-bold uppercase">{getTenantSlug(u.tenantId)}</TableCell>
                      <TableCell>
                        {u.enabled ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 rounded-none text-[8px] font-bold uppercase">Aktiv</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground rounded-none text-[8px] font-bold uppercase">Inaktiv</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => {
                            setSelectedUser(u); setUserName(u.displayName); setUserEmail(u.email); setUserPassword(''); setUserRole(u.role); setUserTenantId(u.tenantId); setUserEnabled(!!u.enabled);
                            setIsUserDialogOpen(true);
                          }}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="text-red-600" onClick={() => handleDeletePlatformUser(u.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="smtp">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="rounded-none border shadow-none">
                <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-[10px] font-bold uppercase">SMTP Server Konfiguration</CardTitle>
                    <CardDescription className="text-[9px] uppercase font-bold">Wird für Passwort-Reset und Benachrichtigungen benötigt.</CardDescription>
                  </div>
                  <Switch checked={smtpEnabled} onCheckedChange={setSmtpEnabled} />
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Host</Label>
                      <Input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.mailtrap.io" className="rounded-none" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Port</Label>
                      <Input value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" className="rounded-none" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Benutzer</Label>
                      <Input value={smtpUser} onChange={e => setSmtpUser(e.target.value)} className="rounded-none" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Passwort</Label>
                      <Input type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} className="rounded-none" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Verschlüsselung</Label>
                      <Select value={smtpEncryption} onValueChange={(v: any) => setSmtpEncryption(v)}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="none">Keine</SelectItem>
                          <SelectItem value="ssl">SSL (Port 465)</SelectItem>
                          <SelectItem value="tls">TLS/STARTTLS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Absender-E-Mail</Label>
                      <Input value={smtpFromEmail} onChange={e => setSmtpFromEmail(e.target.value)} placeholder="no-reply@company.com" className="rounded-none" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Absender-Name</Label>
                      <Input value={smtpFromName} onChange={e => setSmtpFromName(e.target.value)} className="rounded-none" />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/5 border-t py-3 flex justify-end gap-2">
                  <Button variant="outline" size="sm" className="h-8 rounded-none font-bold uppercase text-[10px]" onClick={handleTestSmtp} disabled={isTestingSmtp}>
                    {isTestingSmtp ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Send className="w-3 h-3 mr-2" />} Test Mail
                  </Button>
                  <Button size="sm" className="h-8 rounded-none font-bold uppercase text-[10px]" onClick={handleSaveSmtp} disabled={isSaving}>
                    <Save className="w-3 h-3 mr-2" /> Speichern
                  </Button>
                </CardFooter>
              </Card>
            </div>
            <div className="space-y-6">
              <Alert className="rounded-none border-blue-200 bg-blue-50 text-blue-800">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-[10px] font-bold uppercase">Hinweis</AlertTitle>
                <AlertDescription className="text-xs">
                  Die SMTP-Zugangsdaten werden lokal in Ihrer {dataSource.toUpperCase()} Datenbank gespeichert. Stellen Sie sicher, dass Ihr Server ausgehende Verbindungen auf dem gewählten Port erlaubt.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tenants">
          <Card className="rounded-none border shadow-none">
            <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between">
              <div><CardTitle className="text-[10px] font-bold uppercase">Firmen / Standorte</CardTitle></div>
              <Button size="sm" className="h-8 text-[10px] font-bold uppercase rounded-none" onClick={() => { setSelectedTenant(null); setTenantName(''); setTenantSlug(''); setIsTenantDialogOpen(true); }}>
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
              <Button size="sm" className="h-8 text-[10px] font-bold uppercase rounded-none" onClick={() => { setSelectedPartner(null); setPartnerName(''); setPartnerContact(''); setPartnerEmail(''); setPartnerPhone(''); setIsPartnerDialogOpen(true); }}>
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
              
              {tokenExpiryStatus && (
                <Alert variant={tokenExpiryStatus.type === 'expired' ? 'destructive' : 'default'} className={cn("rounded-none border-2", tokenExpiryStatus.type === 'warning' && "border-amber-500 bg-amber-50 text-amber-900")}>
                  {tokenExpiryStatus.type === 'expired' ? <AlertCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                  <AlertTitle className="font-bold uppercase text-xs">{tokenExpiryStatus.title}</AlertTitle>
                  <AlertDescription className="text-xs">{tokenExpiryStatus.message}</AlertDescription>
                </Alert>
              )}

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
                    <div className="space-y-2 col-span-2">
                      <Label className="text-[10px] font-bold uppercase flex items-center gap-2">
                        <Calendar className="w-3 h-3" /> Token gültig bis
                      </Label>
                      <Input 
                        type="date" 
                        value={jiraTokenExpiresAt} 
                        onChange={e => setJiraTokenExpiresAt(e.target.value)} 
                        className={cn("rounded-none", tokenExpiryStatus?.type === 'expired' && "border-red-500", tokenExpiryStatus?.type === 'warning' && "border-amber-500")} 
                      />
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
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-bold uppercase">Assets Workspace ID</Label>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[8px] uppercase gap-1" onClick={handleDiscoverWorkspace} disabled={isDiscovering === 'workspace'}>
                          {isDiscovering === 'workspace' ? <Loader2 className="w-2 h-2 animate-spin" /> : <Wand2 className="w-2 h-2" />} Auto-Find
                        </Button>
                      </div>
                      <Input value={assetsWorkspaceId} onChange={e => setAssetsWorkspaceId(e.target.value)} className="rounded-none" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-bold uppercase">Object Schema ID</Label>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[8px] uppercase gap-1" onClick={handleDiscoverSchema} disabled={isDiscovering === 'schema'}>
                          {isDiscovering === 'schema' ? <Loader2 className="w-2 h-2 animate-spin" /> : <Wand2 className="w-2 h-2" />} Auto-Find
                        </Button>
                      </div>
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
                  <div className="grid grid-cols-2 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-bold uppercase">Attr: Ressourcen-Name</Label>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[8px] uppercase gap-1" onClick={() => handleDiscoverAttributes('resource')} disabled={isDiscovering === 'attr-resource'}>
                          <FileSearch className="w-2 h-2" /> Scan
                        </Button>
                      </div>
                      <Input value={assetsResourceNameAttributeId} onChange={e => setAssetsResourceNameAttributeId(e.target.value)} className="rounded-none" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-bold uppercase">Attr: Rollen-Name</Label>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[8px] uppercase gap-1" onClick={() => handleDiscoverAttributes('role')} disabled={isDiscovering === 'attr-role'}>
                          <FileSearch className="w-2 h-2" /> Scan
                        </Button>
                      </div>
                      <Input value={assetsRoleNameAttributeId} onChange={e => setAssetsRoleNameAttributeId(e.target.value)} className="rounded-none" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Attr: System-Referenz</Label>
                      <Input value={assetsSystemAttributeId} onChange={e => setAssetsSystemAttributeId(e.target.value)} placeholder="Verknüpfung ID" className="rounded-none" />
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

        <TabsContent value="data">
          <Card className="rounded-none border shadow-none">
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle className="text-[10px] font-bold uppercase">Aktive Datenquelle</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-sm">Aktuell wird <strong>{dataSource.toUpperCase()}</strong> verwendet.</p>
              <Button variant="outline" size="sm" className="mt-4 rounded-none h-8 text-[10px] uppercase font-bold" onClick={() => window.location.href = '/setup'}>
                Datenquelle ändern
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Platform User Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="rounded-none max-w-md">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">Plattform-Nutzer verwalten</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">Anzeigename</Label>
              <Input value={userName} onChange={e => setUserName(e.target.value)} className="rounded-none" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">E-Mail (Login)</Label>
              <Input value={userEmail} onChange={e => setUserEmail(e.target.value)} className="rounded-none" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase flex items-center gap-2">
                <Lock className="w-3 h-3" /> Passwort {selectedUser && '(Leer lassen für keine Änderung)'}
              </Label>
              <Input type="password" value={userPassword} onChange={e => setUserPassword(e.target.value)} className="rounded-none" />
              <p className="text-[9px] text-muted-foreground italic uppercase">Wird bei Speicherung in MySQL automatisch sicher gehasht.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Plattform-Rolle</Label>
                <Select value={userRole} onValueChange={(v: Role) => setUserRole(v)}>
                  <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="superAdmin">Super Admin</SelectItem>
                    <SelectItem value="admin">Tenant Admin</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer (Read-only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Zuständigkeit</Label>
                <Select value={userTenantId} onValueChange={setUserTenantId}>
                  <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="all">Global (Alle)</SelectItem>
                    {tenants?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t">
              <Label className="text-[10px] font-bold uppercase">Nutzer aktiviert</Label>
              <Switch checked={userEnabled} onCheckedChange={setUserEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserDialogOpen(false)} className="rounded-none">Abbrechen</Button>
            <Button onClick={handleSavePlatformUser} className="rounded-none font-bold uppercase text-[10px]">Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        <DialogContent className="rounded-none max-lg">
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
