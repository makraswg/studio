
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
  Send,
  BrainCircuit,
  Cpu,
  Info,
  List,
  Check,
  Play,
  Activity,
  RefreshCw,
  Scale
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
import { testOllamaConnectionAction } from '@/app/actions/ai-actions';
import { triggerSyncJobAction } from '@/app/actions/sync-actions';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { cn } from '@/lib/utils';
import { 
  useFirestore, 
  setDocumentNonBlocking, 
  useUser as useAuthUser
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
import { PlatformUser, Role, SmtpConfig, AiConfig, SyncJob, RiskCategorySetting } from '@/lib/types';

export default function SettingsPage() {
  const db = useFirestore();
  const { dataSource } = useSettings();
  const { user: authUser } = useAuthUser();
  
  const [activeTab, setActiveTab] = useState('general');

  // Load Configs
  const { data: jiraConfigs, refresh: refreshJira } = usePluggableCollection<any>('jiraConfigs');
  const { data: smtpConfigs, refresh: refreshSmtp } = usePluggableCollection<SmtpConfig>('smtpConfigs');
  const { data: aiConfigs, refresh: refreshAi } = usePluggableCollection<AiConfig>('aiConfigs');
  const { data: syncJobs, refresh: refreshJobs, isLoading: isJobsLoading } = usePluggableCollection<SyncJob>('syncJobs');
  const { data: tenants, refresh: refreshTenants } = usePluggableCollection<any>('tenants');
  const { data: servicePartners, refresh: refreshPartners } = usePluggableCollection<any>('servicePartners');
  const { data: platformUsers, refresh: refreshPlatformUsers } = usePluggableCollection<PlatformUser>('platformUsers');
  const { data: riskCategorySettings, refresh: refreshRiskSettings } = usePluggableCollection<RiskCategorySetting>('riskCategorySettings');

  // AI State
  const [aiId, setAiId] = useState('');
  const [aiProvider, setAiProvider] = useState<'gemini' | 'ollama'>('gemini');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3');
  const [geminiModel, setGeminiModel] = useState('gemini-1.5-flash');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [isTestingAi, setIsTestingAi] = useState(false);

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

  // Jira State
  const [jiraConfigId, setJiraConfigId] = useState('');
  const [jiraUrl, setJiraUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [jiraProject, setJiraProject] = useState('');
  const [jiraEnabled, setJiraEnabled] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (aiConfigs && aiConfigs.length > 0) {
      const c = aiConfigs[0];
      setAiId(c.id);
      setAiProvider(c.provider || 'gemini');
      setOllamaUrl(c.ollamaUrl || 'http://localhost:11434');
      setOllamaModel(c.ollamaModel || 'llama3');
      setGeminiModel(c.geminiModel || 'gemini-1.5-flash');
      setAiEnabled(!!c.enabled);
    }
  }, [aiConfigs]);

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

  const handleSaveRiskCategoryCycle = async (category: string, days: number) => {
    const id = category;
    const data: RiskCategorySetting = {
      id,
      tenantId: 'global',
      defaultReviewDays: days
    };
    try {
      await saveCollectionRecord('riskCategorySettings', id, data, dataSource);
      toast({ title: "Zyklus aktualisiert", description: `${category}: ${days} Tage` });
      refreshRiskSettings();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    }
  };

  const handleSaveAi = async () => {
    setIsSaving(true);
    const id = aiId || 'ai-config-default';
    const data = { id, provider: aiProvider, ollamaUrl, ollamaModel, geminiModel, enabled: aiEnabled };
    try {
      await saveCollectionRecord('aiConfigs', id, data, dataSource);
      toast({ title: "KI gespeichert" });
      refreshAi();
    } finally { setIsSaving(false); }
  };

  const handleSaveSmtp = async () => {
    setIsSaving(true);
    const id = smtpId || 'smtp-config-default';
    const data = { id, host: smtpHost, port: smtpPort, user: smtpUser, pass: smtpPass, fromEmail: smtpFromEmail, fromName: smtpFromName, encryption: smtpEncryption, enabled: smtpEnabled };
    try {
      await saveCollectionRecord('smtpConfigs', id, data, dataSource);
      toast({ title: "SMTP gespeichert" });
      refreshSmtp();
    } finally { setIsSaving(false); }
  };

  const categories = ['IT-Sicherheit', 'Datenschutz', 'Rechtlich', 'Betrieblich'];

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Systemeinstellungen</h1>
          <p className="text-muted-foreground mt-1">Plattform-Governance und Automatisierung.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-card border h-12 p-1 gap-1 rounded-none w-full justify-start overflow-x-auto">
          <TabsTrigger value="general" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Settings className="w-3.5 h-3.5" /> Organisation</TabsTrigger>
          <TabsTrigger value="risks" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Scale className="w-3.5 h-3.5" /> Risiko-Konfig</TabsTrigger>
          <TabsTrigger value="smtp" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Mail className="w-3.5 h-3.5" /> E-Mail (SMTP)</TabsTrigger>
          <TabsTrigger value="ai" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><BrainCircuit className="w-3.5 h-3.5" /> KI (Ollama)</TabsTrigger>
          <TabsTrigger value="data" className="rounded-none px-6 gap-2 text-[10px] font-bold uppercase"><Database className="w-3.5 h-3.5" /> Datenquelle</TabsTrigger>
        </TabsList>

        <TabsContent value="risks">
          <Card className="rounded-none border shadow-none">
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest">Risiko-Review Zyklen</CardTitle>
              <CardDescription className="text-[9px] uppercase font-bold">Standardmäßige Zeiträume für regelmäßige Überprüfungen nach Kategorien.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                {categories.map(cat => {
                  const setting = riskCategorySettings?.find(s => s.id === cat);
                  return (
                    <div key={cat} className="flex items-center justify-between p-4 border bg-slate-50/50">
                      <div>
                        <p className="font-bold text-sm">{cat}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Empfohlener Standard-Zyklus</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="relative w-32">
                          <Input 
                            type="number" 
                            defaultValue={setting?.defaultReviewDays || 365} 
                            className="rounded-none h-10 pr-12 font-bold" 
                            onBlur={(e) => handleSaveRiskCategoryCycle(cat, parseInt(e.target.value))}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-muted-foreground">TAGE</span>
                        </div>
                        <Badge variant="outline" className="rounded-none text-[8px] font-bold uppercase bg-white">
                          {setting?.defaultReviewDays ? Math.round(setting.defaultReviewDays / 30) : 12} MONATE
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
            <CardFooter className="bg-blue-50 border-t p-4 text-blue-800 text-[10px] font-bold uppercase flex gap-3 items-start">
              <Info className="w-4 h-4 shrink-0 text-blue-600" />
              Pro Risiko kann dieser Wert individuell überschrieben werden.
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="ai">
          <Card className="rounded-none border shadow-none">
            <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between">
              <div><CardTitle className="text-[10px] font-bold uppercase">KI Provider</CardTitle></div>
              <Switch checked={!!aiEnabled} onCheckedChange={setAiEnabled} />
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Provider</Label>
                <Select value={aiProvider} onValueChange={(v: any) => setAiProvider(v)}>
                  <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                    <SelectItem value="ollama">Ollama (Lokal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {aiProvider === 'ollama' && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">URL</Label><Input value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)} className="rounded-none" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Modell</Label><Input value={ollamaModel} onChange={e => setOllamaModel(e.target.value)} className="rounded-none" /></div>
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-muted/5 border-t py-3 flex justify-end">
              <Button size="sm" className="h-8 rounded-none font-bold uppercase text-[10px]" onClick={handleSaveAi} disabled={isSaving}><Save className="w-3 h-3 mr-2" /> Speichern</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
