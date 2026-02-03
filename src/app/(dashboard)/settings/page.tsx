
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Users, 
  Shield, 
  Mail, 
  Plus, 
  Save, 
  Trash2,
  Lock,
  Globe,
  Bell,
  Database,
  ExternalLink,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { useSettings } from '@/context/settings-context';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { getJiraConfigs } from '@/app/actions/jira-actions';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';

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
  const [jiraApprovedStatus, setJiraApprovedStatus] = useState('Done');
  const [jiraEnabled, setJiraEnabled] = useState(false);
  const [isSavingJira, setIsSavingJira] = useState(false);

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
        setJiraApprovedStatus(c.approvedStatusName || 'Done');
        setJiraEnabled(c.enabled || false);
      }
    };
    loadJira();
  }, []);

  const handleSaveGeneral = () => {
    toast({ title: "Einstellungen gespeichert", description: "Allgemeine Daten wurden aktualisiert." });
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
      enabled: jiraEnabled
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
          <Card className="rounded-none shadow-none border">
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
                  <Label className="text-[10px] font-bold uppercase">Jira Cloud URL</Label>
                  <Input placeholder="https://company.atlassian.net" value={jiraUrl} onChange={e => setJiraUrl(e.target.value)} className="rounded-none" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Projekt Key</Label>
                  <Input placeholder="ITSM" value={jiraProject} onChange={e => setJiraProject(e.target.value)} className="rounded-none" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Vorgangstyp (Issue Type)</Label>
                  <Input placeholder="Service Request" value={jiraIssueType} onChange={e => setJiraIssueType(e.target.value)} className="rounded-none" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Status für "Genehmigt" (approved)</Label>
                  <Input placeholder="Done" value={jiraApprovedStatus} onChange={e => setJiraApprovedStatus(e.target.value)} className="rounded-none" />
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

              <div className="p-4 border bg-slate-50 text-[10px] font-bold uppercase leading-relaxed text-slate-600">
                Hinweis: Der API-Token kann unter <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" className="text-primary underline">Atlassian Security</a> erstellt werden. Erforderliche Berechtigungen: "Issue Create" und "Issue Search".
              </div>
            </CardContent>
            <CardFooter className="border-t p-4 flex justify-end">
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
    </div>
  );
}
