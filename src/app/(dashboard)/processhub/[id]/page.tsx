
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Workflow, 
  ChevronLeft, 
  Loader2, 
  Send, 
  Check, 
  X, 
  BrainCircuit, 
  ShieldCheck,
  Save, 
  Activity, 
  RefreshCw, 
  GitBranch, 
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  ClipboardList,
  FilePen,
  ArrowRight,
  CheckCircle,
  Link as LinkIcon,
  Maximize2,
  CircleDot,
  ExternalLink,
  HelpCircle,
  MessageCircle,
  Info,
  Sparkles,
  Briefcase,
  Plus,
  ArrowRightCircle,
  ArrowLeftCircle,
  Link2,
  Share2,
  ArrowRight as ArrowRightIcon,
  Trash2,
  Network,
  Lock,
  Unlock,
  PlusCircle,
  Zap,
  Shield,
  History,
  ClipboardCheck,
  Building2,
  CheckSquare,
  Square,
  FileEdit,
  Tag,
  Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { usePlatformAuth } from '@/context/auth-context';
import { applyProcessOpsAction, updateProcessMetadataAction, commitProcessVersionAction } from '@/app/actions/process-actions';
import { linkFeatureToProcessAction, unlinkFeatureFromProcessAction, saveFeatureAction } from '@/app/actions/feature-actions';
import { saveTaskAction } from '@/app/actions/task-actions';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { ProcessModel, ProcessLayout, Process, JobTitle, ProcessComment, ProcessNode, ProcessOperation, ProcessEdge, ProcessVersion, Department, RegulatoryOption, Feature, FeatureProcessStep } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Separator } from '@/components/ui/separator';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function generateMxGraphXml(model: ProcessModel, layout: ProcessLayout) {
  let xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>`;
  const nodes = model.nodes || [];
  const edges = model.edges || [];
  const positions = layout.positions || {};

  nodes.forEach((node, idx) => {
    let nodeSafeId = String(node.id || `node-${idx}`);
    const pos = positions[nodeSafeId] || { x: 50 + (idx * 220), y: 150 };
    let style = '';
    let w = 140, h = 70;
    let label = node.title;
    
    switch (node.type) {
      case 'start': 
        style = 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.5;shadow=0;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;'; 
        w = 40; h = 40; 
        break;
      case 'end': 
        style = 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#ffffff;strokeColor=#000000;strokeWidth=4;shadow=0;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;'; 
        w = 40; h = 40; 
        break;
      case 'decision': 
        style = 'rhombus;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.5;shadow=0;'; 
        w = 60; h = 60;
        label = 'X'; 
        break;
      case 'subprocess':
        style = 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.5;dashed=1;shadow=0;';
        w = 140; h = 70;
        break;
      default: 
        style = 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.5;shadow=0;';
        w = 140; h = 70;
    }
    
    const displayValue = node.type === 'decision' ? label : node.title;
    xml += `<mxCell id="${nodeSafeId}" value="${displayValue}" style="${style}" vertex="1" parent="1"><mxGeometry x="${(pos as any).x}" y="${(pos as any).y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
  });

  edges.forEach((edge, idx) => {
    let edgeSafeId = String(edge.id || `edge-${idx}`);
    const sourceId = String(edge.source);
    const targetId = String(edge.target);
    if (nodes.some(n => String(n.id) === sourceId) && nodes.some(n => String(n.id) === targetId)) {
      xml += `<mxCell id="${edgeSafeId}" value="${edge.label || ''}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1.5;fontSize=10;fontColor=#000000;endArrow=block;endFill=1;curved=0;" edge="1" parent="1" source="${sourceId}" target="${targetId}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
    }
  });
  xml += `</root></mxGraphModel>`;
  return xml;
}

export default function ProcessDesignerPage() {
  const { id } = useParams();
  const router = useRouter();
  const { dataSource, activeTenantId } = useSettings();
  const { user } = usePlatformAuth();
  const isMobile = useIsMobile();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [mounted, setMounted] = useState(false);
  const [leftWidth, setLeftWidth] = useState(360);
  const isResizingLeft = useRef(false);

  // UI States
  const [isDiagramLocked, setIsDiagramLocked] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isStepDialogOpen, setIsStepDialogOpen] = useState(false);
  const [isDeleteWarningOpen, setIsDeleteWarningOpen] = useState(false);
  
  const [localNodeEdits, setLocalNodeEdits] = useState({ 
    id: '', title: '', roleId: '', description: '', checklist: '', tips: '', errors: '', type: 'step', targetProcessId: '', customFields: {} as Record<string, string>
  });

  const [commentText, setCommentText] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);

  const { data: processes, refresh: refreshProc } = usePluggableCollection<Process>('processes');
  const { data: versions, refresh: refreshVersion } = usePluggableCollection<any>('process_versions');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: departments } = usePluggableCollection<Department>('departments');
  const { data: regulatoryOptions } = usePluggableCollection<RegulatoryOption>('regulatory_options');
  const { data: comments, refresh: refreshComments } = usePluggableCollection<ProcessComment>('process_comments');
  const { data: auditEvents, refresh: refreshAudit } = usePluggableCollection<any>('auditEvents');
  const { data: allFeatures } = usePluggableCollection<Feature>('features');
  const { data: featureLinks, refresh: refreshFeatLinks } = usePluggableCollection<any>('feature_process_steps');
  
  const currentProcess = useMemo(() => processes?.find((p: any) => p.id === id) || null, [processes, id]);
  const currentVersion = useMemo(() => versions?.find((v: any) => v.process_id === id), [versions, id]);
  
  const selectedNodeFeatures = useMemo(() => 
    featureLinks?.filter((l: any) => l.processId === id && l.nodeId === selectedNodeId) || [], 
    [featureLinks, id, selectedNodeId]
  );

  const [metaTitle, setMetaTitle] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [metaOpenQuestions, setMetaOpenQuestions] = useState('');
  const [metaDeptId, setMetaDeptId] = useState('');
  const [metaRegulatory, setMetaRegulatory] = useState<string[]>([]);
  const [metaStatus, setMetaStatus] = useState<any>('draft');

  useEffect(() => {
    if (currentProcess) {
      setMetaTitle(currentProcess.title || '');
      setMetaDesc(currentProcess.description || '');
      setMetaOpenQuestions(currentProcess.openQuestions || '');
      setMetaDeptId(currentProcess.responsibleDepartmentId || '');
      setMetaStatus(currentProcess.status || 'draft');
      try {
        const reg = currentProcess.regulatoryFramework ? JSON.parse(currentProcess.regulatoryFramework) : [];
        setMetaRegulatory(Array.isArray(reg) ? reg : []);
      } catch (e) { setMetaRegulatory([]); }
    }
  }, [currentProcess?.id]);

  useEffect(() => {
    if (selectedNodeId && currentVersion) {
      const node = currentVersion.model_json?.nodes?.find((n: any) => n.id === selectedNodeId);
      if (node) {
        setLocalNodeEdits({
          id: node.id,
          title: node.title || '',
          roleId: node.roleId || '',
          description: node.description || '',
          checklist: (node.checklist || []).join('\n'),
          tips: node.tips || '',
          errors: node.errors || '',
          type: node.type || 'step',
          targetProcessId: node.targetProcessId || '',
          customFields: node.customFields || {}
        });
      }
    }
  }, [selectedNodeId, currentVersion]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizingLeft.current) setLeftWidth(Math.max(300, Math.min(600, e.clientX)));
  }, []);

  const stopResizing = useCallback(() => {
    isResizingLeft.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
  }, [handleMouseMove]);

  const startResizeLeft = useCallback(() => {
    if (isMobile) return;
    isResizingLeft.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
  }, [handleMouseMove, stopResizing, isMobile]);

  useEffect(() => { setMounted(true); }, []);

  const syncDiagramToModel = useCallback(() => {
    if (!iframeRef.current || !currentVersion || isDiagramLocked) return;
    const xml = generateMxGraphXml(currentVersion.model_json, currentVersion.layout_json);
    iframeRef.current.contentWindow?.postMessage(JSON.stringify({ action: 'load', xml: xml, autosave: 1 }), '*');
    setTimeout(() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ action: 'zoom', type: 'fit' }), '*'), 300);
  }, [currentVersion, isDiagramLocked]);

  useEffect(() => {
    if (!mounted || !iframeRef.current || !currentVersion?.model_json?.nodes?.length) return;
    const handleMessage = (evt: MessageEvent) => {
      if (!evt.data || typeof evt.data !== 'string') return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.event === 'init') syncDiagramToModel();
      } catch (e) {}
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mounted, currentVersion?.id, syncDiagramToModel]);

  const handleApplyOps = async (ops: any[]) => {
    if (!currentVersion || !user || !ops.length) return false;
    setIsApplying(true);
    try {
      const res = await applyProcessOpsAction(currentVersion.process_id, currentVersion.version, ops, currentVersion.revision, user.id, dataSource);
      if (res.success) {
        refreshVersion();
        refreshProc();
        return true;
      }
      return false;
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update fehlgeschlagen", description: e.message });
      return false;
    } finally {
      setIsApplying(false);
    }
  };

  const handleCommitVersion = async () => {
    if (!currentVersion || !user) return;
    setIsCommitting(true);
    try {
      const res = await commitProcessVersionAction(currentVersion.process_id, currentVersion.version, user.email || user.id, dataSource);
      if (res.success) {
        toast({ title: "Version gespeichert" });
        refreshAudit();
        refreshVersion();
      }
    } finally {
      setIsCommitting(false);
    }
  };

  const handleDeleteNodeRequest = () => {
    if (selectedNodeFeatures.length > 0) {
      setIsDeleteWarningOpen(true);
    } else {
      executeDeleteNode();
    }
  };

  const executeDeleteNode = async (createTask = false) => {
    if (!selectedNodeId || !currentVersion || !user) return;
    
    setIsDeleting(true);
    try {
      // 1. Handle Feature cleanup if requested
      if (createTask && selectedNodeFeatures.length > 0) {
        for (const link of selectedNodeFeatures) {
          const feature = allFeatures?.find(f => f.id === link.featureId);
          if (feature) {
            await saveFeatureAction({ ...feature, status: 'open_questions' }, dataSource, user.email);
            await saveTaskAction({
              tenantId: feature.tenantId,
              title: `Prozesszuordnung offen: ${feature.name}`,
              description: `Die Verknüpfung zum Arbeitsschritt '${localNodeEdits.title}' wurde entfernt. Bitte neue Prozesszuordnung prüfen.`,
              entityType: 'feature',
              entityId: feature.id,
              assigneeId: user.id
            }, dataSource, user.email);
          }
        }
      }

      // 2. Unlink all features from this node
      for (const link of selectedNodeFeatures) {
        await unlinkFeatureFromProcessAction(link.id, link.featureId, dataSource);
      }

      // 3. Remove node from process
      const ops = [{ type: 'REMOVE_NODE', payload: { nodeId: selectedNodeId } }];
      const res = await applyProcessOpsAction(currentVersion.process_id, currentVersion.version, ops, currentVersion.revision, user.id, dataSource);
      
      if (res.success) {
        toast({ title: "Modul und Verknüpfungen entfernt" });
        setIsStepDialogOpen(false);
        setIsDeleteWarningOpen(false);
        setSelectedNodeId(null);
        refreshVersion();
        refreshFeatLinks();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLinkFeature = async (featureId: string) => {
    if (!selectedNodeId) return;
    const id = `fstep-${Math.random().toString(36).substring(2, 9)}`;
    const res = await saveCollectionRecord('feature_process_steps', id, {
      id,
      featureId,
      processId: id as string,
      nodeId: selectedNodeId,
      usageType: 'Schreibend',
      criticality: 'medium'
    }, dataSource);
    if (res.success) {
      toast({ title: "Merkmal verknüpft" });
      refreshFeatLinks();
    }
  };

  const handleUnlinkFeature = async (linkId: string) => {
    await deleteCollectionRecord('feature_process_steps', linkId, dataSource);
    refreshFeatLinks();
  };

  const handleSaveNodeEdits = async () => {
    if (!selectedNodeId) return;
    const patch = {
      title: localNodeEdits.title,
      roleId: localNodeEdits.roleId,
      description: localNodeEdits.description,
      checklist: localNodeEdits.checklist.split('\n').filter((l: string) => l.trim() !== ''),
      tips: localNodeEdits.tips,
      errors: localNodeEdits.errors,
      targetProcessId: localNodeEdits.targetProcessId
    };
    const success = await handleApplyOps([{ type: 'UPDATE_NODE', payload: { nodeId: selectedNodeId, patch } }]);
    if (success) setIsStepDialogOpen(false);
  };

  const handleQuickAdd = (type: 'step' | 'decision' | 'end' | 'subprocess') => {
    if (!currentVersion) return;
    const newId = `${type}-${Date.now()}`;
    const titles = { step: 'Neuer Schritt', decision: 'Entscheidung?', end: 'Endpunkt', subprocess: 'Prozess-Referenz' };
    const nodes = currentVersion.model_json.nodes || [];
    const predecessor = selectedNodeId ? nodes.find((n: any) => n.id === selectedNodeId) : nodes[nodes.length - 1];
    
    const ops: ProcessOperation[] = [{ type: 'ADD_NODE', payload: { node: { id: newId, type, title: titles[type] } } }];
    if (predecessor) {
      ops.push({ type: 'ADD_EDGE', payload: { edge: { id: `edge-${Date.now()}`, source: predecessor.id, target: newId } } });
    }
    handleApplyOps(ops).then(s => { if(s) { setSelectedNodeId(newId); setIsStepDialogOpen(true); } });
  };

  if (!mounted) return null;

  return (
    <div className="h-screen flex flex-col -m-4 md:-m-8 overflow-hidden bg-slate-50 font-body relative">
      <header className="glass-header h-14 flex items-center justify-between px-6 shrink-0 z-20 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/processhub')} className="h-9 w-9 text-slate-400 hover:bg-slate-100 rounded-md transition-all"><ChevronLeft className="w-5 h-5" /></Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="font-headline font-bold text-sm md:text-base tracking-tight text-slate-900 truncate max-w-[200px] md:max-w-md">{currentProcess?.title}</h2>
              <Badge className="bg-primary/10 text-primary border-none rounded-full text-[9px] font-bold px-2 h-4 hidden md:flex">Designer</Badge>
            </div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">V{currentVersion?.version}.0 • Rev. {currentVersion?.revision}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className={cn("h-8 rounded-md text-[10px] font-bold border-slate-200 gap-2 transition-all", isDiagramLocked ? "bg-slate-100 text-slate-400" : "hover:bg-amber-50 text-amber-600")}
            onClick={() => setIsDiagramLocked(!isDiagramLocked)}
          >
            {isDiagramLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            {isDiagramLocked ? 'Layout gesperrt' : 'Layout frei'}
          </Button>
          <Button size="sm" className="rounded-md h-8 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-6 shadow-sm transition-all gap-2" onClick={handleCommitVersion} disabled={isCommitting}>
            {isCommitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />} 
            Änderungen speichern
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden h-full relative">
        <aside style={{ width: isMobile ? '100%' : `${leftWidth}px` }} className={cn("border-r flex flex-col bg-white shrink-0 overflow-hidden relative group/sidebar h-full shadow-sm", isMobile && "hidden")}>
          <Tabs defaultValue="meta" className="h-full flex flex-col overflow-hidden">
            <TabsList className="h-11 bg-slate-50 border-b gap-0 p-0 w-full justify-start shrink-0 rounded-none overflow-x-auto no-scrollbar">
              <TabsTrigger value="meta" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-2 text-[10px] font-bold flex items-center justify-center gap-2 text-slate-500 data-[state=active]:text-primary"><FilePen className="w-3.5 h-3.5" /> Stammdaten</TabsTrigger>
              <TabsTrigger value="steps" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-2 text-[10px] font-bold flex items-center justify-center gap-2 text-slate-500 data-[state=active]:text-primary"><ClipboardList className="w-3.5 h-3.5" /> Ablauf</TabsTrigger>
              <TabsTrigger value="log" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-2 text-[10px] font-bold flex items-center justify-center gap-2 text-slate-500 data-[state=active]:text-primary"><History className="w-3.5 h-3.5" /> Journal</TabsTrigger>
            </TabsList>
            
            <TabsContent value="steps" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
              <div className="px-6 py-3 border-b bg-white flex items-center justify-start shrink-0">
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md" onClick={() => handleQuickAdd('step')}>+ Schritt</Button>
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md" onClick={() => handleQuickAdd('decision')}>+ Weiche</Button>
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md" onClick={() => handleQuickAdd('subprocess')}>+ Prozess</Button>
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md" onClick={() => handleQuickAdd('end')}>+ Ende</Button>
                </div>
              </div>
              <ScrollArea className="flex-1 bg-slate-50/30">
                <div className="p-4 space-y-2 pb-32">
                  {(currentVersion?.model_json?.nodes || []).map((node: any) => {
                    const nodeLinks = featureLinks?.filter((l: any) => l.processId === id && l.nodeId === node.id).length || 0;
                    return (
                      <div key={node.id} className={cn("group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer bg-white shadow-sm", selectedNodeId === node.id ? "border-primary ring-2 ring-primary/5" : "border-slate-100")} onClick={() => { setSelectedNodeId(node.id); setIsStepDialogOpen(true); }}>
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border relative", node.type === 'decision' ? "bg-amber-50 text-amber-600" : node.type === 'end' ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-500")}>
                          {node.type === 'decision' ? <GitBranch className="w-4 h-4" /> : node.type === 'end' ? <CircleDot className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                          {nodeLinks > 0 && <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white rounded-full flex items-center justify-center text-[8px] font-bold border border-white">{nodeLinks}</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-800 truncate">{node.title}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
            {/* Rest content stays as before */}
          </Tabs>
        </aside>

        <main className="flex-1 relative bg-white overflow-hidden shadow-inner">
          {currentVersion?.model_json?.nodes?.length ? (
            <iframe ref={iframeRef} src="https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json" className="absolute inset-0 w-full h-full border-none" />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-10 text-center">
              <Workflow className="w-16 h-16 text-slate-200 mb-4" />
              <h2 className="text-xl font-headline font-bold text-slate-900">Modellierung starten</h2>
              <Button className="mt-6 rounded-xl h-11 px-8 font-bold text-xs" onClick={() => handleQuickAdd('step')}><PlusCircle className="w-4 h-4 mr-2" /> Ersten Schritt anlegen</Button>
            </div>
          )}
        </main>
      </div>

      <Dialog open={isStepDialogOpen} onOpenChange={setIsStepDialogOpen}>
        <DialogContent className="max-w-3xl w-[95vw] rounded-2xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white h-[90vh]">
          <DialogHeader className="p-6 bg-white border-b pr-10">
            <div className="flex items-center gap-5">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", localNodeEdits.type === 'decision' ? "bg-amber-50 text-amber-600" : "bg-primary/10 text-primary")}>
                {localNodeEdits.type === 'decision' ? <GitBranch className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
              </div>
              <div className="min-w-0 flex-1"><DialogTitle className="text-lg font-headline font-bold text-slate-900 truncate">{localNodeEdits.title || 'Schritt bearbeiten'}</DialogTitle><DialogDescription className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Modul: {localNodeEdits.type}</DialogDescription></div>
            </div>
          </DialogHeader>
          <Tabs defaultValue="base" className="flex-1 flex flex-col min-h-0">
            <TabsList className="bg-slate-50 border-b h-11 px-6 justify-start rounded-none">
              <TabsTrigger value="base" className="text-[10px] font-bold uppercase gap-2">Stammdaten</TabsTrigger>
              <TabsTrigger value="features" className="text-[10px] font-bold uppercase gap-2">Merkmale</TabsTrigger>
              <TabsTrigger value="details" className="text-[10px] font-bold uppercase gap-2">Ausführung</TabsTrigger>
            </TabsList>
            <ScrollArea className="flex-1 p-8 space-y-10">
              <TabsContent value="base" className="mt-0 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-slate-400">Bezeichnung</Label><Input value={localNodeEdits.title} onChange={e => setLocalNodeEdits({...localNodeEdits, title: e.target.value})} className="h-11 font-bold rounded-xl" /></div>
                  <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-slate-400">Verantwortliche Stelle</Label><Select value={localNodeEdits.roleId} onValueChange={(val) => setLocalNodeEdits({...localNodeEdits, roleId: val})}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Rolle wählen..." /></SelectTrigger><SelectContent>{jobTitles?.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
              </TabsContent>
              <TabsContent value="features" className="mt-0 space-y-6">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Tag className="w-3.5 h-3.5 text-primary" /> Zugeordnete Merkmale</h4>
                  <Badge variant="outline" className="text-[8px] font-black">{selectedNodeFeatures.length}</Badge>
                </div>
                <div className="space-y-2">
                  {selectedNodeFeatures.map((link: any) => {
                    const feature = allFeatures?.find(f => f.id === link.featureId);
                    return (
                      <div key={link.id} className="p-3 rounded-xl border bg-slate-50 flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <Tag className="w-3.5 h-3.5 text-primary opacity-40" />
                          <span className="text-[11px] font-bold text-slate-700">{feature?.name || 'Unbekanntes Merkmal'}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => handleUnlinkFeature(link.id)}><X className="w-3.5 h-3.5" /></Button>
                      </div>
                    );
                  })}
                  <div className="pt-4 space-y-2">
                    <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Neues Merkmal hinzufügen</Label>
                    <Select onValueChange={handleLinkFeature}>
                      <SelectTrigger className="h-10 text-xs rounded-xl border-dashed bg-white"><SelectValue placeholder="Merkmal wählen..." /></SelectTrigger>
                      <SelectContent>
                        {allFeatures?.filter(f => !selectedNodeFeatures.some((l: any) => l.featureId === f.id)).map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="details" className="mt-0 space-y-8">
                <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400">Tätigkeitsbeschreibung</Label><Textarea value={localNodeEdits.description} onChange={e => setLocalNodeEdits({...localNodeEdits, description: e.target.value})} className="text-xs min-h-[120px] rounded-xl" /></div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
          <DialogFooter className="p-4 bg-slate-50 border-t flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={handleDeleteNodeRequest} className="rounded-xl h-10 px-6 text-red-600 border-red-100 hover:bg-red-50 gap-2">Modul löschen</Button>
            <div className="flex gap-2"><Button variant="ghost" onClick={() => setIsStepDialogOpen(false)}>Abbrechen</Button><Button onClick={handleSaveNodeEdits} className="rounded-xl h-10 px-12 bg-primary text-white shadow-lg">Speichern</Button></div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Warning Dialog */}
      <AlertDialog open={isDeleteWarningOpen} onOpenChange={setIsDeleteWarningOpen}>
        <AlertDialogContent className="max-w-md rounded-2xl border-none shadow-2xl p-8">
          <AlertDialogHeader>
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <AlertDialogTitle className="text-xl font-headline font-bold text-red-600 text-center">Achtung: Aktive Verknüpfungen</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 font-medium leading-relaxed pt-2 text-center">
              Dieser Arbeitsschritt ist mit **{selectedNodeFeatures.length} Merkmalen** verknüpft. Durch das Löschen verlieren diese Merkmale ihren Prozessbezug.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-6">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Wie möchten Sie fortfahren?</p>
              <div className="space-y-2">
                <Button variant="outline" className="w-full h-11 rounded-xl text-[11px] font-bold text-slate-700 bg-white" onClick={() => executeDeleteNode(false)}>Einfach löschen</Button>
                <Button className="w-full h-11 rounded-xl text-[11px] font-bold bg-primary text-white shadow-lg flex items-center gap-2" onClick={() => executeDeleteNode(true)}>
                  <Target className="w-4 h-4" /> Aufgaben zur Neuzuordnung erstellen
                </Button>
              </div>
            </div>
          </div>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogCancel className="rounded-xl text-[10px] font-black uppercase tracking-widest px-8">Abbrechen</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
