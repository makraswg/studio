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
  ArrowUpRight,
  ChevronRight,
  X,
  Search,
  Filter,
  MousePointer2
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
  const [selectedCell, setSelectedCell] = useState<{ impact: number, probability: number } | null>(null);

  const { data: risks, isLoading: risksLoading, refresh: refreshRisks } = usePluggableCollection<Risk>('risks');
  const { data: measures, isLoading: measuresLoading } = usePluggableCollection<RiskMeasure>('riskMeasures');

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredRisks = useMemo(() => {
    if (!risks) return [];
    return risks.filter(r => activeTenantId === 'all' || r.tenantId === activeTenantId);
  }, [risks, activeTenantId]);

  const displayRisks = useMemo(() => {
    if (!selectedCell) return filteredRisks;
    return filteredRisks.filter(r => r.impact === selectedCell.impact && r.probability === selectedCell.probability);
  }, [filteredRisks, selectedCell]);

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
    })).sort((a, b) => b.count - a.count);

    return { total, critical, medium, low, catData };
  }, [filteredRisks]);

  const riskPieData = [
    { name: 'Kritisch', value: stats.critical, color: '#ef4444' },
    { name: 'Mittel', value: stats.medium, color: '#FF9800' },
    { name: 'Gering', value: stats.low, color: '#10b981' },
  ].filter(d => d.value > 0);

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center rounded-lg border shadow-sm">
            <PieChartIcon className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-black uppercase tracking-wider">Analysis & Reporting</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase">Risk Intelligence</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Aggregierte Auswertung der Bedrohungslage.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold uppercase text-[9px] tracking-wider px-4 border-slate-200" onClick={() => refreshRisks()}>
            <RefreshCw className="w-3.5 h-3.5 mr-2" /> Sync
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold uppercase text-[10px] tracking-wider px-6 bg-slate-900 text-white shadow-sm">
            <Download className="w-3.5 h-3.5 mr-2" /> PDF Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Heatmap Matrix */}
        <Card className="lg:col-span-2 border shadow-sm bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
          <CardHeader className="border-b py-4 px-6 flex flex-row items-center justify-between bg-slate-50/50">
            <div>
              <CardTitle className="text-sm font-headline font-bold text-slate-800 uppercase tracking-tight">Risiko-Matrix</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {selectedCell && (
                <Button variant="ghost" size="sm" className="h-6 text-[8px] font-black uppercase text-primary hover:bg-primary/5 rounded-sm" onClick={() => setSelectedCell(null)}>Reset</Button>
              )}
              <Badge variant="outline" className="rounded-full bg-white text-slate-500 border-none font-black text-[9px] h-5 px-2">{stats.total} Items</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6 md:p-10">
            <div className="grid grid-cols-[30px_repeat(5,1fr)] gap-2 aspect-[4/3] max-w-xl mx-auto">
              <div className="row-span-5 flex flex-col justify-between text-[8px] font-black text-slate-400 uppercase py-4 pr-2 text-right">
                <span className="text-red-500">Impact</span>
                <span></span>
                <span className="text-emerald-500">Low</span>
              </div>
              <div className="col-span-5 grid grid-cols-5 grid-rows-5 gap-2">
                {Array.from({ length: 25 }).map((_, i) => {
                  const x = (i % 5) + 1;
                  const y = 5 - Math.floor(i / 5);
                  const score = x * y;
                  const cellRisks = filteredRisks.filter(r => r.impact === y && r.probability === x);
                  const isSelected = selectedCell?.impact === y && selectedCell?.probability === x;
                  
                  return (
                    <div 
                      key={i} 
                      onClick={() => cellRisks.length > 0 && setSelectedCell({ impact: y, probability: x })}
                      className={cn(
                        "flex items-center justify-center border rounded-lg transition-all relative group cursor-pointer active:scale-95",
                        score >= 15 ? "bg-red-50/50 border-red-100" : score >= 8 ? "bg-orange-50/50 border-orange-100" : "bg-emerald-50/50 border-emerald-100",
                        cellRisks.length > 0 ? "shadow-sm border-white" : "opacity-20 grayscale cursor-default",
                        isSelected && "ring-2 ring-primary ring-offset-2 z-10 border-primary"
                      )}
                    >
                      {cellRisks.length > 0 && (
                        <div className={cn(
                          "w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-black shadow-sm",
                          score >= 15 ? "bg-red-600 text-white" : score >= 8 ? "bg-accent text-white" : "bg-emerald-600 text-white"
                        )}>
                          {cellRisks.length}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="col-start-2 col-span-5 flex justify-between text-[8px] font-black text-slate-400 uppercase px-4 pt-2">
                <span>Selten</span>
                <span>Wahrscheinlichkeit</span>
                <span>Häufig</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts Sidebar */}
        <div className="space-y-6">
          <Card className="border shadow-sm bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
            <CardHeader className="border-b py-3 px-6 bg-slate-50/50">
              <CardTitle className="text-[10px] font-headline font-bold uppercase tracking-widest">Risikoklassen</CardTitle>
            </CardHeader>
            <CardContent className="p-6 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={riskPieData} innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value" stroke="none">
                    {riskPieData.map((entry, index) => <Cell key={index} fill={entry.color} cornerRadius={4} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '9px', fontWeight: 'bold' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
            <CardHeader className="border-b py-3 px-6 bg-slate-50/50">
              <CardTitle className="text-[10px] font-headline font-bold uppercase tracking-widest">Kategorien</CardTitle>
            </CardHeader>
            <CardContent className="p-6 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.catData} layout="vertical" margin={{ left: -20, right: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" style={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' }} tickLine={false} axisLine={false} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Drill-down List */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-slate-900 text-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/20 rounded-md flex items-center justify-center text-primary shadow-sm">
              <MousePointer2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-sm uppercase tracking-wider">Detail-Analyse</h3>
              <p className="text-[8px] font-bold text-slate-400 uppercase">
                {selectedCell ? `Filter: Impact ${selectedCell.impact} / Prob ${selectedCell.probability}` : 'Gesamtliste'}
              </p>
            </div>
          </div>
          {selectedCell && (
            <Button variant="outline" size="sm" className="h-8 rounded-md bg-white/10 border-white/20 hover:bg-white/20 text-white text-[9px] font-black uppercase px-4" onClick={() => setSelectedCell(null)}>Filter entfernen</Button>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b">
                <th className="p-4 px-6 text-[9px] font-black uppercase tracking-wider text-slate-400">Risiko-Szenario</th>
                <th className="p-4 text-[9px] font-black uppercase tracking-wider text-slate-400 text-center">Score</th>
                <th className="p-4 text-[9px] font-black uppercase tracking-wider text-slate-400">Kategorie</th>
                <th className="p-4 px-6 text-right text-[9px] font-black uppercase tracking-wider text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayRisks.map(r => {
                const score = r.impact * r.probability;
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors group">
                    <td className="p-4 px-6">
                      <div className="font-bold text-xs text-slate-800">{r.title}</div>
                      <div className="text-[8px] font-black text-slate-400 uppercase mt-0.5">Ref: {r.id}</div>
                    </td>
                    <td className="p-4 text-center">
                      <Badge className={cn(
                        "rounded-md h-6 w-8 font-black text-[10px] border-none shadow-sm",
                        score >= 15 ? "bg-red-50 text-red-600" : score >= 8 ? "bg-orange-50 text-orange-600" : "bg-emerald-50 text-emerald-600"
                      )}>
                        {score}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <span className="text-[9px] font-black uppercase text-slate-500">{r.category}</span>
                    </td>
                    <td className="p-4 px-6 text-right">
                      <Badge variant="outline" className="rounded-full uppercase text-[8px] font-black border-slate-200 h-5 px-2">
                        {r.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
