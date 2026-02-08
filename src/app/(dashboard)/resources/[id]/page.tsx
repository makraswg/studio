
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  Loader2, 
  Server, 
  Activity, 
  ShieldCheck, 
  Workflow, 
  FileCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Target, 
  ArrowRight,
  Database,
  ExternalLink,
  Shield,
  Info,
  CalendarDays,
  User as UserIcon,
  Tag,
  Scale,
  Settings2,
  Clock,
  BadgeCheck,
  Zap,
  ArrowUp
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { Resource, Process, ProcessVersion, ProcessNode, Risk, RiskMeasure, ProcessingActivity, Feature } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { saveResourceAction } from '@/app/actions/resource-actions';
import { toast } from '@/hooks/use-toast';
import { usePlatformAuth } from '@/context/auth-context';

export default function ResourceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = usePlatformAuth();
  const { activeTenantId, dataSource } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [isInheriting, setIsInheriting] = useState(false);

  // Data
  const { data: resources, isLoading: isResLoading, refresh: refreshRes } = usePluggableCollection<Resource>('resources');
  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: versions } = usePluggableCollection<ProcessVersion>('process_versions');
  const { data: risks } = usePluggableCollection<Risk>('risks');
  const { data: measures } = usePluggableCollection<RiskMeasure>('riskMeasures');
  const { data: vvts } = usePluggableCollection<ProcessingActivity>('processingActivities');
  const { data: features } = usePluggableCollection<Feature>('features');

  useEffect(() => { setMounted(true); }, []);

  const resource = useMemo(() => resources?.find(r => r.id === id), [resources, id]);

  const impactAnalysis = useMemo(() => {
    if (!resource || !processes || !versions) return { processes: [], vvts: [], features: [] };

    // 1. In welchen Prozessen wird diese Ressource genutzt?
    const affectedProcesses = processes.filter(p => {
      const ver = versions.find(v => v.process_id === p.id && v.version === p.currentVersion);
      return ver?.model_json?.nodes?.some((n: ProcessNode) => n.resourceIds?.includes(resource.id));
    });

    // 2. Welche VVTs hängen an diesen Prozessen?
    const vvtIds = new Set(affectedProcesses.map(p => p.vvtId).filter(Boolean));
    const affectedVvts = vvts?.filter(v => vvtIds.has(v.id)) || [];

    // 3. Welche Datenobjekte (Features) werden in diesen Prozessen verarbeitet?
    // (Inkludiert Features, die dieses System explizit als dataStoreId nutzen)
    const linkedFeatures = features?.filter(f => f.dataStoreId === resource.id) || [];

    return { processes: affectedProcesses, vvts: affectedVvts, features: linkedFeatures };
  }, [resource, processes, versions, vvts, features]);

  const riskProfile = useMemo(() => {
    if (!resource || !risks || !measures) return { risks: [], measures: [], maxScore: 0 };
    const resRisks = risks.filter(r => r.assetId === resource.id);
    const resMeasures = measures.filter(m => m.resourceIds?.includes(resource.id));
    const maxScore = resRisks.length > 0 ? Math.max(...resRisks.map(r => r.impact * r.probability)) : 0;
    return { risks: resRisks, measures: resMeasures, maxScore };
  }, [resource, risks, measures]);

  // Inheritance Logic (Maximum Principle)
  const effectiveInheritance = useMemo(() => {
    if (!impactAnalysis.features || impactAnalysis.features.length === 0) return null;
    
    const rankMap = { 'low': 1, 'medium': 2, 'high': 3 };
    const revRankMap = { 1: 'low', 2: 'medium', 3: 'high' } as const;

    let maxCrit = 1;
    let maxC = 1;
    let maxI = 1;
    let maxA = 1;

    impactAnalysis.features.forEach(f => {
      maxCrit = Math.max(maxCrit, rankMap[f.criticality] || 1);
      maxC = Math.max(maxC, rankMap[f.confidentialityReq || 'low'] || 1);
      maxI = Math.max(maxI, rankMap[f.integrityReq || 'low'] || 1);
      maxA = Math.max(maxA, rankMap[f.availabilityReq || 'low'] || 1);
    });

    return {
      criticality: revRankMap[maxCrit as 1|2|3],
      confidentiality: revRankMap[maxC as 1|2|3],
      integrity: revRankMap[maxI as 1|2|3],
      availability: revRankMap[maxA as 1|2|3]
    };
  }, [impactAnalysis.features]);

  const hasInheritanceMismatch = useMemo(() => {
    if (!resource || !effectiveInheritance) return false;
    const rankMap = { 'low': 1, 'medium': 2, 'high': 3 };
    
    const isUnderCrit = rankMap[resource.criticality] < rankMap[effectiveInheritance.criticality];
    const isUnderC = rankMap[resource.confidentialityReq] < rankMap[effectiveInheritance.confidentiality];
    const isUnderI = rankMap[resource.integrityReq] < rankMap[effectiveInheritance.integrity];
    const isUnderA = rankMap[resource.availabilityReq] < rankMap[effectiveInheritance.availability];

    return isUnderCrit || isUnderC || isUnderI || isUnderA;
  }, [resource, effectiveInheritance]);

  const handleApplyInheritance = async () => {
    if (!resource || !effectiveInheritance) return;
    setIsInheriting(true);
    
    const updatedResource: Resource = {
      ...resource,
      criticality: effectiveInheritance.criticality,
      confidentialityReq: effectiveInheritance.confidentiality,
      integrityReq: effectiveInheritance.integrity,
      availabilityReq: effectiveInheritance.availability,
      notes: (resource.notes || '') + `\n[Auto-Sync] Schutzbedarf am ${new Date().toLocaleDateString()} von Daten geerbt.`
    };

    try {
      const res = await saveResourceAction(updatedResource, dataSource, user?.email || 'system');
      if (res.success) {
        toast({ title: "Schutzbedarf aktualisiert", description: "Werte wurden erfolgreich von den Datenobjekten übernommen." });
        refreshRes();
      }
    } finally {
      setIsInheriting(false);
    }
  };

  if (!mounted) return null;

  if (isResLoading) {
    return <div className="h-full flex flex-col items-center justify-center py-40 gap-4"><Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" /><p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Analysiere Asset-Kontext...</p></div>;
  }

  if (!resource) {
    return <div className="p-20 text-center space-y-4"><AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" /><h2 className="text-xl font-headline font-bold text-slate-900">Ressource nicht gefunden</h2><Button onClick={() => router.push('/resources')}>Zurück zum Katalog</Button></div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/resources')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">{resource.name}</h1>
              <Badge className={cn(
                "rounded-full px-2 h-5 text-[9px] font-black uppercase tracking-widest border-none shadow-sm",
                resource.criticality === 'high' ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
              )}>{resource.assetType}</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: {resource.id} • {resource.operatingModel}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs px-6 border-slate-200" onClick={() => router.push(`/audit?search=${resource.id}`)}>
            <Activity className="w-3.5 h-3.5 mr-2" /> Audit-Historie
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-primary hover:bg-primary/90 text-white shadow-lg transition-all active:scale-95">
            <Settings2 className="w-3.5 h-3.5 mr-2" /> Konfigurieren
          </Button>
        </div>
      </header>

      {hasInheritanceMismatch && (
        <Alert className="bg-amber-50 border-amber-200 text-amber-900 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-4">
          <Zap className="h-5 w-5 text-amber-600" />
          <AlertTitle className="font-bold text-sm">Schutzbedarfs-Mismatch erkannt!</AlertTitle>
          <AlertDescription className="text-xs mt-1 leading-relaxed">
            Die Sensibilität der auf diesem System gespeicherten Daten (Features) ist höher als die aktuelle Einstufung der Ressource. 
            Empfohlene Kritikalität basierend auf Datenlast: <strong className="uppercase">{effectiveInheritance?.criticality}</strong>.
            <div className="mt-3">
              <Button size="sm" onClick={handleApplyInheritance} disabled={isInheriting} className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] uppercase h-8 px-4 rounded-lg shadow-md shadow-amber-200 gap-2 transition-all">
                {isInheriting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUp className="w-3 h-3" />} Schutzbedarf anheben
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar: Key Metrics */}
        <aside className="lg:col-span-1 space-y-4">
          <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b p-4 px-6">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Schutzbedarf (CIA)</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 bg-slate-50 rounded-xl border flex flex-col items-center justify-center gap-1">
                  <span className="text-[8px] font-black uppercase text-slate-400">V</span>
                  <Badge variant="outline" className={cn("text-[10px] font-bold border-none uppercase", effectiveInheritance && resource.confidentialityReq !== effectiveInheritance.confidentiality && "text-amber-600")}>{resource.confidentialityReq}</Badge>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border flex flex-col items-center justify-center gap-1">
                  <span className="text-[8px] font-black uppercase text-slate-400">I</span>
                  <Badge variant="outline" className={cn("text-[10px] font-bold border-none uppercase", effectiveInheritance && resource.integrityReq !== effectiveInheritance.integrity && "text-amber-600")}>{resource.integrityReq}</Badge>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border flex flex-col items-center justify-center gap-1">
                  <span className="text-[8px] font-black uppercase text-slate-400">A</span>
                  <Badge variant="outline" className={cn("text-[10px] font-bold border-none uppercase", effectiveInheritance && resource.availabilityReq !== effectiveInheritance.availability && "text-amber-600")}>{resource.availabilityReq}</Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Kritikalität</p>
                  <div className={cn(
                    "p-3 rounded-xl border flex items-center justify-between font-black text-xs uppercase shadow-inner",
                    resource.criticality === 'high' ? "bg-red-50 border-red-100 text-red-700" : "bg-emerald-50 border-emerald-100 text-emerald-700"
                  )}>
                    {resource.criticality} <ShieldAlert className="w-4 h-4" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">System Owner</p>
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                    <UserIcon className="w-4 h-4 text-primary" /> {resource.systemOwner || '---'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-none bg-slate-900 text-white shadow-xl overflow-hidden">
            <CardHeader className="p-6 border-b border-white/10">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary">Compliance Pulse</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase">
                  <span>Kontroll-Effektivität</span>
                  <span className="text-primary">85%</span>
                </div>
                <Progress value={85} className="h-1.5 bg-white/10" />
              </div>
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                <BadgeCheck className="w-5 h-5 text-emerald-400" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase">Audit Ready</p>
                  <p className="text-[8px] text-slate-400 italic uppercase">Zuletzt geprüft: 12.02.2024</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Main Content: Tabs */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="impact" className="space-y-6">
            <TabsList className="bg-slate-100 p-1 h-11 rounded-xl border w-full justify-start gap-1 shadow-inner">
              <TabsTrigger value="impact" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Zap className="w-3.5 h-3.5 text-primary" /> Impact-Analyse
              </TabsTrigger>
              <TabsTrigger value="risks" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <ShieldAlert className="w-3.5 h-3.5 text-accent" /> Risikoprofil ({riskProfile.risks.length})
              </TabsTrigger>
              <TabsTrigger value="details" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Info className="w-3.5 h-3.5" /> Stammdaten
              </TabsTrigger>
            </TabsList>

            <TabsContent value="impact" className="space-y-8 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Workflow className="w-5 h-5 text-indigo-600" />
                      <div>
                        <CardTitle className="text-sm font-bold">Betroffene Prozesse</CardTitle>
                        <CardDescription className="text-[10px] font-bold">In diesen Abläufen wird das System genutzt.</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="rounded-full font-black text-[10px]">{impactAnalysis.processes.length}</Badge>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[300px]">
                      <div className="divide-y divide-slate-50">
                        {impactAnalysis.processes.map(p => (
                          <div key={p.id} className="p-4 flex items-center justify-between group hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => router.push(`/processhub/view/${p.id}`)}>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-inner"><Workflow className="w-4 h-4" /></div>
                              <span className="text-xs font-bold text-slate-700">{p.title}</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-all" />
                          </div>
                        ))}
                        {impactAnalysis.processes.length === 0 && <div className="p-10 text-center opacity-30 italic text-xs">Keine Prozessabhängigkeiten gefunden.</div>}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-emerald-50/30 border-b p-6 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileCheck className="w-5 h-5 text-emerald-600" />
                      <div>
                        <CardTitle className="text-sm font-bold">Indirekte DSGVO-Zwecke</CardTitle>
                        <CardDescription className="text-[10px] font-bold">Betroffene Verarbeitungstätigkeiten (VVT).</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="rounded-full font-black text-[10px] border-emerald-100 text-emerald-700">{impactAnalysis.vvts.length}</Badge>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[300px]">
                      <div className="divide-y divide-slate-50">
                        {impactAnalysis.vvts.map(v => (
                          <div key={v.id} className="p-4 flex items-center justify-between group hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => router.push(`/gdpr?search=${v.name}`)}>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-inner"><FileCheck className="w-4 h-4" /></div>
                              <span className="text-xs font-bold text-slate-700">{v.name}</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-all" />
                          </div>
                        ))}
                        {impactAnalysis.vvts.length === 0 && <div className="p-10 text-center opacity-30 italic text-xs">Keine indirekten DSGVO-Bezüge.</div>}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className={cn("text-white p-6 transition-colors", resource.isDataRepository ? "bg-indigo-900" : "bg-slate-900")}>
                  <div className="flex items-center gap-4">
                    <Database className="w-6 h-6 text-primary" />
                    <div>
                      <CardTitle className="text-base font-headline font-bold uppercase">Gehostete Datenobjekte</CardTitle>
                      <CardDescription className="text-[10px] font-bold text-slate-400 uppercase">Inhalte und Sensibilität der verarbeiteten Daten</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {impactAnalysis.features.map(f => (
                      <div key={f.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between group hover:border-indigo-300 transition-all cursor-pointer shadow-sm" onClick={() => router.push(`/features/${f.id}`)}>
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-indigo-400" />
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-slate-700 truncate">{f.name}</p>
                            <p className="text-[7px] font-black uppercase text-slate-400">CIA: {f.confidentialityReq?.charAt(0) || 'L'}{f.integrityReq?.charAt(0) || 'L'}{f.availabilityReq?.charAt(0) || 'L'}</p>
                          </div>
                        </div>
                        <Badge className={cn(
                          "text-[7px] font-black h-4 border-none",
                          f.criticality === 'high' ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                        )}>{f.criticality.toUpperCase()}</Badge>
                      </div>
                    ))}
                    {impactAnalysis.features.length === 0 && <p className="col-span-full text-center py-10 text-xs text-slate-400 italic font-medium uppercase tracking-widest">Keine Datenobjekte verknüpft</p>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="risks" className="space-y-8 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-red-50/30 border-b p-6">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-red-900">
                      <AlertTriangle className="w-4 h-4 text-red-600" /> Bedrohungen
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-50">
                      {riskProfile.risks.map(r => (
                        <div key={r.id} className="p-4 flex items-center justify-between group hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/risks?search=${r.title}`)}>
                          <div className="flex items-center gap-3">
                            <Badge className={cn(
                              "h-6 w-8 justify-center rounded-md font-black text-[10px] border-none",
                              (r.impact * r.probability) >= 15 ? "bg-red-600 text-white" : (r.impact * r.probability) >= 8 ? "bg-orange-600 text-white" : "bg-emerald-600 text-white"
                            )}>{r.impact * r.probability}</Badge>
                            <span className="text-[11px] font-bold text-slate-800">{r.title}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      ))}
                      {riskProfile.risks.length === 0 && <div className="p-10 text-center opacity-30 italic text-xs">Keine spezifischen Risiken erfasst.</div>}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-emerald-50/30 border-b p-6">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-900">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" /> Aktive Kontrollen (TOM)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-50">
                      {riskProfile.measures.map(m => (
                        <div key={m.id} className="p-4 flex items-center justify-between group hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/risks/measures?search=${m.title}`)}>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center border shadow-inner",
                              m.isEffective ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400"
                            )}><CheckCircle2 className="w-4 h-4" /></div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-slate-800 truncate">{m.title}</p>
                              {m.isTom && <span className="text-[8px] font-black text-emerald-600 uppercase">Art. 32 DSGVO</span>}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      ))}
                      {riskProfile.measures.length === 0 && <div className="p-10 text-center opacity-30 italic text-xs">Keine Maßnahmen hinterlegt.</div>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="details" className="space-y-6 animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6">
                  <CardTitle className="text-sm font-bold">Systembeschreibung & Zweck</CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Verarbeitungszweck</p>
                        <p className="text-sm text-slate-700 font-medium leading-relaxed">{resource.processingPurpose || 'Kein spezifischer Zweck hinterlegt.'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Datenstandort</p>
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                          <Globe className="w-4 h-4 text-slate-400" /> {resource.dataLocation || 'Unbekannt'}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                      <h4 className="text-[9px] font-black uppercase text-slate-400 mb-2">Technischer Kontext</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div><p className="text-[8px] font-bold text-slate-400 uppercase">Betrieb</p><p className="text-xs font-bold">{resource.operatingModel}</p></div>
                        <div><p className="text-[8px] font-bold text-slate-400 uppercase">Klassifizierung</p><Badge className="text-[8px] font-black h-4 border-none bg-slate-900 text-white uppercase">{resource.dataClassification}</Badge></div>
                        <div><p className="text-[8px] font-bold text-slate-400 uppercase">Pers. Daten</p><Badge variant="outline" className={cn("text-[8px] font-black h-4 uppercase", resource.hasPersonalData ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-400")}>{resource.hasPersonalData ? 'JA' : 'NEIN'}</Badge></div>
                        <div><p className="text-[8px] font-bold text-slate-400 uppercase">Erstellt am</p><p className="text-xs font-bold">{resource.createdAt ? new Date(resource.createdAt).toLocaleDateString() : '---'}</p></div>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Administratorische Notizen</p>
                    <p className="text-xs text-slate-500 italic leading-relaxed">{resource.notes || 'Keine zusätzlichen Notizen vorhanden.'}</p>
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
