"use client";

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  Loader2, 
  FileCheck, 
  Activity, 
  Building2, 
  Scale, 
  ShieldCheck, 
  Workflow, 
  Server, 
  CheckCircle2, 
  AlertTriangle, 
  FileDown,
  Info,
  ExternalLink,
  Target,
  ArrowRight,
  Shield,
  Zap,
  Clock,
  History,
  TrendingUp,
  Fingerprint,
  Users,
  ChevronRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { ProcessingActivity, Resource, Process, RiskMeasure, ProcessVersion, ProcessNode, Feature, Tenant } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { exportGdprPdf } from '@/lib/export-utils';
import { toast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';

export default function GdprDetailViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { data: activities, isLoading: isActLoading } = usePluggableCollection<ProcessingActivity>('processingActivities');
  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: versions } = usePluggableCollection<ProcessVersion>('process_versions');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: measures } = usePluggableCollection<RiskMeasure>('riskMeasures');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');

  useEffect(() => { setMounted(true); }, []);

  const activity = useMemo(() => activities?.find(a => a.id === id), [activities, id]);
  const currentTenant = useMemo(() => tenants?.find(t => t.id === activity?.tenantId), [tenants, activity]);

  const stats = useMemo(() => {
    if (!activity || !processes || !versions || !resources || !measures) return { linkedProcesses: [], aggregatedResources: [], automatedToms: [], gapScore: 0, gaps: [] };

    const linkedProcesses = processes.filter(p => p.vvtId === activity.id);
    const resourceIds = new Set<string>();
    linkedProcesses.forEach(proc => {
      const ver = versions.find(v => v.process_id === proc.id);
      ver?.model_json?.nodes?.forEach((node: ProcessNode) => {
        node.resourceIds?.forEach(rid => resourceIds.add(rid));
      });
    });
    
    const aggregatedResources = Array.from(resourceIds).map(rid => resources.find(r => r.id === rid)).filter(Boolean) as Resource[];
    const automatedToms = measures.filter(m => m.isTom && m.resourceIds?.some(rid => resourceIds.has(rid)));

    const gaps = [];
    if (aggregatedResources.some(r => r.criticality === 'high') && automatedToms.length < 3) {
      gaps.push({ type: 'critical', title: 'Ungenügende Absicherung', msg: 'Hoher Schutzbedarf, aber weniger als 3 Kontrollen (TOM) definiert.' });
    }
    if (automatedToms.some(m => !m.isEffective)) {
      gaps.push({ type: 'warning', title: 'Kontroll-Schwäche', msg: 'Mindestens eine verknüpfte TOM ist aktuell als "nicht wirksam" markiert.' });
    }
    if (linkedProcesses.length === 0) {
      gaps.push({ type: 'info', title: 'Daten-Inkonsistenz', msg: 'Diesem Zweck ist noch kein operativer Geschäftsprozess zugeordnet.' });
    }

    const gapScore = gaps.length === 0 ? 100 : Math.max(0, 100 - (gaps.length * 25));

    return { linkedProcesses, aggregatedResources, automatedToms, gaps, gapScore };
  }, [activity, processes, versions, resources, measures]);

  const handleExport = async () => {
    if (!activity || !currentTenant) return;
    setIsExporting(true);
    try {
      await exportGdprPdf(activity, currentTenant, stats.aggregatedResources, stats.automatedToms);
      toast({ title: "PDF Bericht erstellt" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Export fehlgeschlagen", description: e.message });
    } finally {
      setIsExporting(false);
    }
  };

  if (!mounted) return null;

  if (isActLoading) {
    return <div className="h-full flex flex-col items-center justify-center py-40 gap-4"><Loader2 className="w-12 h-12 animate-spin text-emerald-600 opacity-20" /><p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Lade VVT-Register...</p></div>;
  }

  if (!activity) {
    return <div className="p-20 text-center space-y-4"><AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" /><h2 className="text-xl font-headline font-bold text-slate-900">Eintrag nicht gefunden</h2><Button onClick={() => router.push('/gdpr')}>Zurück zum Register</Button></div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/gdpr')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">{activity.name}</h1>
              <Badge className={cn(
                "rounded-full px-2 h-5 text-[9px] font-black uppercase tracking-widest border-none shadow-sm",
                activity.status === 'active' ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
              )}>V{activity.version}</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Art. 30 DSGVO • {activity.legalBasis}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs px-6 border-emerald-200 text-emerald-700 hover:bg-emerald-50 shadow-sm" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <FileDown className="w-3.5 h-3.5 mr-2" />} Art. 30 Bericht (PDF)
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg active:scale-95 transition-all" onClick={() => router.push(`/gdpr`)}>
            Bearbeiten
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
              <div className="space-y-4 p-4 bg-slate-50/50 rounded-xl border border-slate-100 shadow-inner">
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Fachabteilung</p>
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                    <Building2 className="w-4 h-4 text-emerald-600" /> {activity.responsibleDepartment || '---'}
                  </div>
                </div>
                <Separator />
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Rechtsgrundlage</p>
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                    <Scale className="w-4 h-4 text-indigo-500" /> {activity.legalBasis || '---'}
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Daten-Kontext</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-white border border-slate-100 shadow-sm flex flex-col items-center text-center gap-1">
                    <p className="text-[8px] font-black uppercase text-slate-400">Joint Cont.</p>
                    <Badge variant="outline" className={cn("text-[9px] font-bold border-none", activity.jointController ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-400")}>{activity.jointController ? 'JA' : 'NEIN'}</Badge>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-100 shadow-sm flex flex-col items-center text-center gap-1">
                    <p className="text-[8px] font-black uppercase text-slate-400">Transfer</p>
                    <Badge variant="outline" className={cn("text-[9px] font-bold border-none", activity.thirdCountryTransfer ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-400")}>{activity.thirdCountryTransfer ? 'NON-EU' : 'EU'}</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-none shadow-xl bg-slate-900 text-white overflow-hidden">
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                  <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Compliance</p>
                  <p className="text-2xl font-black">{stats.gapScore}%</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest opacity-60">
                  <span>Integritäts-Score</span>
                  <span>Art. 32 Check</span>
                </div>
                <Progress value={stats.gapScore} className="h-1.5 bg-white/10" />
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed italic border-t border-white/5 pt-4">
                Dieser Score errechnet sich aus der Abdeckung des Schutzbedarfs durch technische Maßnahmen (TOM).
              </p>
            </CardContent>
          </Card>
        </aside>

        <div className="lg:col-span-3">
          <Tabs defaultValue="vvt" className="space-y-6">
            <TabsList className="bg-slate-100 p-1 h-11 rounded-xl border w-full justify-start gap-1 shadow-inner">
              <TabsTrigger value="vvt" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <FileCheck className="w-3.5 h-3.5 text-emerald-600" /> VVT-Stammblatt
              </TabsTrigger>
              <TabsTrigger value="assets" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Server className="w-3.5 h-3.5 text-indigo-600" /> IT-Systeme ({stats.aggregatedResources.length})
              </TabsTrigger>
              <TabsTrigger value="toms" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Automatisierte TOM
              </TabsTrigger>
              <TabsTrigger value="gaps" className="rounded-lg px-6 gap-2 text-[11px] font-bold text-red-600 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <AlertTriangle className="w-3.5 h-3.5" /> Gap-Analyse
              </TabsTrigger>
            </TabsList>

            <TabsContent value="vvt" className="space-y-6 animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6">
                  <CardTitle className="text-sm font-bold">Verarbeitungszweck & Umfang</CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-10">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Funktionale Beschreibung</Label>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-inner italic">
                      "{activity.description || 'Keine detaillierte Zweckbeschreibung hinterlegt.'}"
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Aufbewahrungsfrist</p>
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                          <Clock className="w-4 h-4 text-emerald-600" /> {activity.retentionPeriod || '---'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Empfängerkategorien</p>
                        <p className="text-xs text-slate-600 font-medium">{activity.recipientCategories || 'Keine externen Empfänger dokumentiert.'}</p>
                      </div>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center">
                      <div className="flex items-center gap-3 mb-2">
                        <History className="w-4 h-4 text-slate-400" />
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Review Historie</p>
                      </div>
                      <p className="text-xs font-bold text-slate-700">Letzte Prüfung: {activity.lastReviewDate ? new Date(activity.lastReviewDate).toLocaleDateString() : 'Ausstehend'}</p>
                      <Badge className="w-fit mt-2 bg-emerald-100 text-emerald-700 border-none text-[8px] font-black uppercase h-4 px-1.5">Gültig bis 2025</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assets" className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden h-fit">
                  <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Workflow className="w-5 h-5 text-indigo-600" />
                      <div>
                        <CardTitle className="text-sm font-bold">Verknüpfte Workflows</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase">Operative Umsetzung dieses Zwecks</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                      {stats.linkedProcesses.map(p => (
                        <div key={p.id} className="p-4 flex items-center justify-between group hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/processhub/view/${p.id}`)}>
                          <div className="flex items-center gap-3">
                            <Workflow className="w-4 h-4 text-indigo-400" />
                            <span className="text-xs font-bold text-slate-700">{p.title}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-all" />
                        </div>
                      ))}
                      {stats.linkedProcesses.length === 0 && (
                        <div className="p-10 text-center opacity-30 italic text-xs">Keine direkten Prozesse zugeordnet.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden h-fit">
                  <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Server className="w-5 h-5 text-indigo-600" />
                      <div>
                        <CardTitle className="text-sm font-bold">Involvierte IT-Systeme</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase">Physische Datenlast für diesen Zweck</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 gap-2">
                      {stats.aggregatedResources.map(res => (
                        <div key={res.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between group hover:border-indigo-300 transition-all cursor-pointer shadow-sm" onClick={() => router.push(`/resources/${res.id}`)}>
                          <div className="flex items-center gap-3">
                            <Server className="w-4 h-4 text-indigo-400" />
                            <p className="text-[11px] font-bold text-slate-700 truncate">{res.name}</p>
                          </div>
                          <Badge variant="outline" className={cn(
                            "text-[7px] font-black h-4 px-1 border-none",
                            res.criticality === 'high' ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                          )}>{res.criticality.toUpperCase()}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="toms" className="space-y-6 animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-900 text-white p-6">
                  <div className="flex items-center gap-4">
                    <ShieldCheck className="w-6 h-6 text-emerald-500" />
                    <div>
                      <CardTitle className="text-base font-headline font-bold uppercase">Automatisierte TOM-Sicht (Art. 32)</CardTitle>
                      <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gegenmaßnahmen basierend auf den genutzten IT-Systemen</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 gap-3">
                    {stats.automatedToms.map(tom => (
                      <div key={tom.id} className="p-5 bg-white border rounded-2xl shadow-sm flex items-center justify-between group hover:border-emerald-300 transition-all">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner",
                            tom.status === 'completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                          )}>
                            <ShieldCheck className="w-5 h-5" />
                          </div>
                          <div>
                            <h5 className="font-bold text-sm text-slate-800">{tom.title}</h5>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="outline" className="text-[8px] font-black uppercase text-slate-400 h-4">{tom.tomCategory}</Badge>
                              <span className="text-[9px] text-slate-400 font-medium italic">Owner: {tom.owner}</span>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="h-9 rounded-xl text-[9px] font-black uppercase" onClick={() => router.push(`/risks/measures`)}>Nachweis <ExternalLink className="w-3.5 h-3.5 ml-2" /></Button>
                      </div>
                    ))}
                    {stats.automatedToms.length === 0 && (
                      <div className="py-20 text-center border-2 border-dashed rounded-2xl opacity-20 italic text-xs">Keine verknüpften Kontrollen gefunden.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="gaps" className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 gap-4">
                {stats.gaps.map((gap, i) => (
                  <Card key={i} className={cn(
                    "rounded-2xl border shadow-sm relative overflow-hidden",
                    gap.type === 'critical' ? "bg-red-50 border-red-100" : gap.type === 'warning' ? "bg-orange-50 border-orange-100" : "bg-blue-50 border-blue-100"
                  )}>
                    <CardContent className="p-6 flex items-start gap-5">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shadow-lg",
                        gap.type === 'critical' ? "bg-red-600 text-white" : gap.type === 'warning' ? "bg-orange-600 text-white" : "bg-blue-600 text-white"
                      )}>
                        {gap.type === 'critical' ? <AlertTriangle className="w-6 h-6" /> : <Info className="w-6 h-6" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">{gap.title}</h4>
                          <Badge className="h-4 px-1.5 text-[7px] font-black uppercase rounded-none">Audit Finding</Badge>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed font-medium">{gap.msg}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {stats.gaps.length === 0 && (
                  <div className="py-32 text-center opacity-30 italic space-y-4">
                    <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500" />
                    <p className="text-sm font-black uppercase">Keine Compliance-Lücken identifiziert</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
