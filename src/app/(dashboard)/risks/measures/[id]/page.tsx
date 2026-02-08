
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  Loader2, 
  ShieldCheck, 
  Target, 
  Activity, 
  Clock, 
  User as UserIcon, 
  Layers, 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight,
  ClipboardList,
  ExternalLink,
  Shield,
  Info,
  BadgeCheck,
  Settings2,
  FileCheck,
  History,
  Target as TargetIcon,
  Server,
  Plus
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { Risk, RiskMeasure, Resource, RiskControl } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';

export default function MeasureDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { dataSource } = useSettings();
  const [mounted, setMounted] = useState(false);

  const { data: measures, isLoading: isMeasuresLoading } = usePluggableCollection<RiskMeasure>('riskMeasures');
  const { data: risks } = usePluggableCollection<Risk>('risks');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: controls } = usePluggableCollection<RiskControl>('riskControls');

  useEffect(() => { setMounted(true); }, []);

  const measure = useMemo(() => measures?.find(m => m.id === id), [measures, id]);
  
  const linkedRisks = useMemo(() => 
    risks?.filter(r => measure?.riskIds?.includes(r.id)) || [],
    [risks, measure]
  );

  const linkedResources = useMemo(() => 
    resources?.filter(r => measure?.resourceIds?.includes(r.id)) || [],
    [resources, measure]
  );

  const measureControls = useMemo(() => 
    controls?.filter(c => c.measureId === id) || [],
    [controls, id]
  );

  const isEffective = useMemo(() => 
    measureControls.some(c => c.isEffective),
    [measureControls]
  );

  if (!mounted) return null;

  if (isMeasuresLoading) {
    return <div className="h-full flex flex-col items-center justify-center py-40 gap-4"><Loader2 className="w-12 h-12 animate-spin text-emerald-600 opacity-20" /><p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Analysiere Compliance-Maßnahme...</p></div>;
  }

  if (!measure) {
    return <div className="p-20 text-center space-y-4"><AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" /><h2 className="text-xl font-headline font-bold text-slate-900">Maßnahme nicht gefunden</h2><Button onClick={() => router.push('/risks/measures')}>Zurück zum Plan</Button></div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/risks/measures')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">{measure.title}</h1>
              <Badge className={cn(
                "rounded-full px-2 h-5 text-[9px] font-black uppercase tracking-widest border-none shadow-sm",
                measure.status === 'completed' ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
              )}>{measure.status}</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: {measure.id} • {measure.isTom ? `TOM: ${measure.tomCategory}` : 'Allgemeine Maßnahme'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs px-6 border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm" onClick={() => router.push(`/risks/controls?measureId=${id}`)}>
            <Plus className="w-3.5 h-3.5 mr-2" /> Kontrolle planen
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg active:scale-95 transition-all">
            Bearbeiten
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 space-y-4">
          <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b p-4 px-6">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Governance Metriken</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Verantwortlich</p>
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                    <UserIcon className="w-4 h-4 text-primary" /> {measure.owner || '---'}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Deadline / Review</p>
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                    <Clock className="w-4 h-4 text-orange-500" /> {measure.dueDate || 'Unbefristet'}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Wirksamkeits-Status</p>
                <div className={cn(
                  "p-4 rounded-2xl border flex items-center justify-between shadow-inner",
                  isEffective ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-amber-50 border-amber-100 text-amber-700"
                )}>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase">{isEffective ? 'Effektiv' : 'Nicht bestätigt'}</span>
                    <span className="text-[8px] font-bold opacity-70 italic">{measureControls.length} Prüfungen</span>
                  </div>
                  {isEffective ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-none shadow-xl bg-slate-900 text-white overflow-hidden">
            <CardContent className="p-8 space-y-6">
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-headline font-black uppercase">TOM Compliance</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Nachweis-Integrität</p>
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-emerald-400">
                  <span>Reifegrad</span>
                  <span className="text-emerald-400">{isEffective ? '100%' : '0%'}</span>
                </div>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className={cn("h-full transition-all", isEffective ? "w-full bg-emerald-500" : "w-0 bg-amber-500")} />
                </div>
                <p className="text-[9px] text-slate-400 leading-relaxed italic">
                  Maßnahmen gelten erst dann als compliance-konform, wenn im Kontroll-Monitoring mindestens eine wirksame Prüfung vorliegt.
                </p>
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="lg:col-span-3">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-slate-100 p-1 h-11 rounded-xl border w-full justify-start gap-1 shadow-inner">
              <TabsTrigger value="overview" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Info className="w-3.5 h-3.5" /> Überblick & Plan
              </TabsTrigger>
              <TabsTrigger value="risks" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <TargetIcon className="w-3.5 h-3.5 text-accent" /> Risikobezug ({linkedRisks.length})
              </TabsTrigger>
              <TabsTrigger value="assets" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Server className="w-3.5 h-3.5 text-indigo-600" /> Systembezug ({linkedResources.length})
              </TabsTrigger>
              <TabsTrigger value="controls" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" /> Kontrollen ({measureControls.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6">
                  <CardTitle className="text-sm font-bold">Strategische Zielsetzung</CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Beschreibung der Maßnahme</Label>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-inner italic">
                      "{measure.description || 'Keine detaillierte Maßnahmenbeschreibung hinterlegt.'}"
                    </p>
                  </div>
                  {measure.notes && (
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Zusätzliche Anmerkungen</Label>
                      <p className="text-xs text-slate-500 leading-relaxed">{measure.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="risks" className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {linkedRisks.map(risk => (
                  <div key={risk.id} className="p-4 bg-white border rounded-2xl flex items-center justify-between group hover:border-accent/30 transition-all cursor-pointer shadow-sm" onClick={() => router.push(`/risks/${risk.id}`)}>
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner",
                        (risk.impact * risk.probability) >= 15 ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"
                      )}>
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase text-slate-400">{risk.category}</p>
                        <p className="text-xs font-bold text-slate-800 truncate max-w-[200px]">{risk.title}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-accent transition-all" />
                  </div>
                ))}
                {linkedRisks.length === 0 && (
                  <div className="col-span-full py-20 text-center opacity-30 italic text-xs uppercase tracking-widest">Keine Risiken zugeordnet</div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="assets" className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {linkedResources.map(res => (
                  <div key={res.id} className="p-4 bg-white border rounded-2xl flex items-center justify-between group hover:border-indigo-300 transition-all cursor-pointer shadow-sm" onClick={() => router.push(`/resources/${res.id}`)}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-inner">
                        <Server className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{res.name}</p>
                        <Badge variant="outline" className="text-[7px] font-black h-3.5 px-1 uppercase border-none bg-slate-50">{res.assetType}</Badge>
                      </div>
                    </div>
                    <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-indigo-600" />
                  </div>
                ))}
                {linkedResources.length === 0 && (
                  <div className="col-span-full py-20 text-center opacity-30 italic text-xs uppercase tracking-widest">Keine IT-Systeme verknüpft</div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="controls" className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 gap-3">
                {measureControls.map(ctrl => (
                  <div key={ctrl.id} className="p-5 bg-white border rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-center gap-5">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shadow-inner border",
                        ctrl.isEffective ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                      )}>
                        <BadgeCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">{ctrl.title}</h4>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Clock className="w-3 h-3" /> Letzter Check: {ctrl.lastCheckDate || 'N/A'}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><UserIcon className="w-3 h-3" /> {ctrl.owner}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={cn(
                        "rounded-full font-black text-[9px] h-6 px-3 border-none",
                        ctrl.isEffective ? "bg-emerald-500 text-white" : "bg-red-50 text-red-600"
                      )}>{ctrl.isEffective ? 'WIRKSAM' : 'LÜCKENHAFT'}</Badge>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl group-hover:bg-slate-50" onClick={() => router.push('/risks/controls')}>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="pt-4 flex justify-center">
                  <Button variant="outline" className="rounded-xl h-10 px-8 font-bold text-[10px] uppercase tracking-widest gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => router.push(`/risks/controls?measureId=${id}`)}>
                    <Plus className="w-3.5 h-3.5" /> Neuen Prüfprozess anlegen
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
