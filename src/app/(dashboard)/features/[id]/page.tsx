
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
  FileText,
  ArrowRightCircle,
  ArrowLeftCircle,
  Database,
  Shield
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { Feature, FeatureLink, FeatureDependency, Process, Resource, Risk, RiskMeasure, Department, JobTitle } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

export default function FeatureDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);

  const { data: features, isLoading: isFeatLoading } = usePluggableCollection<Feature>('features');
  const { data: links, refresh: refreshLinks } = usePluggableCollection<FeatureLink>('feature_links');
  const { data: dependencies, refresh: refreshDeps } = usePluggableCollection<FeatureDependency>('feature_dependencies');
  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: risks } = usePluggableCollection<Risk>('risks');
  const { data: measures } = usePluggableCollection<RiskMeasure>('riskMeasures');
  const { data: departments } = usePluggableCollection<Department>('departments');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');

  useEffect(() => { setMounted(true); }, []);

  const feature = useMemo(() => features?.find(f => f.id === id), [features, id]);
  
  const relatedLinks = useMemo(() => links?.filter(l => l.featureId === id) || [], [links, id]);
  const relatedDeps = useMemo(() => dependencies?.filter(d => d.featureId === id || d.dependentFeatureId === id) || [], [dependencies, id]);

  // Network Split: Origin vs Usage
  const originProcesses = useMemo(() => relatedLinks.filter(l => l.targetType === 'process_origin').map(l => processes?.find(p => p.id === l.targetId)).filter(Boolean), [relatedLinks, processes]);
  const usageProcesses = useMemo(() => relatedLinks.filter(l => l.targetType === 'process_usage').map(l => processes?.find(p => p.id === l.targetId)).filter(Boolean), [relatedLinks, processes]);
  
  const originResources = useMemo(() => relatedLinks.filter(l => l.targetType === 'resource_origin').map(l => resources?.find(r => r.id === l.targetId)).filter(Boolean), [relatedLinks, resources]);
  const usageResources = useMemo(() => relatedLinks.filter(l => l.targetType === 'resource_usage').map(l => resources?.find(r => r.id === l.targetId)).filter(Boolean), [relatedLinks, resources]);
  
  const linkedRisks = useMemo(() => relatedLinks.filter(l => l.targetType === 'risk').map(l => risks?.find(r => r.id === l.targetId)).filter(Boolean), [relatedLinks, risks]);
  
  // Mitigating measures for the linked risks
  const mitigatingMeasures = useMemo(() => {
    const riskIds = linkedRisks.map(r => r?.id);
    return measures?.filter(m => m.riskIds.some(rid => riskIds.includes(rid))) || [];
  }, [linkedRisks, measures]);

  if (!mounted) return null;

  if (isFeatLoading) {
    return <div className="h-full flex flex-col items-center justify-center py-40 gap-4"><Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" /><p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Lade Governance-Daten...</p></div>;
  }

  if (!feature) {
    return <div className="p-20 text-center space-y-4"><AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" /><h2 className="text-xl font-headline font-bold text-slate-900">Merkmal nicht gefunden</h2><Button onClick={() => router.push('/features')}>Zurück zur Übersicht</Button></div>;
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
                "rounded-full px-2 h-5 text-[9px] font-black uppercase tracking-widest border-none shadow-sm",
                feature.status === 'active' ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
              )}>{feature.status.replace('_', ' ')}</Badge>
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
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                  <Building2 className="w-4 h-4 text-primary" /> {dept?.name || '---'}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Fachlicher Owner</p>
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
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
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mx-auto shadow-inner"><ShieldCheck className="w-5 h-5" /></div>
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
              <TabsTrigger value="overview" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"><Info className="w-3.5 h-3.5" /> Überblick</TabsTrigger>
              <TabsTrigger value="network" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"><Network className="w-3.5 h-3.5" /> Vernetzung</TabsTrigger>
              <TabsTrigger value="impact" className="rounded-lg px-6 gap-2 text-[11px] font-bold text-primary data-[state=active]:bg-white data-[state=active]:shadow-sm"><Zap className="w-3.5 h-3.5" /> Impact-Analyse</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary" />
                    <CardTitle className="text-sm font-bold">Inhaltliche Definition</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                  <div className="space-y-3">
                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Beschreibung</Label>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">{feature.description || 'Keine fachliche Beschreibung hinterlegt.'}</p>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Geschäftlicher Zweck</Label>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">{feature.purpose || 'Der geschäftliche Zweck wurde noch nicht explizit dokumentiert.'}</p>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <Label className="text-[9px] font-black uppercase text-primary tracking-widest">Pflegehinweise & Datenqualität</Label>
                      <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 shadow-inner">
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic">{feature.maintenanceNotes || 'Keine spezifischen Pflegehinweise vorhanden.'}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Gültigkeit & Historie</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800 text-center shadow-sm">
                          <p className="text-[8px] font-bold text-slate-400 uppercase">Gültig ab</p>
                          <p className="text-xs font-bold">{feature.validFrom || 'Sofort'}</p>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800 text-center shadow-sm">
                          <p className="text-[8px] font-bold text-slate-400 uppercase">Revision</p>
                          <p className="text-xs font-bold">{new Date(feature.updatedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {feature.changeReason && (
                        <div className="p-2.5 bg-amber-50/30 border border-amber-100 rounded-lg">
                          <p className="text-[8px] font-black uppercase text-amber-600 mb-1">Änderungsgrund</p>
                          <p className="text-[10px] font-medium text-amber-800 italic">{feature.changeReason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="network" className="space-y-10 animate-in fade-in duration-500">
              {/* Process Networking: Sources and Sinks */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-primary" /> Prozess-Vernetzung
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b p-4">
                      <CardTitle className="text-xs font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                        <ArrowRightCircle className="w-4 h-4" /> Herkunft (Quellen)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      {originProcesses.map(p => (
                        <div key={p?.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-950 border rounded-xl hover:border-emerald-500 transition-all group cursor-pointer shadow-sm" onClick={() => router.push(`/processhub/view/${p?.id}`)}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 shadow-inner"><Workflow className="w-4 h-4" /></div>
                            <span className="text-xs font-bold">{p?.title}</span>
                          </div>
                          <Badge variant="outline" className="text-[8px] font-bold h-4 border-emerald-100 text-emerald-600">PROZESS</Badge>
                        </div>
                      ))}
                      {originProcesses.length === 0 && <p className="text-[10px] text-slate-400 italic text-center py-6">Keine Quellen-Prozesse verknüpft</p>}
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b p-4">
                      <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <Zap className="w-4 h-4" /> Nutzung (Senken)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      {usageProcesses.map(p => (
                        <div key={p?.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-950 border rounded-xl hover:border-primary transition-all group cursor-pointer shadow-sm" onClick={() => router.push(`/processhub/view/${p?.id}`)}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/5 dark:bg-primary/10 flex items-center justify-center text-primary shadow-inner"><Workflow className="w-4 h-4" /></div>
                            <span className="text-xs font-bold">{p?.title}</span>
                          </div>
                          <Badge variant="outline" className="text-[8px] font-bold h-4 border-primary/10 text-primary">PROZESS</Badge>
                        </div>
                      ))}
                      {usageProcesses.length === 0 && <p className="text-[10px] text-slate-400 italic text-center py-6">Keine Nutzungs-Prozesse verknüpft</p>}
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Resource Networking: Systems and Interfaces */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" /> System-Vernetzung (IT-Assets)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                    <CardHeader className="bg-indigo-50/20 dark:bg-indigo-900/10 border-b p-4">
                      <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                        <Database className="w-4 h-4" /> Datenquelle (Origin)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      {originResources.map(r => (
                        <div key={r?.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-950 border rounded-xl hover:border-indigo-500 transition-all group cursor-pointer shadow-sm" onClick={() => router.push(`/resources?search=${r?.name}`)}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 shadow-inner"><Layers className="w-4 h-4" /></div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate">{r?.name}</p>
                              <p className="text-[8px] font-black uppercase text-slate-400">{r?.assetType}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[8px] font-bold h-4">SYSTEM</Badge>
                        </div>
                      ))}
                      {originResources.length === 0 && <p className="text-[10px] text-slate-400 italic text-center py-6">Keine Quellsysteme gemappt</p>}
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                    <CardHeader className="bg-indigo-50/20 dark:bg-indigo-900/10 border-b p-4">
                      <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                        <ArrowRightCircle className="w-4 h-4" /> Datenverbraucher (Usage)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      {usageResources.map(r => (
                        <div key={r?.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-950 border rounded-xl hover:border-indigo-500 transition-all group cursor-pointer shadow-sm" onClick={() => router.push(`/resources?search=${r?.name}`)}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 shadow-inner"><Layers className="w-4 h-4" /></div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate">{r?.name}</p>
                              <p className="text-[8px] font-black uppercase text-slate-400">{r?.assetType}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[8px] font-bold h-4">SYSTEM</Badge>
                        </div>
                      ))}
                      {usageResources.length === 0 && <p className="text-[10px] text-slate-400 italic text-center py-6">Keine Zielsysteme gemappt</p>}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="impact" className="space-y-8 animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-slate-900 text-white p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg"><Zap className="w-5 h-5" /></div>
                      <div>
                        <CardTitle className="text-base font-headline font-bold">Impact Analysis</CardTitle>
                        <p className="text-[10px] text-primary font-bold uppercase tracking-widest">Risikobewertung bei Änderungen an diesem Merkmal</p>
                      </div>
                    </div>
                    <Badge className="bg-white/10 text-white border-none rounded-full px-3 h-6 text-[10px] font-black uppercase tracking-widest">Active Analysis</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-10">
                  {/* Risks and Mitigating Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl space-y-4 shadow-inner">
                      <h4 className="text-xs font-black uppercase text-red-700 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Risikopotenzial
                      </h4>
                      <div className="space-y-3">
                        {linkedRisks.map(r => (
                          <div key={r?.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-950 rounded-xl border border-red-100 dark:border-red-900/30 shadow-sm">
                            <div className="flex items-center gap-3">
                              <Badge className="bg-red-600 text-white border-none rounded-md text-[9px] font-black h-5 px-2">{r?.impact * r?.probability}</Badge>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{r?.title}</span>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => router.push(`/risks?search=${r?.title}`)}><ExternalLink className="w-3.5 h-3.5" /></Button>
                          </div>
                        ))}
                        {linkedRisks.length === 0 && <p className="text-[11px] text-slate-500 italic">Keine direkt verknüpften Risiken gefunden.</p>}
                      </div>
                    </div>

                    <div className="p-6 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl space-y-4 shadow-inner">
                      <h4 className="text-xs font-black uppercase text-emerald-700 flex items-center gap-2">
                        <Shield className="w-4 h-4" /> Bestehende Kontrollen
                      </h4>
                      <div className="space-y-3">
                        {mitigatingMeasures.map(m => (
                          <div key={m?.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-950 rounded-xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-md bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /></div>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">{m?.title}</span>
                            </div>
                            <Badge variant="outline" className="text-[8px] font-black uppercase text-emerald-600 border-emerald-100">{m?.status}</Badge>
                          </div>
                        ))}
                        {mitigatingMeasures.length === 0 && <p className="text-[11px] text-slate-500 italic">Keine aktiven Kontrollen für dieses Merkmal.</p>}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest border-b pb-2">Merkmal-Abhängigkeiten</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {relatedDeps.map(d => {
                        const isMain = d.featureId === id;
                        const otherId = isMain ? d.dependentFeatureId : d.featureId;
                        const otherFeat = features?.find(f => f.id === otherId);
                        return (
                          <div key={d.id} className="p-4 border rounded-2xl bg-white dark:bg-slate-950 shadow-sm flex items-start gap-4 group hover:border-primary transition-all">
                            <div className={cn(
                              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-inner",
                              isMain ? "bg-blue-50 text-blue-600" : "bg-indigo-50 text-indigo-600"
                            )}>
                              {isMain ? <ArrowRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-black uppercase text-slate-400">{d.type}</p>
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{otherFeat?.name || 'Unbekannt'}</p>
                              <p className="text-[10px] text-slate-500 italic mt-1 line-clamp-2">{d.description}</p>
                            </div>
                          </div>
                        );
                      })}
                      <Button variant="outline" className="h-auto py-6 border-dashed rounded-2xl flex flex-col gap-2 text-slate-400 hover:text-primary hover:border-primary transition-all bg-white dark:bg-slate-900">
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
