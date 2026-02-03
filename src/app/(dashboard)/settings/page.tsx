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
  Info,
  HelpCircle,
  Search,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { useSettings } from '@/context/settings-context';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  getJiraConfigs, 
  testJiraConnectionAction, 
  getJiraWorkspacesAction,
  getJiraAttributesAction
} from '@/app/actions/jira-actions';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

export default function SettingsPage() {
  const [tenantName, setTenantName] = useState('Acme Corp');
  const [tenantSlug, setTenantSlug] = useState('acme');
  const { dataSource, setDataSource } = useSettings();
  
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
  const [assetsNameAttributeId, setAssetsNameAttributeId] = useState('1');
  const [assetsSystemAttributeId, setAssetsSystemAttributeId] = useState('');

  // Dropdown / Modal States
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [isFetchingWorkspaces, setIsFetchingWorkspaces] = useState(false);
  const [isFetchingAttributes, setIsFetchingAttributes] = useState(false);
  const [isFetchingRefAttributes, setIsFetchingRefAttributes] = useState(false);
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
        setAssetsNameAttributeId(c.assetsNameAttributeId || '1');
        setAssetsSystemAttributeId(c.assetsSystemAttributeId || '');
      }
    };
    loadJira();
  }, []);

  const fetchWorkspaces = async () => {
    if (!jiraUrl || !jiraEmail || !jiraToken) {
      toast({ variant: "destructive", title: "Fehlende Daten", description: "Bitte geben Sie zuerst URL, E-Mail und API Token ein." });
      return;
    }

    setIsFetchingWorkspaces(true);
    try {
      const res = await getJiraWorkspacesAction({ url: jiraUrl, email: jiraEmail, apiToken: jiraToken });
      if (res.success && res.workspaces) {
        setWorkspaces(res.workspaces);
        setIsWorkspaceDialogOpen(true);
      } else {
        toast({ variant: "destructive", title: "Abruf fehlgeschlagen", description: res.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsFetchingWorkspaces(false);
    }
  };

  const discoverNameAttribute = async () => {
    if (!assetsWorkspaceId || !assetsResourceObjectTypeId) {
      toast({ variant: "destructive", title: "Fehlende Daten", description: "Workspace ID und Ressourcen-Objekttyp ID werden benötigt." });
      return;
    }

    setIsFetchingAttributes(true);
    try {
      const res = await getJiraAttributesAction({
        url: jiraUrl,
        email: jiraEmail,
        apiToken: jiraToken,
        workspaceId: assetsWorkspaceId,
        objectTypeId: assetsResourceObjectTypeId
      });

      if (res.success && res.labelAttributeId) {
        setAssetsNameAttributeId(res.labelAttributeId);
        toast({ title: "Attribut-ID erkannt", description: `Die ID für das Namensfeld ist ${res.labelAttributeId}.` });
      } else {
        toast({ variant: "destructive", title: "Nicht gefunden", description: "Das Label-Attribut konnte nicht automatisch erkannt werden." });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsFetchingAttributes(false);
    }
  };

  const discoverSystemRefAttribute = async () => {
    if (!assetsWorkspaceId || !assetsRoleObjectTypeId || !assetsResourceObjectTypeId) {
      toast({ variant: "destructive", title: "Fehlende Daten", description: "Workspace ID, Rollen-Typ ID und Ressourcen-Typ ID werden benötigt." });
      return;
    }

    setIsFetchingRefAttributes(true);
    try {
      const res = await getJiraAttributesAction({
        url: jiraUrl,
        email: jiraEmail,
        apiToken: jiraToken,
        workspaceId: assetsWorkspaceId,
        objectTypeId: assetsRoleObjectTypeId,
        targetObjectTypeId: assetsResourceObjectTypeId
      });

      if (res.success && res.referenceAttributeId) {
        setAssetsSystemAttributeId(res.referenceAttributeId);
        toast({ title: "Referenz-ID erkannt", description: `Die ID für die Systemverknüpfung ist ${res.referenceAttributeId}.` });
      } else {
        toast({ variant: "destructive", title: "Nicht gefunden", description: "Es wurde kein Attribut gefunden, das auf den Ressourcen Objekttyp verweist." });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsFetchingRefAttributes(false);
    }
  };

  const selectWorkspace = (ws: { id: string; name: string }) => {
    setAssetsWorkspaceId(ws.id);
    setIsWorkspaceDialogOpen(false);
  };

  const handleSaveGeneral = () => {
    toast({ title: "Einstellungen gespeichert" });
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
  };

  const handleSaveJira = async () => {
    setIsSavingJira(true);
    const configData = {
      id: 'global-jira',
      tenantId: 't1',
      name: 'Haupt-Jira',
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
      assetsNameAttributeId,
      assetsSystemAttributeId
    };

    const res = await saveCollectionRecord('jiraConfigs', 'global-jira', configData);
    if (res.success) {
      toast({ title: "Jira-Konfiguration gespeichert" });
    } else {
      toast({ variant: "destructive", title: "Fehler", description: res.error });
    }
    setIsSavingJira(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Systemeinstellungen</h1>
          <p className="text-muted-foreground mt-1">Konfiguration der ComplianceHub-Plattform und Integrationen.</p>
        </div>
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <div className="bg-primary/10 text-primary px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider">
            Acme Corp
          </div>
        </div>
      </div>

      <Tabs defaultValue="jira" className="space-y-6">
        <TabsList className="bg-card border h-12 p-1 gap-1 rounded-none w-full justify-start">
          <TabsTrigger value="general" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Settings className="w-3.5 h-3.5" /> Allgemein</TabsTrigger>
          <TabsTrigger value="jira" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><ExternalLink className="w-3.5 h-3.5" /> JIRA Integration</TabsTrigger>
          <TabsTrigger value="data" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Database className="w-3.5 h-3.5" /> Datenquelle</TabsTrigger>
          <TabsTrigger value="security" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Lock className="w-3.5 h-3.5" /> Sicherheit</TabsTrigger>
        </TabsList>

        <TabsContent value="jira" className="space-y-6">
          <Card className="rounded-none shadow-none border overflow-hidden">
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest">Jira Service Management Anbindung</CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">Automatisieren Sie Workflows zwischen ComplianceHub und Jira.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="flex items-center justify-between p-4 border bg-blue-50/10 border-blue-100/50">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold">Integration aktivieren</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Tickets automatisch erstellen und synchronisieren.</p>
                </div>
                <Switch checked={jiraEnabled} onCheckedChange={setJiraEnabled} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">JIRA CLOUD URL</Label>
                  <Input placeholder="https://ihre-instanz.atlassian.net" value={jiraUrl} onChange={e => setJiraUrl(e.target.value)} className="rounded-none h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">PROJEKT KEY</Label>
                  <Input placeholder="ITSM" value={jiraProject} onChange={e => setJiraProject(e.target.value)} className="rounded-none h-10" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">ANFRAGETYP (REQUEST TYPE)</Label>
                  <Input placeholder="Zugriffs- und Berechtigungsanfrage" value={jiraIssueType} onChange={e => setJiraIssueType(e.target.value)} className="rounded-none h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">STATUS FÜR "GENEHMIGT" (APPROVED)</Label>
                  <Input placeholder="Erteilt" value={jiraApprovedStatus} onChange={e => setJiraApprovedStatus(e.target.value)} className="rounded-none h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">ADMIN E-MAIL</Label>
                  <Input placeholder="m.mustermann@acme.com" value={jiraEmail} onChange={e => setJiraEmail(e.target.value)} className="rounded-none h-10" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">ATLASSIAN API TOKEN</Label>
                  <Input type="password" value={jiraToken} onChange={e => setJiraToken(e.target.value)} className="rounded-none h-10" />
                </div>
              </div>

              <div className="pt-8 border-t space-y-6">
                <div className="flex items-center gap-2">
                  <Box className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold font-headline">Jira Assets (Insight) Konfiguration</h3>
                </div>
                
                <div className="space-y-6 bg-slate-50/50 p-6 border">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">ASSETS WORKSPACE ID (UUID)</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-[8px] font-bold uppercase gap-1"
                        onClick={fetchWorkspaces}
                        disabled={isFetchingWorkspaces}
                      >
                        {isFetchingWorkspaces ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        SUCHEN / LADEN
                      </Button>
                    </div>
                    <Input placeholder="a1b2c3d4-..." value={assetsWorkspaceId} onChange={e => setAssetsWorkspaceId(e.target.value)} className="rounded-none bg-white font-mono text-[11px] h-10" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">SCHEMA ID</Label>
                      <Input placeholder="z.B. 4" value={assetsSchemaId} onChange={e => setAssetsSchemaId(e.target.value)} className="rounded-none bg-white h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">OBJEKTTYP ID: RESSOURCEN</Label>
                      <Input placeholder="z.B. 42" value={assetsResourceObjectTypeId} onChange={e => setAssetsResourceObjectTypeId(e.target.value)} className="rounded-none bg-white h-10" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">OBJEKTTYP ID: ROLLEN</Label>
                      </div>
                      <Input placeholder="z.B. 43" value={assetsRoleObjectTypeId} onChange={e => setAssetsRoleObjectTypeId(e.target.value)} className="rounded-none bg-white h-10" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">ATTRIBUT-ID FÜR 'NAME' (LABEL)</Label>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-[8px] font-bold uppercase gap-1"
                          onClick={discoverNameAttribute}
                          disabled={isFetchingAttributes || !assetsResourceObjectTypeId}
                        >
                          {isFetchingAttributes ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          ERKENNEN
                        </Button>
                      </div>
                      <Input placeholder="Standard: 1" value={assetsNameAttributeId} onChange={e => setAssetsNameAttributeId(e.target.value)} className="rounded-none bg-white h-10" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">ATTRIBUT-ID FÜR SYSTEM-REFERENZ</Label>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-[8px] font-bold uppercase gap-1"
                          onClick={discoverSystemRefAttribute}
                          disabled={isFetchingRefAttributes || !assetsRoleObjectTypeId || !assetsResourceObjectTypeId}
                        >
                          {isFetchingRefAttributes ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          ERKENNEN
                        </Button>
                      </div>
                      <Input placeholder="z.B. 10" value={assetsSystemAttributeId} onChange={e => setAssetsSystemAttributeId(e.target.value)} className="rounded-none bg-white h-10" />
                    </div>
                  </div>
                </div>
              </div>

              {testResult && (
                <div className={cn(
                  "p-4 border rounded-none text-[10px] font-bold uppercase animate-in slide-in-from-top-2",
                  testResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"
                )}>
                  <div className="flex items-start gap-3">
                    {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    <div className="space-y-1">
                      <p>{testResult.message}</p>
                      {testResult.details && <p className="font-mono text-[9px] opacity-70 mt-2 bg-white/50 p-2 border border-current/20">{testResult.details}</p>}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t p-4 flex justify-between bg-muted/5">
              <Button variant="outline" onClick={handleTestJira} disabled={isTestingJira} className="rounded-none gap-2 font-bold uppercase text-[10px] border-primary/20 text-primary h-11 px-8 hover:bg-primary/5">
                {isTestingJira ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} 
                VERBINDUNG TESTEN
              </Button>
              <Button onClick={handleSaveJira} disabled={isSavingJira} className="rounded-none gap-2 font-bold uppercase text-[10px] h-11 px-8">
                {isSavingJira ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
                INTEGRATION SPEICHERN
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="space-y-6">
          <Card className="rounded-none shadow-none border">
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest">Organisation</CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">Stammdaten Ihres Mandanten.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">NAME DER ORGANISATION</Label>
                  <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} className="rounded-none h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">MANDANTEN-SLUG (URL)</Label>
                  <Input value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} className="rounded-none h-10" />
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t p-4 flex justify-end">
              <Button onClick={handleSaveGeneral} className="rounded-none gap-2 font-bold uppercase text-[10px] h-11 px-8"><Save className="w-4 h-4" /> SPEICHERN</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Card className="rounded-none shadow-none border">
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest">Datenquellen-Konfiguration</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <RadioGroup value={dataSource} onValueChange={(value) => setDataSource(value as any)}>
                <Label className="flex items-center gap-4 p-6 rounded-none border has-[:checked]:bg-primary/5 has-[:checked]:border-primary transition-all cursor-pointer">
                  <RadioGroupItem value="firestore" id="firestore" />
                  <Database className="w-6 h-6 text-primary"/>
                  <div>
                    <p className="font-bold text-sm">Google Firestore</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Echtzeit Cloud-Datenbank (NoSQL).</p>
                  </div>
                </Label>
                <Label className="flex items-center gap-4 p-6 rounded-none border has-[:checked]:bg-primary/5 has-[:checked]:border-primary transition-all cursor-pointer mt-4">
                  <RadioGroupItem value="mysql" id="mysql" />
                  <Database className="w-6 h-6 text-orange-600"/>
                  <div>
                    <p className="font-bold text-sm">MySQL Datenbank</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Relationales System für On-Prem Szenarien.</p>
                  </div>
                </Label>
              </RadioGroup>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isWorkspaceDialogOpen} onOpenChange={setIsWorkspaceDialogOpen}>
        <DialogContent className="rounded-none max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[10px] font-bold uppercase tracking-widest">Workspace auswählen</DialogTitle>
            <DialogDescription className="text-xs">Wählen Sie den Ziel-Workspace für Ihre Jira Assets.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {workspaces.map(ws => (
              <Button 
                key={ws.id} 
                variant="outline" 
                className="w-full justify-between rounded-none font-bold text-xs h-12 hover:bg-primary/5 hover:border-primary transition-all group"
                onClick={() => selectWorkspace(ws)}
              >
                <div className="flex flex-col items-start">
                  <span>{ws.name}</span>
                  <span className="text-[8px] text-muted-foreground font-mono truncate max-w-[200px]">{ws.id}</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsWorkspaceDialogOpen(false)} className="rounded-none">Abbrechen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
