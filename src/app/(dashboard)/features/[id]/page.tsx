
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ListFilter, 
  ChevronLeft, 
  Loader2, 
  Tag, 
  Activity, 
  Building2, 
  Layers, 
  Workflow, 
  AlertTriangle, 
  CheckCircle2, 
  Network, 
  Clock, 
  Zap, 
  Info, 
  ArrowRight,
  ShieldCheck,
  Search,
  ExternalLink,
  Plus,
  Trash2,
  Settings2,
  FileText
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { Feature, FeatureLink, FeatureDependency, Process, Resource, Risk, Department, JobTitle } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { linkFeatureAction, unlinkFeatureAction, addFeatureDependencyAction } from '@/app/actions/feature-actions';

export default function FeatureDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const { data: features, isLoading: isFeatLoading } = usePluggableCollection<Feature>('features');
  const { data: links, refresh: refreshLinks } = usePluggableCollection<FeatureLink>('feature_links');
  const { data: dependencies, refresh: refreshDeps } = usePluggableCollection<FeatureDependency>('feature_dependencies');
  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: risks } = usePluggableCollection<Risk>('risks');
  const { data: departments } = usePluggableCollection<Department>('departments');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');

  useEffect(() => { setMounted(true); }, []);

  const feature = useMemo(() => features?.find(f => f.id === id), [features, id]);
  
  const relatedLinks = useMemo(() => links?.filter(l => l.featureId === id) || [], [links, id]);
  const relatedDeps = useMemo(() => dependencies?.filter(d => d.featureId === id || d.dependentFeatureId === id) || [], [dependencies, id]);

  const originProcesses = useMemo(() => relatedLinks.filter(l => l.targetType === 'process_origin').map(l => processes?.find(p => p.id === l.targetId)).filter(Boolean), [relatedLinks, processes]);
  const usageProcesses = useMemo(() => relatedLinks.filter(l => l.targetType === 'process_usage').map(l => processes?.find(p => p.id === l.targetId)).filter(Boolean), [relatedLinks, processes]);
  const relatedResources = useMemo(() => relatedLinks.filter(l => l.targetType.startsWith('resource')).map(l => resources?.find(r => r.id === l.targetId)).filter(Boolean), [relatedLinks, resources]);
  const linkedRisks = useMemo(() => relatedLinks.filter(l => l.targetType === 'risk').map(l => risks?.find(r => r.id === l.targetId)).filter(Boolean), [relatedLinks, risks]);

  if (!mounted) return null;

  if (isFeatLoading) {
    return <div className="h-full flex flex-col items-center justify-center py-40 gap-4"><Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" /><p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Lade Governance-Daten...</p></div>;
  }

  if (!feature) {
    return <div className="p-20 text-center space-y-4"><AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" /><h2 className="text-xl font-headline font-bold">Merkmal nicht gefunden</h2><Button onClick={() => router.push('/features')}>Zurück zur Übersicht</Button></div>;
  }

  const dept = departments?.find(d => d.id === feature.deptId);
  const owner = jobTitles?.find(j => j.id === feature.ownerId);

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/features')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">{feature.name}</h1>
              <Badge className={cn(
                "rounded-full px-2 h-5 text-[9px] font-black uppercase tracking-widest border-none",
                feature.status === 'active' ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
              )}>{feature.status}</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Code: {feature.code} • Träger: {feature.carrier}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs">
            <Activity className="w-3.5 h-3.5 mr-2" /> Analyse
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6">
            <Zap className="w-3.5 h-3.5 mr-2" /> KI Audit
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 space-y-4">
          <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b p-4 px-6">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verantwortung</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Zuständige Abteilung</p>
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Building2 className="w-4 h-4 text-primary" /> {dept?.name || '---'}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Fachlicher Owner</p>
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> {owner?.name || '---'}
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Kritikalität</p>
                <div className={cn(
                  "p-3 rounded-xl border flex items-center justify-between",
                  feature.criticality === 'high' ? "bg-red-50 border-red-100 text-red-700" : "bg-slate-50 border-slate-100 text-slate-700"
                )}>
                  <span className="text-[10px] font-black uppercase">{feature.criticality}</span>
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
            </CardContent>
          </Card>

          {feature.isComplianceRelevant && (
            <Card className="rounded-2xl border-none bg-emerald-600 text-white shadow-lg">
              <CardContent className="p-5 space-y-3 text-center">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mx-auto"><ShieldCheck className="w-5 h-5" /></div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-80">Compliance Status</p>
                  <p className="text-base font-headline font-bold">RELEVANT</p>
                </div>
                <p className="text-[9px] italic opacity-70">Dieses Merkmal unterliegt speziellen regulatorischen Kontrollen.</p>
              </CardContent>
            </Card>
          )}
        </aside>

        <div className="lg:col-span-3">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-slate-100 p-1 h-11 rounded-xl border w-full justify-start gap-1">
              <TabsTrigger value="overview" className="rounded-lg px-6 gap-2 text-[11px] font-bold"><Info className="w-3.5 h-3.5" /> Überblick</TabsTrigger>
              <TabsTrigger value="network" className="rounded-lg px-6 gap-2 text-[11px] font-bold"><Network className="w-3.5 h-3.5" /> Vernetzung</TabsTrigger>
              <TabsTrigger value="impact" className="rounded-lg px-6 gap-2 text-[11px] font-bold text-primary"><Zap className="w-3.5 h-3.5" /> Impact-Analyse</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary" />
                    <CardTitle className="text-sm font-bold">Inhaltliche Definition</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                  <div className="space-y-3">
                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Beschreibung</Label>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium bg-slate-50 p-4 rounded-xl border border-slate-100">{feature.description || 'Keine fachliche Beschreibung hinterlegt.'}</p>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Geschäftlicher Zweck</Label>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">{feature.purpose || 'Der geschäftliche Zweck wurde noch nicht explizit dokumentiert.'}</p>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <Label className="text-[9px] font-black uppercase text-primary tracking-widest">Pflegehinweise & Datenqualität</Label>
                      <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                        <p className="text-xs text-slate-600 leading-relaxed italic">{feature.maintenanceNotes || 'Keine spezifischen Pflegehinweise vorhanden.'}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Gültigkeit & Historie</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-50 rounded-lg border text-center">
                          <p className="text-[8px] font-bold text-slate-400 uppercase">Gültig ab</p>
                          <p className="text-xs font-bold">{feature.validFrom || 'Sofort'}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg border text-center">
                          <p className="text-[8px] font-bold text-slate-400 uppercase">Revision</p>
                          <p className="text-xs font-bold">{new Date(feature.updatedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="network" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-slate-50/50 border-b p-4">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-emerald-600" /> Herkunft (Quellen)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {originProcesses.map(p => (
                      <div key={p?.id} className="flex items-center justify-between p-3 bg-white border rounded-xl hover:border-primary transition-all group cursor-pointer" onClick={() => router.push(`/processhub/view/${p?.id}`)}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600"><Workflow className="w-4 h-4" /></div>
                          <span className="text-xs font-bold">{p?.title}</span>
                        </div>
                        <Badge variant="outline" className="text-[8px] font-bold h-4">Prozess</Badge>
                      </div>
                    ))}
                    {originProcesses.length === 0 && <p className="text-[10px] text-slate-400 italic text-center py-6">Keine Quellen-Prozesse verknüpft</p>}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-slate-50/50 border-b p-4">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" /> Nutzung (Senken)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {usageProcesses.map(p => (
                      <div key={p?.id} className="flex items-center justify-between p-3 bg-white border rounded-xl hover:border-primary transition-all group cursor-pointer" onClick={() => router.push(`/processhub/view/${p?.id}`)}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary"><Workflow className="w-4 h-4" /></div>
                          <span className="text-xs font-bold">{p?.title}</span>
                        </div>
                        <Badge variant="outline" className="text-[8px] font-bold h-4">Prozess</Badge>
                      </div>
                    ))}
                    {usageProcesses.length === 0 && <p className="text-[10px] text-slate-400 italic text-center py-6">Keine Nutzungs-Prozesse verknüpft</p>}
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-4">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" /> System-Integration
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {relatedResources.map(r => (
                      <div key={r?.id} className="p-4 border rounded-2xl flex items-center gap-4 bg-slate-50/50 hover:bg-white transition-all shadow-sm group cursor-pointer" onClick={() => router.push(`/resources?search=${r?.name}`)}>
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 border shadow-sm group-hover:scale-110 transition-transform"><Layers className="w-5 h-5" /></div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{r?.name}</p>
                          <p className="text-[9px] font-black uppercase text-slate-400 mt-0.5">{r?.assetType}</p>
                        </div>
                      </div>
                    ))}
                    {relatedResources.length === 0 && <div className="col-span-full py-10 text-center border border-dashed rounded-2xl text-[10px] font-bold text-slate-400 uppercase">Keine IT-Systeme gemappt</div>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="impact" className="space-y-6">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-900 text-white p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg"><Zap className="w-5 h-5" /></div>
                      <div>
                        <CardTitle className="text-base font-headline font-bold">Impact Analysis</CardTitle>
                        <p className="text-[10px] text-primary font-bold uppercase tracking-widest">Auswirkungsanalyse bei Änderungen</p>
                      </div>
                    </div>
                    <Badge className="bg-white/10 text-white border-none rounded-full px-3 h-6 text-[10px] font-black">ACTIVE SIMULATION</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-10">
                  <div className="p-6 bg-red-50 border border-red-100 rounded-2xl space-y-4">
                    <h4 className="text-xs font-black uppercase text-red-700 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Risikopotenzial
                    </h4>
                    <div className="space-y-3">
                      {linkedRisks.map(r => (
                        <div key={r?.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-red-100 shadow-sm">
                          <div className="flex items-center gap-3">
                            <Badge className="bg-red-600 text-white border-none rounded-md text-[9px] font-black h-5 px-2">{r?.impact * r?.probability}</Badge>
                            <span className="text-xs font-bold text-slate-800">{r?.title}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => router.push(`/risks?search=${r?.title}`)}><ExternalLink className="w-3.5 h-3.5" /></Button>
                        </div>
                      ))}
                      {linkedRisks.length === 0 && <p className="text-[11px] text-slate-500 italic">Keine direkt verknüpften Risiken. Die Datenqualität ist jedoch kritisch für {usageProcesses.length} Folgeprozesse.</p>}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest border-b pb-2">Merkmal-Abhängigkeiten</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {relatedDeps.map(d => {
                        const isMain = d.featureId === id;
                        const otherId = isMain ? d.dependentFeatureId : d.featureId;
                        const otherFeat = features?.find(f => f.id === otherId);
                        return (
                          <div key={d.id} className="p-4 border rounded-2xl bg-white shadow-sm flex items-start gap-4 group hover:border-primary transition-all">
                            <div className={cn(
                              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-inner",
                              isMain ? "bg-blue-50 text-blue-600" : "bg-indigo-50 text-indigo-600"
                            )}>
                              {isMain ? <ArrowRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-black uppercase text-slate-400">{d.type}</p>
                              <p className="text-sm font-bold text-slate-800 truncate">{otherFeat?.name || 'Unbekannt'}</p>
                              <p className="text-[10px] text-slate-500 italic mt-1 line-clamp-2">{d.description}</p>
                            </div>
                          </div>
                        );
                      })}
                      <Button variant="outline" className="h-auto py-6 border-dashed rounded-2xl flex flex-col gap-2 text-slate-400 hover:text-primary hover:border-primary transition-all">
                        <Plus className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Abhängigkeit hinzufügen</span>
                      </Button>
                    </div>
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
