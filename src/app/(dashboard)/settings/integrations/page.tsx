"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  RefreshCw, 
  Loader2, 
  Ticket, 
  Layers, 
  ShieldCheck, 
  Save,
  Globe,
  Settings2,
  ExternalLink,
  ChevronRight,
  Database
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { 
  testJiraConnectionAction, 
  getJiraProjectsAction,
  getJiraProjectMetadataAction,
  getJiraWorkspacesAction,
  getJiraSchemasAction,
  getJiraObjectTypesAction
} from '@/app/actions/jira-actions';
import { JiraConfig } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function JiraGatewaySettingsPage() {
  const { dataSource } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [isJiraFetching, setIsJiraFetching] = useState(false);
  
  const [jiraDraft, setJiraDraft] = useState<Partial<JiraConfig>>({});
  
  const [jiraProjects, setJiraProjects] = useState<any[]>([]);
  const [jiraIssueTypes, setJiraIssueTypes] = useState<any[]>([]);
  const [jiraStatuses, setJiraStatuses] = useState<any[]>([]);
  const [jiraWorkspaces, setJiraWorkspaces] = useState<any[]>([]);
  const [jiraSchemas, setJiraSchemas] = useState<any[]>([]);
  const [jiraObjectTypes, setJiraObjectTypes] = useState<any[]>([]);

  const { data: configs, refresh } = usePluggableCollection<JiraConfig>('jiraConfigs');

  useEffect(() => {
    if (configs && configs.length > 0) setJiraDraft(configs[0]);
    else setJiraDraft({ id: 'jira-default', enabled: false });
  }, [configs]);

  const handleFetchJiraOptions = async () => {
    if (!jiraDraft.url || !jiraDraft.apiToken) {
      toast({ variant: "destructive", title: "Fehlende Daten", description: "URL und Token erforderlich." });
      return;
    }
    setIsJiraFetching(true);
    try {
      const [pRes, wRes] = await Promise.all([
        getJiraProjectsAction(jiraDraft),
        getJiraWorkspacesAction(jiraDraft)
      ]);
      if (pRes.success) setJiraProjects(pRes.projects || []);
      if (wRes.success) setJiraWorkspaces(wRes.workspaces || []);
      toast({ title: "Jira Optionen geladen" });
    } finally {
      setIsJiraFetching(false);
    }
  };

  useEffect(() => {
    if (jiraDraft.projectKey && jiraDraft.url && jiraDraft.apiToken) {
      getJiraProjectMetadataAction(jiraDraft, jiraDraft.projectKey).then(meta => {
        if (meta.success) {
          const uniqueIssueTypes = Array.from(new Map((meta.issueTypes || []).map((it: any) => [it.id || it.name, it])).values());
          const uniqueStatuses = Array.from(new Map((meta.statuses || []).map((s: any) => [s.id || s.name, s])).values());
          setJiraIssueTypes(uniqueIssueTypes);
          setJiraStatuses(uniqueStatuses);
        }
      });
    }
  }, [jiraDraft.projectKey, jiraDraft.url, jiraDraft.apiToken]);

  useEffect(() => {
    if (jiraDraft.workspaceId && jiraDraft.url && jiraDraft.apiToken) {
      getJiraSchemasAction(jiraDraft, jiraDraft.workspaceId).then(res => {
        if (res.success) setJiraSchemas(res.schemas || []);
      });
    }
  }, [jiraDraft.workspaceId, jiraDraft.url, jiraDraft.apiToken]);

  useEffect(() => {
    if (jiraDraft.workspaceId && jiraDraft.schemaId && jiraDraft.url && jiraDraft.apiToken) {
      getJiraObjectTypesAction(jiraDraft, jiraDraft.workspaceId, jiraDraft.schemaId).then(res => {
        if (res.success) setJiraObjectTypes(res.objectTypes || []);
      });
    }
  }, [jiraDraft.schemaId, jiraDraft.workspaceId, jiraDraft.url, jiraDraft.apiToken]);

  const handleSave = async () => {
    if (!jiraDraft.id) return;
    setIsSaving(true);
    try {
      const res = await saveCollectionRecord('jiraConfigs', jiraDraft.id, jiraDraft, dataSource);
      if (res.success) {
        toast({ title: "Konfiguration gespeichert" });
        refresh();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="rounded-[2.5rem] border-none shadow-2xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 overflow-hidden">
      <CardHeader className="p-10 bg-slate-900 text-white shrink-0">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-xl">
              <RefreshCw className="w-8 h-8" />
            </div>
            <div>
              <CardTitle className="text-2xl font-headline font-bold uppercase tracking-tight">Jira Gateway (API v3)</CardTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5">Anbindung an Atlassian Jira Service Management</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Badge variant={jiraDraft.enabled ? 'default' : 'outline'} className={cn(
              "rounded-full text-[10px] font-black uppercase px-4 h-7 border-white/20",
              jiraDraft.enabled ? "bg-emerald-600 text-white" : "bg-transparent text-slate-400"
            )}>
              {jiraDraft.enabled ? 'Aktiv' : 'Inaktiv'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-10 space-y-12">
        {/* Core Credentials */}
        <div className="space-y-8">
          <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <Label className="text-base font-black text-slate-800 dark:text-slate-100 uppercase">Jira Gateway aktivieren</Label>
              <p className="text-[10px] uppercase font-bold text-slate-400 italic">Erlaubt automatische Ticketerstellung und Asset-Sync.</p>
            </div>
            <Switch checked={!!jiraDraft.enabled} onCheckedChange={v => setJiraDraft({...jiraDraft, enabled: v})} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Jira Cloud URL</Label>
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <Input value={jiraDraft.url || ''} onChange={e => setJiraDraft({...jiraDraft, url: e.target.value})} placeholder="https://firma.atlassian.net" className="rounded-2xl h-14 pl-11 border-slate-200" />
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Reporter E-Mail</Label>
              <Input value={jiraDraft.email || ''} onChange={e => setJiraDraft({...jiraDraft, email: e.target.value})} placeholder="admin@firma.de" className="rounded-2xl h-14 border-slate-200" />
            </div>
            <div className="space-y-3 md:col-span-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">API Token (Atlassian Account)</Label>
              <Input type="password" value={jiraDraft.apiToken || ''} onChange={e => setJiraDraft({...jiraDraft, apiToken: e.target.value})} className="rounded-2xl h-14 border-slate-200 font-mono" />
            </div>
          </div>
        </div>

        <Separator className="bg-slate-50 dark:bg-slate-800" />

        {/* Workflow Mapping */}
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white flex items-center gap-3 tracking-widest">
              <Ticket className="w-5 h-5 text-primary" /> 1. Workflow & Tickets
            </h3>
            <Button variant="outline" size="sm" onClick={handleFetchJiraOptions} disabled={isJiraFetching} className="h-10 rounded-xl text-[10px] font-black uppercase gap-2 px-6 border-slate-200">
              {isJiraFetching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4" />} 
              Optionen laden
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Projekt</Label>
              <Select value={jiraDraft.projectKey || ''} onValueChange={v => setJiraDraft({...jiraDraft, projectKey: v})}>
                <SelectTrigger className="rounded-xl h-12 border-slate-200"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {jiraProjects.map(p => <SelectItem key={p.key || p.id} value={p.key}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Vorgangstyp</Label>
              <Select value={jiraDraft.issueTypeName || ''} onValueChange={v => setJiraDraft({...jiraDraft, issueTypeName: v})}>
                <SelectTrigger className="rounded-xl h-12 border-slate-200"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {jiraIssueTypes.map(it => <SelectItem key={it.id || it.name} value={it.name}>{it.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-emerald-600 ml-1">Zustand: Genehmigt</Label>
              <Select value={jiraDraft.approvedStatusName || ''} onValueChange={v => setJiraDraft({...jiraDraft, approvedStatusName: v})}>
                <SelectTrigger className="rounded-xl h-12 border-emerald-100 bg-emerald-50/20"><SelectValue placeholder="Status..." /></SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {jiraStatuses.map(s => <SelectItem key={`app-${s.id || s.name}`} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-blue-600 ml-1">Zustand: Erledigt</Label>
              <Select value={jiraDraft.doneStatusName || ''} onValueChange={v => setJiraDraft({...jiraDraft, doneStatusName: v})}>
                <SelectTrigger className="rounded-xl h-12 border-blue-100 bg-blue-50/20"><SelectValue placeholder="Status..." /></SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {jiraStatuses.map(s => <SelectItem key={`done-${s.id || s.name}`} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator className="bg-slate-50 dark:bg-slate-800" />

        {/* Assets Discovery */}
        <div className="space-y-8">
          <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white flex items-center gap-3 tracking-widest">
            <Layers className="w-5 h-5 text-indigo-600" /> 2. JSM Assets Discovery
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Workspace</Label>
              <Select value={jiraDraft.workspaceId || ''} onValueChange={v => setJiraDraft({...jiraDraft, workspaceId: v, schemaId: '', objectTypeId: '', entitlementObjectTypeId: ''})}>
                <SelectTrigger className="rounded-xl h-12 border-slate-200"><SelectValue placeholder="Workspace..." /></SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {jiraWorkspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Schema</Label>
              <Select value={jiraDraft.schemaId || ''} onValueChange={v => setJiraDraft({...jiraDraft, schemaId: v, objectTypeId: '', entitlementObjectTypeId: ''})}>
                <SelectTrigger className="rounded-xl h-12 border-slate-200" disabled={!jiraDraft.workspaceId}><SelectValue placeholder="Schema..." /></SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {jiraSchemas.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Typ: IT-Systeme</Label>
              <Select value={jiraDraft.objectTypeId || ''} onValueChange={v => setJiraDraft({...jiraDraft, objectTypeId: v})}>
                <SelectTrigger className="rounded-xl h-12 border-slate-200" disabled={!jiraDraft.schemaId}><SelectValue placeholder="Asset Typ..." /></SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {jiraObjectTypes.map(ot => <SelectItem key={ot.id} value={ot.id}>{ot.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Typ: Rollen</Label>
              <Select value={jiraDraft.entitlementObjectTypeId || ''} onValueChange={v => setJiraDraft({...jiraDraft, entitlementObjectTypeId: v})}>
                <SelectTrigger className="rounded-xl h-12 border-slate-200" disabled={!jiraDraft.schemaId}><SelectValue placeholder="Rollen Typ..." /></SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {jiraObjectTypes.map(ot => <SelectItem key={`role-${ot.id}`} value={ot.id}>{ot.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center pt-10 border-t border-slate-100 dark:border-slate-800 gap-6">
          <Button 
            variant="outline" 
            onClick={() => testJiraConnectionAction(jiraDraft).then(res => toast({ title: "Jira-Test", description: res.message }))} 
            className="rounded-2xl h-14 px-10 font-black uppercase text-[10px] tracking-widest border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
          >
            Verbindung Testen
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving} 
            className="w-full sm:w-auto rounded-2xl h-14 px-16 font-black uppercase text-xs tracking-[0.2em] bg-slate-900 hover:bg-black text-white shadow-2xl transition-all active:scale-95 gap-3"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Konfiguration Speichern
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
