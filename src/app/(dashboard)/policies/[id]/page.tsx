
"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  Loader2, 
  ScrollText, 
  History, 
  Save, 
  CheckCircle2, 
  Clock, 
  Activity, 
  FileText, 
  UserCircle,
  ShieldCheck,
  ChevronRight,
  Plus,
  ArrowRight,
  MessageSquare,
  Zap,
  Info,
  Building2,
  Lock,
  ExternalLink,
  Eye,
  FileEdit,
  Globe,
  Tag,
  Paperclip,
  ImageIcon,
  FileUp,
  Trash2,
  AlertTriangle,
  BadgeCheck,
  Check
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { usePlatformAuth } from '@/context/auth-context';
import { Policy, PolicyVersion, JobTitle, MediaFile } from '@/lib/types';
import { commitPolicyVersionAction } from '@/app/actions/policy-actions';
import { saveMediaAction, deleteMediaAction } from '@/app/actions/media-actions';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export default function PolicyDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = usePlatformAuth();
  const { dataSource, activeTenantId } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mounted, setMounted] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [changelog, setChangelog] = useState('');

  const { data: policies, isLoading: isPolLoading, refresh: refreshPolicies } = usePluggableCollection<Policy>('policies');
  const { data: versions, refresh: refreshVersions } = usePluggableCollection<PolicyVersion>('policy_versions');
  const { data: mediaFiles, refresh: refreshMedia } = usePluggableCollection<MediaFile>('media');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');

  const policy = useMemo(() => policies?.find(p => p.id === id), [policies, id]);
  const policyVersions = useMemo(() => 
    versions?.filter(v => v.policyId === id)
      .sort((a, b) => b.version - a.version || b.revision - a.revision) || [], 
    [versions, id]
  );
  const activeVersion = policyVersions[0];
  const policyAttachments = mediaFiles?.filter(m => m.entityId === id && m.module === 'PolicyHub') || [];

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (activeVersion && !editMode) {
      setDraftContent(activeVersion.content);
    }
  }, [activeVersion, editMode]);

  const handleSaveVersion = async (isMajor: boolean = false) => {
    if (!id || !draftContent) {
      toast({ variant: "destructive", title: "Inhalt leer", description: "Bitte geben Sie einen Text ein." });
      return;
    }
    setIsSaving(true);
    try {
      const res = await commitPolicyVersionAction(
        id as string, 
        activeVersion?.version || 1, 
        draftContent, 
        changelog || (isMajor ? "Neue Hauptversion / Freigabe" : "Revision"), 
        user?.email || 'system', 
        dataSource, 
        isMajor
      );
      if (res.success) {
        toast({ title: isMajor ? "Version veröffentlicht" : "Revision gespeichert" });
        setEditMode(false);
        setChangelog('');
        refreshVersions();
        refreshPolicies();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const mediaId = `med-pol-${Math.random().toString(36).substring(2, 9)}`;
      const mediaData: MediaFile = {
        id: mediaId,
        tenantId: policy?.tenantId || activeTenantId || 'global',
        module: 'PolicyHub',
        entityId: id as string,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl: base64,
        createdAt: new Date().toISOString(),
        createdBy: user?.email || 'system'
      };
      try {
        const res = await saveMediaAction(mediaData, dataSource);
        if (res.success) {
          toast({ title: "Anhang hinzugefügt" });
          refreshMedia();
        }
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const copyMediaUrlToClipboard = (url: string) => {
    navigator.clipboard.writeText(`![Beschreibung](${url})`);
    toast({ title: "Markdown-Code kopiert", description: "Sie können das Bild nun im Editor einfügen." });
  };

  if (!mounted) return null;
  if (isPolLoading) return <div className="h-full flex flex-col items-center justify-center py-40 gap-4"><Loader2 className="w-12 h-12 animate-spin text-emerald-600 opacity-20" /><p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Lade Dokumenten-Container...</p></div>;
  if (!policy) return null;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/policies')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">{policy.title}</h1>
              <Badge className={cn(
                "rounded-full px-3 h-6 text-[10px] font-black uppercase border-none shadow-sm",
                policy.status === 'published' ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
              )}>{policy.status}</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
              <ScrollText className="w-3 h-3" /> Revisionssicheres Modul • V{policy.currentVersion}.{activeVersion?.revision || 0}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!editMode ? (
            <Button size="sm" className="h-10 rounded-xl font-bold text-xs px-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg active:scale-95 transition-all" onClick={() => setEditMode(true)}>
              <FileEdit className="w-4 h-4 mr-2" /> Editor öffnen
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-10 rounded-xl font-bold text-xs px-6" onClick={() => setEditMode(false)}>Verwerfen</Button>
              <Button size="sm" className="h-10 rounded-xl font-bold text-xs px-8 bg-emerald-600 text-white shadow-lg" onClick={() => handleSaveVersion(false)} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Revision sichern
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 space-y-6">
          <Card className="rounded-2xl border shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b p-4 px-6">
              <CardTitle className="text-[11px] font-black uppercase tracking-widest text-slate-400">Verwaltung & Lifecycle</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-inner flex flex-col items-center text-center">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Versionsstand</span>
                <p className={cn("text-4xl font-black uppercase", policy.status === 'published' ? "text-emerald-600" : "text-blue-600")}>V{policy.currentVersion}.0</p>
                <Badge variant="outline" className="mt-2 bg-white text-[8px] font-black uppercase tracking-tighter">Status: {policy.status}</Badge>
              </div>
              
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Ownership (Rolle)</Label>
                  <div className="flex items-center gap-2 p-2.5 bg-white border rounded-xl shadow-sm">
                    <Briefcase className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-slate-800">{jobTitles?.find(j => j.id === policy.ownerRoleId)?.name || 'Nicht zugewiesen'}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Review-Zyklus</Label>
                  <div className="flex items-center gap-2 p-2.5 bg-white border rounded-xl shadow-sm text-orange-600">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-bold">Alle {policy.reviewInterval} Tage</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-4 px-6 flex flex-row items-center justify-between">
              <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                <Paperclip className="w-3.5 h-3.5" /> Anhänge ({policyAttachments.length})
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => fileInputRef.current?.click()}>
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              </Button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                {policyAttachments.map(file => (
                  <div key={file.id} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:border-primary/20 transition-all">
                    <div className="min-w-0 flex items-center gap-2">
                      {file.fileType.includes('image') ? <ImageIcon className="w-3.5 h-3.5 text-indigo-400" /> : <FileText className="w-3.5 h-3.5 text-slate-400" />}
                      <span className="text-[10px] font-bold truncate max-w-[120px]">{file.fileName}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      {file.fileType.includes('image') && editMode && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-indigo-600" onClick={() => copyMediaUrlToClipboard(file.fileUrl)}>
                                <Zap className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="text-[9px] font-black uppercase bg-slate-900 text-white border-none">Markdown-Link kopieren</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => { if(confirm("Anhang permanent löschen?")) deleteMediaAction(file.id, file.tenantId, user?.email || 'admin', dataSource).then(() => refreshMedia()); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {policyAttachments.length === 0 && <p className="py-6 text-center text-[10px] text-slate-300 italic">Keine Komponenten / Anhänge hinterlegt.</p>}
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="lg:col-span-3">
          <Tabs defaultValue="content" className="space-y-6">
            <TabsList className="bg-slate-100 p-1.5 h-14 rounded-2xl border w-full justify-start gap-2 shadow-inner">
              <TabsTrigger value="content" className="rounded-xl px-6 gap-3 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg">
                <FileText className="w-4 h-4" /> Dokumentinhalt
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-xl px-6 gap-3 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg">
                <History className="w-4 h-4" /> Historie & Audit
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="animate-in fade-in duration-500">
              {editMode ? (
                <div className="space-y-6">
                  <Card className="rounded-2xl border shadow-xl overflow-hidden">
                    <CardHeader className="bg-slate-900 text-white p-4 px-6 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileEdit className="w-5 h-5 text-primary" />
                        <CardTitle className="text-sm font-bold uppercase tracking-widest">Inhalt bearbeiten (Markdown)</CardTitle>
                      </div>
                      <Badge className="bg-white/10 text-white border-none rounded-full h-5 text-[8px] font-black uppercase">Live Entwurf</Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Textarea 
                        value={draftContent} 
                        onChange={e => setDraftContent(e.target.value)} 
                        className="min-h-[500px] rounded-none border-none p-8 font-mono text-sm leading-relaxed focus:ring-0 bg-slate-50/30"
                        placeholder="# Überschrift\n\nBeschreiben Sie hier die Richtlinie oder das Konzept..."
                      />
                    </CardContent>
                    <div className="p-6 border-t bg-slate-50 space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Änderungshistorie / Revisionsgrund</Label>
                        <Input value={changelog} onChange={e => setChangelog(e.target.value)} placeholder="Kurze Beschreibung für das Audit Log..." className="h-11 rounded-xl bg-white" />
                      </div>
                      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                        <Button variant="outline" className="rounded-xl h-11 px-8 font-black text-[10px] uppercase tracking-widest border-emerald-200 text-emerald-700" onClick={() => handleSaveVersion(true)} disabled={isSaving}>
                          <BadgeCheck className="w-4 h-4 mr-2" /> Freigabe erteilen (Major Release V{policy.currentVersion + 1}.0)
                        </Button>
                        <Button className="rounded-xl h-11 px-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest shadow-lg gap-2" onClick={() => handleSaveVersion(false)} disabled={isSaving}>
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Revision sichern
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              ) : (
                <Card className="rounded-2xl border shadow-xl bg-white overflow-hidden min-h-[600px]">
                  <CardContent className="p-10 md:p-16">
                    <div className="max-w-3xl mx-auto">
                      {activeVersion ? (
                        <div className="space-y-8">
                          <div className="border-b-4 border-emerald-500 pb-6 mb-10">
                            <h1 className="text-4xl font-headline font-black text-slate-900 mb-2">{policy.title}</h1>
                            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                              <span>V{activeVersion.version}.{activeVersion.revision}</span>
                              <span className="w-1 h-1 rounded-full bg-slate-200" />
                              <span>Stand: {new Date(activeVersion.createdAt).toLocaleDateString()}</span>
                              <span className="w-1 h-1 rounded-full bg-slate-200" />
                              <span>Status: {policy.status}</span>
                            </div>
                          </div>
                          
                          <div className="prose prose-slate max-w-none prose-headings:font-headline prose-headings:font-black prose-p:leading-relaxed prose-p:text-slate-700">
                            {activeVersion.content.split('\n').map((line, i) => (
                              <p key={i} className="mb-4">{line || '\u00A0'}</p>
                            ))}
                          </div>

                          <div className="mt-20 pt-8 border-t border-dashed border-slate-200 flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="text-[10px] font-black uppercase text-slate-400">Verantwortlicher Eigner</p>
                              <p className="text-xs font-bold text-slate-800">{jobTitles?.find(j => j.id === policy.ownerRoleId)?.name || '---'}</p>
                            </div>
                            <div className="text-right space-y-1">
                              <p className="text-[10px] font-black uppercase text-slate-400">Gültigkeit</p>
                              <p className="text-xs font-bold text-emerald-600">Revisionssicher archiviert</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-24 text-center space-y-6 opacity-30">
                          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto border-2 border-dashed border-slate-200">
                            <ScrollText className="w-10 h-10 text-slate-300" />
                          </div>
                          <div>
                            <p className="text-lg font-headline font-bold text-slate-900 uppercase">Kein Dokument-Inhalt</p>
                            <p className="text-sm text-slate-500 font-medium mt-1">Starten Sie den Editor, um den Inhalt zu erfassen.</p>
                          </div>
                          <Button variant="outline" size="sm" className="rounded-xl h-10 px-8" onClick={() => setEditMode(true)}>Editor öffnen</Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="history" className="animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-xl bg-white overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-headline font-bold uppercase tracking-tight">Audit Trail & Versionen</CardTitle>
                  <Badge className="bg-indigo-50 text-indigo-700 border-none rounded-full text-[9px] font-black uppercase px-3 h-5">Revisionssicher</Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    {policyVersions.map(v => (
                      <div key={v.id} className="p-6 hover:bg-slate-50 transition-all flex items-start justify-between group">
                        <div className="flex items-start gap-5">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner transition-transform group-hover:scale-110",
                            v.revision === 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100"
                          )}>
                            {v.revision === 0 ? <BadgeCheck className="w-6 h-6" /> : <History className="w-6 h-6" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                              <h4 className="font-black text-slate-900 text-sm">Version {v.version}.{v.revision}</h4>
                              {v.revision === 0 && <Badge className="bg-emerald-500 text-white border-none rounded-full text-[8px] h-4 px-2 font-black uppercase shadow-sm">Freigegebenes Release</Badge>}
                            </div>
                            <p className="text-[11px] font-medium text-slate-600 mt-1.5 leading-relaxed bg-slate-50 p-2 rounded-lg border border-dashed border-slate-200 italic">
                              "{v.changelog || 'Keine Änderungshistorie hinterlegt.'}"
                            </p>
                            <div className="flex items-center gap-4 mt-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                              <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 opacity-50" /> {new Date(v.createdAt).toLocaleString()}</span>
                              <span className="flex items-center gap-1.5"><UserCircle className="w-3 h-3 opacity-50" /> Akteur: {v.createdBy}</span>
                            </div>
                          </div>
                        </div>
                        {!editMode && (
                          <Button variant="ghost" size="sm" className="h-9 rounded-xl font-black text-[9px] uppercase gap-2 opacity-0 group-hover:opacity-100 transition-all hover:bg-white shadow-sm border border-transparent hover:border-slate-100" onClick={() => { setDraftContent(v.content); setEditMode(true); toast({title:"Version geladen", description: "Sie befinden sich nun im Editor."}); }}>
                            <RotateCcw className="w-3.5 h-3.5" /> Wiederherstellen
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
