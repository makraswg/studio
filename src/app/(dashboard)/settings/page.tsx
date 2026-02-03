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
  RefreshCw,
  Search,
  ChevronRight
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { useSettings } from '@/context/settings-context';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { getJiraConfigs, testJiraConnectionAction, getJiraWorkspacesAction } from '@/app/actions/jira-actions';
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
  const [jiraIssueType, setJiraIssueType] = useState('Service Request');
  const [jiraApprovedStatus, setJiraApprovedStatus] = useState('Genehmigt');
  const [jiraDoneStatus, setJiraDoneStatus] = useState('Erledigt');
  const [jiraEnabled, setJiraEnabled] = useState(false);
  
  // Jira Assets State
  const [assetsWorkspaceId, setAssetsWorkspaceId] = useState('');
  const [assetsSchemaId, setAssetsSchemaId] = useState('');
  const [assetsResourceObjectTypeId, setAssetsResourceObjectTypeId] = useState('');
  const [assetsRoleObjectTypeId, setAssetsRoleObjectTypeId] = useState('');

  // Dropdown / Modal States
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
        setJiraIssueType(c.issueTypeName || 'Service Request');
        setJiraApprovedStatus(c.approvedStatusName || 'Genehmigt');
        setJiraDoneStatus(c.doneStatusName || 'Erledigt');
        setJiraEnabled(c.enabled || false);
        setAssetsWorkspaceId(c.assetsWorkspaceId || '');
        setAssetsSchemaId(c.assetsSchemaId || '');
        setAssetsResourceObjectTypeId(c.assetsResourceObjectTypeId || '');
        setAssetsRoleObjectTypeId(c.assetsRoleObjectTypeId || '');
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
    setWorkspaces([]);
    try {
      const res = await getJiraWorkspacesAction({ url: jiraUrl, email: jiraEmail, apiToken: jiraToken });
      if (res.success && res.workspaces) {
        if (res.workspaces.length === 0) {
          toast({ variant: "destructive", title: "Keine Workspaces", description: "Es wurden keine Assets-Workspaces für diesen Account gefunden." });
        } else {
          setWorkspaces(res.workspaces);
          setIsWorkspaceDialogOpen(true);
        }
      } else {
        toast({ 
          variant: "destructive", 
          title: "Abruf fehlgeschlagen", 
          description: res.error || "Workspaces konnten nicht geladen werden. Prüfen Sie die Berechtigungen." 
        });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsFetchingWorkspaces(false);
    }
  };

  const selectWorkspace = (ws: { id: string; name: string }) => {
    setAssetsWorkspaceId(ws.id);
    setIsWorkspaceDialogOpen(false);
    toast({ title: "Workspace ausgewählt", description: ws.name });
  };

  const handleSaveGeneral = () => {
    toast({ title: "Einstellungen gespeichert", description: "Allgemeine Daten wurden aktualisiert." });
  };

  const handleTestJira = async () => {
    setIsTestingJira(true);
    setTestResult(null);
    
    const configData = {
      url: jiraUrl,
      email: jiraEmail,
      apiToken: jiraToken,
      projectKey: jiraProject,
      issueTypeName: jiraIssueType,
      approvedStatusName: jiraApprovedStatus,
      doneStatusName: jiraDoneStatus,
      assetsWorkspaceId
    };

    const res = await testJiraConnectionAction(configData);
    setTestResult(res);
    setIsTestingJira(false);
    
    if (res.success) {
      toast({ title: "Jira Test erfolgreich", description: res.message });
    } else {
      toast({ variant: "destructive", title: "Jira Test fehlgeschlagen", description: res.message });
    }
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
      assetsRoleObjectTypeId
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
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Systemeinstellungen</h1>
        <p className="text-muted-foreground mt-1">Konfiguration der ComplianceHub-Plattform und Integrationen.</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-card border h-12 p-1 gap-1 rounded-none">
          <TabsTrigger value="general" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Settings className="w-3.5 h-3.5" /> Allgemein</TabsTrigger>
          <TabsTrigger value="jira" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><ExternalLink className="w-3.5 h-3.5" /> Jira Integration</TabsTrigger>
          <TabsTrigger value="data" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Database className="w-3.5 h-3.5" /> Datenquelle</TabsTrigger>
          <TabsTrigger value="security" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Lock className="w-3.5 h-3.5" /> Sicherheit</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card className="rounded-none shadow-none border">
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle className="text-xs font-bold uppercase">Organisation</CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold">Stammdaten Ihres Mandanten.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Name der Organisation</Label>
                  <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} className="rounded-none" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Mandanten-Slug (URL)</Label>
                  <Input value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} className="rounded-none" />
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t p-4 flex justify-end">
              <Button onClick={handleSaveGeneral} className="rounded-none gap-2 font-bold uppercase text-[10px]"><Save className="w-4 h-4" /> Speichern</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="jira" className="space-y-6">
          <Card className="rounded-none shadow-none border overflow-hidden">
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle className="text-xs font-bold uppercase">Jira Service Management Anbindung</CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold">Automatisieren Sie Workflows zwischen ComplianceHub und Jira.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="flex items-center justify-between p-4 border bg-blue-50/30">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold">Integration Aktivieren</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Tickets automatisch erstellen und synchronisieren.</p>
                </div>
                <Switch checked={jiraEnabled} onCheckedChange={setJiraEnabled} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-[10px] font-bold uppercase">Jira Cloud URL</Label>
                    <TooltipProvider><Tooltip><TooltipTrigger><HelpCircle className="w-3 h-3 text-muted-foreground"/></TooltipTrigger><TooltipContent className="max-w-xs text-[10px] font-bold uppercase">Die Haupt-URL Ihrer Instanz, z.B. https://company.atlassian.net.</TooltipContent></Tooltip></TooltipProvider>
                  </div>
                  <Input placeholder="https://company.atlassian.net" value={jiraUrl} onChange={e => setJiraUrl(e.target.value)} className="rounded-none" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Projekt Key</Label>
                  <Input placeholder="ITSM" value={jiraProject} onChange={e => setJiraProject(e.target.value)} className="rounded-none" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Anfragetyp (Request Type)</Label>
                  <Input placeholder="Zugriffsanfrage" value={jiraIssueType} onChange={e => setJiraIssueType(e.target.value)} className="rounded-none" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Status für "Genehmigt" (approved)</Label>
                  <Input placeholder="Genehmigt" value={jiraApprovedStatus} onChange={e => setJiraApprovedStatus(e.target.value)} className="rounded-none" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Status für "Erledigt" (done)</Label>
                  <Input placeholder="Erledigt" value={jiraDoneStatus} onChange={e => setJiraDoneStatus(e.target.value)} className="rounded-none" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Admin E-Mail</Label>
                  <Input placeholder="jira-admin@company.com" value={jiraEmail} onChange={e => setJiraEmail(e.target.value)} className="rounded-none" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Atlassian API Token</Label>
                  <Input type="password" value={jiraToken} onChange={e => setJiraToken(e.target.value)} className="rounded-none" />
                </div>
              </div>

              <div className="pt-6 border-t">
                <div className="flex items-center gap-2 mb-4">
                  <Box className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold">Jira Assets (Insight) Konfiguration</h3>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-[10px] font-bold uppercase leading-relaxed">
                        Die Assets-Konfiguration ermöglicht es, Rollen und Systeme als Objekte in Jira zu pflegen.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border bg-slate-50/50">
                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold uppercase">Assets Workspace ID (UUID)</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-[8px] font-bold uppercase gap-1"
                        onClick={fetchWorkspaces}
                        disabled={isFetchingWorkspaces}
                      >
                        {isFetchingWorkspaces ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                        Suchen / Laden
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="a1b2c3d4-..." 
                        value={assetsWorkspaceId} 
                        onChange={e => setAssetsWorkspaceId(e.target.value)} 
                        className="rounded-none bg-white font-mono text-[11px]" 
                      />
                    </div>
                    <p className="text-[8px] text-muted-foreground uppercase font-bold">
                      Die Workspace ID ist die UUID aus der Discovery-API (z.B. a1b2c3d4-...).
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase flex items-center justify-between">
                      Schema ID
                      <span className="text-[8px] font-normal text-muted-foreground">(Zahl)</span>
                    </Label>
                    <Input placeholder="z.B. 4" value={assetsSchemaId} onChange={e => setAssetsSchemaId(e.target.value)} className="rounded-none bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase flex items-center gap-2">
                      Objekttyp ID: Ressourcen (Systeme)
                    </Label>
                    <Input placeholder="z.B. 42" value={assetsResourceObjectTypeId} onChange={e => setAssetsResourceObjectTypeId(e.target.value)} className="rounded-none bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase flex items-center gap-2">
                      Objekttyp ID: Rollen (Berechtigungen)
                    </Label>
                    <Input placeholder="z.B. 43" value={assetsRoleObjectTypeId} onChange={e => setAssetsRoleObjectTypeId(e.target.value)} className="rounded-none bg-white" />
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
              <Button variant="outline" onClick={handleTestJira} disabled={isTestingJira} className="rounded-none gap-2 font-bold uppercase text-[10px] border-primary/20 text-primary hover:bg-primary/5">
                {isTestingJira ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} 
                Verbindung testen
              </Button>
              <Button onClick={handleSaveJira} disabled={isSavingJira} className="rounded-none gap-2 font-bold uppercase text-[10px]">
                {isSavingJira ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
                Integration Speichern
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Card className="rounded-none shadow-none border">
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle className="text-xs font-bold uppercase">Datenquellen-Konfiguration</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <RadioGroup value={dataSource} onValueChange={(value) => setDataSource(value as any)}>
                <Label className="flex items-center gap-4 p-4 rounded-none border has-[:checked]:bg-primary/5 has-[:checked]:border-primary transition-all cursor-pointer">
                  <RadioGroupItem value="firestore" id="firestore" />
                  <Database className="w-6 h-6 text-primary"/>
                  <div>
                    <p className="font-bold text-sm">Google Firestore</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Echtzeit Cloud-Datenbank (NoSQL).</p>
                  </div>
                </Label>
                <Label className="flex items-center gap-4 p-4 rounded-none border has-[:checked]:bg-primary/5 has-[:checked]:border-primary transition-all cursor-pointer mt-2">
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
