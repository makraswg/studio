
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  PieChart as PieChartIcon, 
  BarChart3, 
  Download, 
  RefreshCw, 
  Scale, 
  ShieldCheck, 
  FileText,
  TrendingUp,
  AlertTriangle,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  Legend
} from 'recharts';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { cn } from '@/lib/utils';
import { Risk, RiskMeasure } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export default function RiskReportsPage() {
  const { activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);

  const { data: risks, isLoading: risksLoading, refresh: refreshRisks } = usePluggableCollection<Risk>('risks');
  const { data: measures, isLoading: measuresLoading } = usePluggableCollection<RiskMeasure>('riskMeasures');

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredRisks = useMemo(() => {
    if (!risks) return [];
    return risks.filter(r => activeTenantId === 'all' || r.tenantId === activeTenantId);
  }, [risks, activeTenantId]);

  const stats = useMemo(() => {
    const total = filteredRisks.length;
    const scores = filteredRisks.map(r => r.impact * r.probability);
    const critical = scores.filter(s => s >= 15).length;
    const medium = scores.filter(s => s >= 8 && s < 15).length;
    const low = scores.filter(s => s < 8).length;

    const categories = Array.from(new Set(filteredRisks.map(r => r.category)));
    const catData = categories.map(cat => ({
      name: cat,
      count: filteredRisks.filter(r => r.category === cat).length
    }));

    return { total, critical, medium, low, catData };
  }, [filteredRisks]);

  const riskPieData = [
    { name: 'Kritisch', value: stats.critical, color: '#ef4444' },
    { name: 'Mittel', value: stats.medium, color: '#f59e0b' },
    { name: 'Gering', value: stats.low, color: '#10b981' },
  ].filter(d => d.value > 0);

  if (!mounted) return null;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center border-2 border-primary/20">
            <PieChartIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight uppercase font-headline">Berichte & Analyse</h1>
            <p className="text-sm text-muted-foreground mt-1">Aggregierte Auswertung der Compliance-Risikolandschaft.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-10 font-bold uppercase text-[10px] rounded-none" onClick={() => refreshRisks()}>
            <RefreshCw className="w-3.5 h-3.5 mr-2" /> Daten aktualisieren
          </Button>
          <Button size="sm" className="h-10 font-bold uppercase text-[10px] rounded-none bg-slate-900 text-white">
            <Download className="w-4 h-4 mr-2" /> PDF Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Heatmap Area */}
        <Card className="lg:col-span-2 rounded-none border shadow-none">
          <CardHeader className="bg-muted/10 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <Scale className="w-4 h-4 text-orange-600" /> Risiko-Matrix (Management View)
                </CardTitle>
                <CardDescription className="text-[9px] uppercase font-bold mt-1">Eintrittswahrscheinlichkeit vs. Schadenshöhe</CardDescription>
              </div>
              <Badge variant="outline" className="rounded-none bg-white text-[10px] font-black">{stats.total} Risiken</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-[40px_repeat(5,1fr)] gap-2 aspect-[4/3] max-w-2xl mx-auto">
              <div className="row-span-5 flex flex-col justify-between text-[8px] font-black text-slate-400 uppercase py-4 pr-2 text-right">
                <span>Hoch</span>
                <span>Mittel</span>
                <span>Gering</span>
              </div>
              <div className="col-span-5 grid grid-cols-5 grid-rows-5 gap-2">
                {Array.from({ length: 25 }).map((_, i) => {
                  const x = (i % 5) + 1;
                  const y = 5 - Math.floor(i / 5);
                  const score = x * y;
                  const cellRisks = filteredRisks.filter(r => r.impact === y && r.probability === x);
                  
                  return (
                    <div 
                      key={i} 
                      className={cn(
                        "flex items-center justify-center border text-[10px] font-bold transition-all relative",
                        score >= 15 ? "bg-red-100/80 border-red-200" : score >= 8 ? "bg-orange-100/80 border-orange-200" : "bg-emerald-100/80 border-emerald-200",
                        cellRisks.length > 0 ? "shadow-md ring-1 ring-black/5" : "opacity-30 grayscale-[50%]"
                      )}
                    >
                      {cellRisks.length > 0 && (
                        <div className="bg-slate-900 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-black shadow-xl animate-in zoom-in">
                          {cellRisks.length}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="col-start-2 col-span-5 flex justify-between text-[8px] font-black text-slate-400 uppercase px-4 pt-2">
                <span>Selten</span>
                <span>Mittel</span>
                <span>Häufig</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Distribution Charts */}
        <div className="space-y-8">
          <Card className="rounded-none border shadow-none">
            <CardHeader className="bg-muted/10 border-b py-3">
              <CardTitle className="text-xs font-bold uppercase tracking-widest">Risikoklassen</CardTitle>
            </CardHeader>
            <CardContent className="p-6 h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={riskPieData} 
                    innerRadius={60} 
                    outerRadius={80} 
                    paddingAngle={5} 
                    dataKey="value"
                    stroke="none"
                  >
                    {riskPieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <RechartsTooltip />
                  <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-none border shadow-none">
            <CardHeader className="bg-muted/10 border-b py-3">
              <CardTitle className="text-xs font-bold uppercase tracking-widest">Top Kategorien</CardTitle>
            </CardHeader>
            <CardContent className="p-6 h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.catData} layout="vertical" margin={{ left: -10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={80} style={{ fontSize: '8px', fontWeight: 'bold' }} />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Summary Table */}
      <Card className="rounded-none border shadow-none">
        <CardHeader className="bg-slate-900 text-white py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-widest">Detaillierte Risikoübersicht</CardTitle>
            <div className="flex gap-4 text-[10px] font-bold uppercase">
              <div className="flex items-center gap-2 text-red-400"><div className="w-2 h-2 bg-red-400" /> Kritisch</div>
              <div className="flex items-center gap-2 text-orange-400"><div className="w-2 h-2 bg-orange-400" /> Mittel</div>
              <div className="flex items-center gap-2 text-emerald-400"><div className="w-2 h-2 bg-emerald-400" /> Gering</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b">
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500">Risiko / Kategorie</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500 text-center">Score</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500">Status</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500">Verantwortung</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500">Letzter Review</th>
                </tr>
              </thead>
              <tbody>
                {filteredRisks.map(r => {
                  const score = r.impact * r.probability;
                  const colorClass = score >= 15 ? "text-red-600" : score >= 8 ? "text-orange-600" : "text-emerald-600";
                  return (
                    <tr key={r.id} className="border-b hover:bg-muted/5 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-sm">{r.title}</div>
                        <div className="text-[9px] font-black text-slate-400 uppercase mt-0.5">{r.category}</div>
                      </td>
                      <td className="p-4 text-center">
                        <div className={cn("inline-block w-8 h-8 leading-8 font-black rounded-none border text-xs", colorClass, "bg-white border-slate-200 shadow-sm")}>
                          {score}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="rounded-none uppercase text-[8px] font-bold border-slate-200">
                          {r.status}
                        </Badge>
                      </td>
                      <td className="p-4 font-bold text-xs uppercase text-slate-600">{r.owner}</td>
                      <td className="p-4 text-xs font-mono text-slate-400">
                        {r.lastReviewDate ? new Date(r.lastReviewDate).toLocaleDateString() : 'Ausstehend'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
