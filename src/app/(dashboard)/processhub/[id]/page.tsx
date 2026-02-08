
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Workflow, 
  ChevronLeft, 
  Loader2, 
  Save, 
  Activity, 
  RefreshCw, 
  GitBranch, 
  Trash2,
  Network,
  Lock,
  Unlock,
  PlusCircle,
  Zap,
  ClipboardList,
  Building2,
  CheckCircle,
  FileStack,
  Upload,
  Server,
  Tag,
  Settings2,
  Clock,
  ListChecks,
  AlertCircle,
  Lightbulb,
  FileCheck,
  UserCircle,
  ArrowUp,
  ArrowDown,
  Info,
  Search,
  Briefcase
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
import { linkFeatureToProcessAction, unlinkFeatureFromProcessAction } from '@/app/actions/feature-actions';
import { saveTaskAction } from '@/app/actions/task-actions';
import { saveMediaAction, deleteMediaAction } from '@/app/actions/media-actions';
import { runOcrAction } from '@/ai/flows/ocr-flow';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { ProcessModel, ProcessLayout, Process, JobTitle, ProcessNode, ProcessOperation, ProcessVersion, Department, RegulatoryOption, Feature, MediaFile, Resource, Task, PlatformUser, ProcessingActivity, DataSubjectGroup, DataCategory } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { AiFormAssistant } from '@/components/ai/form-assistant';

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
    const sourceId = String(edge.source);
    const targetId = String(edge.target);
    if (nodes.some(n => String(n.id) === sourceId) && nodes.some(n => String(n.id) === targetId)) {
      xml += `<mxCell id="${edge.id || `edge-${idx}`}" value="${edge.label || ''}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1.5;fontSize=10;fontColor=#000000;endArrow=block;endFill=1;curved=0;" edge="1" parent="1" source="${sourceId}" target="${targetId}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
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
  const [leftWidth, setLeftWidth] = useState(380);

  // UI States
  const [isDiagramLocked, setIsDiagramLocked] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isStepDialogOpen, setIsStepDialogOpen] = useState(false);
  const [resSearch, setResSearch] = useState('');
  
  const [localNodeEdits, setLocalNodeEdits] = useState({ 
    id: '', title: '', roleId: '', description: '', checklist: '', tips: '', errors: '', type: 'step', targetProcessId: '', resourceIds: [] as string[], featureIds: [] as string[], subjectGroupIds: [] as string[], dataCategoryIds: [] as string[], predecessorIds: [] as string[], successorIds: [] as string[], customFields: {} as Record<string, string>
  });

  // Master Data (Stammdaten) Form State
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [metaInputs, setMetaInputs] = useState('');
  const [metaOutputs, setMetaOutputs] = useState('');
  const [metaKpis, setMetaKpis] = useState('');
  const [metaDeptId, setMetaDeptId] = useState('');
  const [metaFramework, setMetaFramework] = useState('');
  const [metaAutomation, setMetaAutomation] = useState<'manual' | 'partial' | 'full'>('manual');
  const [metaVolume, setMetaDataVolume] = useState<'low' | 'medium' | 'high'>('low');
  const [metaFrequency, setMetaFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'on_demand'>('on_demand');
  const [metaTags, setMetaTags] = useState('');
  const [metaQuestions, setMetaQuestions] = useState('');
  const [metaVvtId, setMetaVvtId] = useState('');
  const [metaOwnerRoleId, setMetaOwnerRoleId] = useState('');

  // Task Creation State
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [isSavingTask, setIsSavingTask] = useState(false);

  // Media States
  const [isUploading, setIsUploading] = useState(false);
  const [isOcring, setIsOcring] = useState(false);

  const { data: processes, refresh: refreshProc } = usePluggableCollection<Process>('processes');
  const { data: versions, refresh: refreshVersion } = usePluggableCollection<any>('process_versions');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: allFeatures } = usePluggableCollection<Feature>('features');
  const { data: mediaFiles, refresh: refreshMedia } = usePluggableCollection<MediaFile>('media');
  const { data: featureLinks, refresh: refreshFeatureLinks } = usePluggableCollection<any>('feature_process_steps');
  const { data: tasks, refresh: refreshTasks } = usePluggableCollection<Task>('tasks');
  const { data: pUsers } = usePluggableCollection<PlatformUser>('platformUsers');
  const { data: departments } = usePluggableCollection<Department>('departments');
  const { data: regulatoryOptions } = usePluggableCollection<RegulatoryOption>('regulatory_options');
  const { data: vvts } = usePluggableCollection<ProcessingActivity>('processingActivities');
  const { data: subjectGroups } = usePluggableCollection<DataSubjectGroup>('dataSubjectGroups');
  const { data: dataCategories } = usePluggableCollection<DataCategory>('dataCategories');
  
  const currentProcess = useMemo(() => processes?.find((p: any) => p.id === id) || null, [processes, id]);
  const currentVersion = useMemo(() => versions?.find((v: any) => v.process_id === id), [versions, id]);
  
  const processTasks = useMemo(() => 
    tasks?.filter(t => t.entityId === id && t.entityType === 'process') || [],
    [tasks, id]
  );

  const selectedNodeMedia = useMemo(() => 
    mediaFiles?.filter(m => m.entityId === id && m.subEntityId === selectedNodeId) || [],
    [mediaFiles, id, selectedNodeId]
  );

  useEffect(() => {
    if (currentProcess) {
      setMetaTitle(currentProcess.title || '');
      setMetaDesc(currentProcess.description || '');
      setMetaInputs(currentProcess.inputs || '');
      setMetaOutputs(currentProcess.outputs || '');
      setMetaKpis(currentProcess.kpis || '');
      setMetaDeptId(currentProcess.responsibleDepartmentId || 'none');
      setMetaFramework(currentProcess.regulatoryFramework || 'none');
      setMetaAutomation(currentProcess.automationLevel || 'manual');
      setMetaDataVolume(currentProcess.dataVolume || 'low');
      setMetaFrequency(currentProcess.processingFrequency || 'on_demand');
      setMetaTags(currentProcess.tags || '');
      setMetaQuestions(currentProcess.openQuestions || '');
      setMetaVvtId(currentProcess.vvtId || 'none');
      setMetaOwnerRoleId(currentProcess.ownerRoleId || 'none');
    }
  }, [currentProcess]);

  useEffect(() => {
    if (selectedNodeId && currentVersion) {
      const node = currentVersion.model_json?.nodes?.find((n: any) => n.id === selectedNodeId);
      const nodeFeatureIds = featureLinks?.filter((l: any) => l.processId === id && l.nodeId === selectedNodeId).map((l: any) => l.featureId) || [];
      
      if (node) {
        setLocalNodeEdits({
          id: node.id,
          title: node.title || '',
          roleId: node.roleId || '',
          resourceIds: node.resourceIds || [],
          featureIds: nodeFeatureIds,
          subjectGroupIds: node.subjectGroupIds || [],
          dataCategoryIds: node.dataCategoryIds || [],
          predecessorIds: node.predecessorIds || [],
          successorIds: node.successorIds || [],
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
  }, [selectedNodeId, currentVersion, featureLinks, id]);

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

  const handleReorder = async (nodeId: string, direction: 'up' | 'down') => {
    if (!currentVersion) return;
    const nodes = [...(currentVersion.model_json.nodes || [])];
    const idx = nodes.findIndex(n => n.id === nodeId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === nodes.length - 1) return;

    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    const temp = nodes[idx];
    nodes[idx] = nodes[newIdx];
    nodes[newIdx] = temp;

    const ops: ProcessOperation[] = [{ type: 'REORDER_NODES', payload: { orderedNodeIds: nodes.map(n => n.id) } }];
    await handleApplyOps(ops);
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!confirm("Arbeitsschritt permanent löschen?")) return;
    const ops: ProcessOperation[] = [{ type: 'REMOVE_NODE', payload: { nodeId } }];
    await handleApplyOps(ops);
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  const handleSaveMetadata = async () => {
    setIsSavingMeta(true);
    try {
      const res = await updateProcessMetadataAction(id as string, {
        title: metaTitle,
        description: metaDesc,
        inputs: metaInputs,
        outputs: metaOutputs,
        kpis: metaKpis,
        responsibleDepartmentId: metaDeptId === 'none' ? undefined : metaDeptId,
        regulatoryFramework: metaFramework === 'none' ? undefined : metaFramework,
        automationLevel: metaAutomation,
        dataVolume: metaVolume,
        processingFrequency: metaFrequency,
        tags: metaTags,
        openQuestions: metaQuestions,
        vvtId: metaVvtId === 'none' ? undefined : metaVvtId,
        ownerRoleId: metaOwnerRoleId === 'none' ? undefined : metaOwnerRoleId
      }, dataSource);
      if (res.success) {
        toast({ title: "Stammdaten gespeichert" });
        refreshProc();
      }
    } finally {
      setIsSavingMeta(false);
    }
  };

  const handleCreateTask = async () => {
    if (!taskTitle || !taskAssigneeId) return;
    setIsSavingTask(true);
    try {
      const res = await saveTaskAction({
        tenantId: currentProcess?.tenantId || 'global',
        title: taskTitle,
        status: 'todo',
        priority: 'medium',
        assigneeId: taskAssigneeId,
        creatorId: user?.id || 'system',
        entityType: 'process',
        entityId: id as string
      }, dataSource, user?.email || 'system');
      if (res.success) {
        toast({ title: "Aufgabe erstellt" });
        setIsTaskDialogOpen(false);
        setTaskTitle('');
        refreshTasks();
      }
    } finally {
      setIsSavingTask(false);
    }
  };

  const handleCommitVersion = async () => {
    if (!currentVersion || !user) return;
    setIsCommitting(true);
    try {
      const res = await commitProcessVersionAction(currentVersion.process_id, currentVersion.version, user.email || user.id, dataSource);
      if (res.success) {
        toast({ title: "Version gespeichert" });
        refreshVersion();
      }
    } finally {
      setIsCommitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedNodeId || !user) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataUri = evt.target?.result as string;
      const mediaId = `med-${Math.random().toString(36).substring(2, 9)}`;
      
      const mediaData: MediaFile = {
        id: mediaId,
        tenantId: currentProcess?.tenantId || 't1',
        module: 'ProcessHub',
        entityId: id as string,
        subEntityId: selectedNodeId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl: dataUri,
        createdAt: new Date().toISOString(),
        createdBy: user.email || 'system'
      };

      try {
        const res = await saveMediaAction(mediaData, dataSource);
        if (res.success) {
          toast({ title: "Datei hochgeladen" });
          refreshMedia();
          
          if (file.type === 'application/pdf') {
            setIsOcring(true);
            const ocrRes = await runOcrAction({ fileDataUri: dataUri, fileName: file.name, dataSource });
            if (ocrRes.extractedText) {
              await saveMediaAction({ ...mediaData, ocrText: ocrRes.extractedText }, dataSource);
              toast({ title: "OCR abgeschlossen", description: "Texte aus PDF wurden indexiert." });
              refreshMedia();
            }
            setIsOcring(false);
          }
        }
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleQuickAdd = (type: 'step' | 'decision' | 'end' | 'subprocess') => {
    if (!currentVersion) return;
    const newId = `${type}-${Date.now()}`;
    const titles = { step: 'Neuer Schritt', decision: 'Entscheidung?', end: 'Endpunkt', subprocess: 'Prozess-Referenz' };
    const nodes = currentVersion.model_json.nodes || [];
    const predecessor = selectedNodeId ? nodes.find((n: any) => n.id === selectedNodeId) : (nodes.length > 0 ? nodes[nodes.length - 1] : null);
    
    const newNode: ProcessNode = {
      id: newId,
      type,
      title: titles[type],
      checklist: [],
      roleId: predecessor?.roleId || '',
      resourceIds: predecessor?.resourceIds || [],
      featureIds: featureLinks?.filter((l: any) => predecessor && l.nodeId === predecessor.id).map((l: any) => l.featureId) || [],
      subjectGroupIds: predecessor?.subjectGroupIds || [],
      dataCategoryIds: predecessor?.dataCategoryIds || [],
      predecessorIds: predecessor ? [predecessor.id] : []
    };

    const ops: ProcessOperation[] = [{ type: 'ADD_NODE', payload: { node: newNode } }];
    if (predecessor) {
      ops.push({ type: 'ADD_EDGE', payload: { edge: { id: `edge-${Date.now()}`, source: predecessor.id, target: newId } } });
    }
    handleApplyOps(ops).then(s => { if(s) { setSelectedNodeId(newId); setIsStepDialogOpen(true); } });
  };

  const handleSaveNodeEdits = async () => {
    if (!selectedNodeId) return;
    
    const ops: ProcessOperation[] = [{
      type: 'UPDATE_NODE',
      payload: {
        nodeId: selectedNodeId,
        patch: {
          title: localNodeEdits.title,
          roleId: localNodeEdits.roleId,
          resourceIds: localNodeEdits.resourceIds,
          subjectGroupIds: localNodeEdits.subjectGroupIds,
          dataCategoryIds: localNodeEdits.dataCategoryIds,
          predecessorIds: localNodeEdits.predecessorIds,
          successorIds: localNodeEdits.successorIds,
          description: localNodeEdits.description,
          tips: localNodeEdits.tips,
          errors: localNodeEdits.errors,
          targetProcessId: localNodeEdits.targetProcessId,
          checklist: localNodeEdits.checklist.split('\n').filter(l => l.trim() !== '')
        }
      }
    }];
    
    const existingLinks = featureLinks?.filter((l: any) => l.processId === id && l.nodeId === selectedNodeId) || [];
    const existingIds = existingLinks.map((l: any) => l.featureId);
    
    for (const fid of localNodeEdits.featureIds) {
      if (!existingIds.includes(fid)) {
        await linkFeatureToProcessAction({
          featureId: fid,
          processId: id as string,
          nodeId: selectedNodeId,
          usageType: 'Verarbeitung',
          criticality: 'medium'
        }, dataSource);
      }
    }
    
    for (const link of existingLinks) {
      if (!localNodeEdits.featureIds.includes(link.featureId)) {
        await unlinkFeatureFromProcessAction(link.id, link.featureId, dataSource);
      }
    }

    const success = await handleApplyOps(ops);
    if (success) {
      toast({ title: "Schritt aktualisiert" });
      refreshFeatureLinks();
      setIsStepDialogOpen(false);
    }
  };

  const filteredResources = useMemo(() => {
    if (!resources) return [];
    return resources.filter(r => r.name.toLowerCase().includes(resSearch.toLowerCase()) && r.status !== 'archived');
  }, [resources, resSearch]);

  const getFullRoleName = (roleId: string) => {
    const role = jobTitles?.find(j => j.id === roleId);
    if (!role) return roleId;
    const dept = departments?.find(d => d.id === role.departmentId);
    return dept ? `${dept.name} - ${role.name}` : role.name;
  };

  if (!mounted) return null;

  const isReferenceNode = localNodeEdits.type === 'subprocess' || localNodeEdits.type === 'end';

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
          {!isDiagramLocked && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 rounded-md text-[10px] font-bold border-slate-200 gap-2 hover:bg-blue-50 text-blue-600 transition-all"
              onClick={syncDiagramToModel}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Diagramm generieren
            </Button>
          )}
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
            Speichern & Loggen
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden h-full relative">
        <aside style={{ width: isMobile ? '100%' : `${leftWidth}px` }} className={cn("border-r flex flex-col bg-white shrink-0 overflow-hidden relative group/sidebar h-full shadow-sm", isMobile && "hidden")}>
          <Tabs defaultValue="meta" className="h-full flex flex-col overflow-hidden">
            <TabsList className="h-11 bg-slate-50 border-b gap-0 p-0 w-full justify-start shrink-0 rounded-none overflow-x-auto no-scrollbar">
              <TabsTrigger value="meta" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent h-full px-2 text-[10px] font-bold flex items-center justify-center gap-2 text-slate-500 data-[state=active]:text-blue-600"><Info className="w-3.5 h-3.5" /> Stammdaten</TabsTrigger>
              <TabsTrigger value="steps" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-2 text-[10px] font-bold flex items-center justify-center gap-2 text-slate-500 data-[state=active]:text-primary"><ClipboardList className="w-3.5 h-3.5" /> Ablauf</TabsTrigger>
              <TabsTrigger value="tasks" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-amber-600 data-[state=active]:bg-transparent h-full px-2 text-[10px] font-bold flex items-center justify-center gap-2 text-slate-500 data-[state=active]:text-amber-600"><CheckCircle className="w-3.5 h-3.5" /> Aufgaben</TabsTrigger>
              <TabsTrigger value="media" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent h-full px-2 text-[10px] font-bold flex items-center justify-center gap-2 text-slate-500 data-[state=active]:text-indigo-600"><FileStack className="w-3.5 h-3.5" /> Medien</TabsTrigger>
            </TabsList>
            
            <TabsContent value="meta" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
              <ScrollArea className="flex-1 bg-white">
                <div className="p-6 space-y-6 pb-32">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Prozesstitel</Label>
                      <Input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} className="h-10 text-xs font-bold" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Fachliche Beschreibung</Label>
                      <Textarea value={metaDesc} onChange={e => setMetaDesc(e.target.value)} className="min-h-[100px] text-xs leading-relaxed" />
                    </div>

                    <Separator />
                    
                    <div className="space-y-4 p-4 bg-indigo-50/30 border border-indigo-100 rounded-xl">
                      <h4 className="text-[10px] font-black uppercase text-indigo-700 flex items-center gap-2">
                        <Settings2 className="w-3.5 h-3.5" /> ISO 9001:2015 Anforderungen
                      </h4>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase text-slate-400">Inputs (Eingaben)</Label>
                          <Textarea value={metaInputs} onChange={e => setMetaInputs(e.target.value)} placeholder="Was wird benötigt?..." className="min-h-[60px] text-[11px] bg-white border-indigo-100" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase text-slate-400">Outputs (Ergebnisse)</Label>
                          <Textarea value={metaOutputs} onChange={e => setMetaOutputs(e.target.value)} placeholder="Was kommt raus?..." className="min-h-[60px] text-[11px] bg-white border-indigo-100" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase text-slate-400">Leistungskennzahlen (KPIs)</Label>
                          <Textarea value={metaKpis} onChange={e => setMetaKpis(e.target.value)} placeholder="Messbarkeit des Prozesses?..." className="min-h-[60px] text-[11px] bg-white border-indigo-100" />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4 p-4 bg-emerald-50/30 border border-emerald-100 rounded-xl">
                      <h4 className="text-[10px] font-black uppercase text-emerald-700 flex items-center gap-2">
                        <FileCheck className="w-3.5 h-3.5" /> DSGVO Kontext
                      </h4>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase text-slate-400">Verarbeitungszweck (VVT)</Label>
                        <Select value={metaVvtId} onValueChange={setMetaVvtId}>
                          <SelectTrigger className="h-10 text-xs bg-white border-emerald-100"><SelectValue placeholder="Zweck wählen..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Kein VVT Bezug</SelectItem>
                            {vvts?.filter(v => activeTenantId === 'all' || v.tenantId === activeTenantId).map(v => (
                              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Prozessverantwortlicher (Owner Rolle)</Label>
                      <Select value={metaOwnerRoleId} onValueChange={setMetaOwnerRoleId}>
                        <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nicht zugewiesen</SelectItem>
                          {jobTitles?.filter(j => activeTenantId === 'all' || j.tenantId === activeTenantId).map(role => (
                            <SelectItem key={role.id} value={role.id}>{getFullRoleName(role.id)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Verantwortliche Abteilung</Label>
                      <Select value={metaDeptId} onValueChange={setMetaDeptId}>
                        <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Keine Abteilung</SelectItem>
                          {departments?.filter(d => activeTenantId === 'all' || d.tenantId === activeTenantId).map(d => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Regulatorik / Standard</Label>
                      <Select value={metaFramework} onValueChange={setMetaFramework}>
                        <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Kein Standard</SelectItem>
                          {regulatoryOptions?.filter(o => o.enabled).map(o => (
                            <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Automatisierung</Label>
                        <Select value={metaAutomation} onValueChange={(v: any) => setMetaAutomation(v)}>
                          <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manuell</SelectItem>
                            <SelectItem value="partial">Teil-Automatisiert</SelectItem>
                            <SelectItem value="full">Voll-Automatisiert</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Datenvolumen</Label>
                        <Select value={metaVolume} onValueChange={(v: any) => setMetaDataVolume(v)}>
                          <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Niedrig (Low)</SelectItem>
                            <SelectItem value="medium">Mittel (Medium)</SelectItem>
                            <SelectItem value="high">Hoch (High)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Frequenz</Label>
                        <Select value={metaFrequency} onValueChange={(v: any) => setMetaFrequency(v)}>
                          <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Täglich</SelectItem>
                            <SelectItem value="weekly">Wöchentlich</SelectItem>
                            <SelectItem value="monthly">Monatlich</SelectItem>
                            <SelectItem value="on_demand">Ad-hoc / Bedarf</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Offene Fragen / Klärungsbedarf</Label>
                      <Textarea value={metaQuestions} onChange={e => setMetaQuestions(e.target.value)} className="min-h-[100px] text-xs" placeholder="Was muss noch geklärt werden?..." />
                    </div>
                    <Button onClick={handleSaveMetadata} disabled={isSavingMeta} className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase gap-2 shadow-lg">
                      {isSavingMeta ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} 
                      Stammdaten sichern
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="steps" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
              <div className="px-6 py-3 border-b bg-white flex items-center justify-start shrink-0">
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md" onClick={() => handleQuickAdd('step')}>+ Schritt</Button>
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md" onClick={() => handleQuickAdd('decision')}>+ Weiche</Button>
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md" onClick={() => handleQuickAdd('subprocess')}>+ Referenz</Button>
                </div>
              </div>
              <ScrollArea className="flex-1 bg-slate-50/30">
                <div className="p-4 space-y-2 pb-32">
                  {(currentVersion?.model_json?.nodes || []).map((node: any, index: number) => {
                    const nodeMedia = mediaFiles?.filter(m => m.entityId === id && m.subEntityId === node.id).length || 0;
                    const nodeFeats = featureLinks?.filter((l: any) => l.processId === id && l.nodeId === node.id).length || 0;
                    return (
                      <div key={node.id} className={cn("group flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer bg-white shadow-sm hover:border-primary/20", selectedNodeId === node.id ? "border-primary ring-2 ring-primary/5" : "border-slate-100")} onClick={() => { setSelectedNodeId(node.id); setIsStepDialogOpen(true); }}>
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border relative", node.type === 'decision' ? "bg-amber-50 text-amber-600" : node.type === 'subprocess' ? "bg-indigo-50 text-indigo-600" : "bg-slate-50 text-slate-500")}>
                          {node.type === 'decision' ? <GitBranch className="w-4 h-4" /> : node.type === 'subprocess' ? <Network className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                          {nodeMedia > 0 && <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[8px] font-bold border border-white">{nodeMedia}</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">{node.title}</p>
                          {node.description && <p className="text-[9px] text-slate-400 truncate mt-0.5">{node.description}</p>}
                          <div className="flex items-center gap-2 mt-1">
                            {node.resourceIds?.length > 0 && <span className="text-[7px] text-indigo-600 font-black uppercase">{node.resourceIds.length} Sys</span>}
                            {nodeFeats > 0 && <span className="text-[7px] text-sky-600 font-black uppercase">{nodeFeats} Dat</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                          <div className="flex flex-col gap-0.5">
                            <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); handleReorder(node.id, 'up'); }} disabled={index === 0}><ArrowUp className="w-3 h-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); handleReorder(node.id, 'down'); }} disabled={index === (currentVersion?.model_json?.nodes?.length || 0) - 1}><ArrowDown className="w-3 h-3" /></Button>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="tasks" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
              <div className="px-6 py-3 border-b bg-white flex items-center justify-between shrink-0">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Offene Punkte</h4>
                <Button variant="ghost" size="sm" className="h-7 text-[9px] font-bold text-primary gap-1" onClick={() => { setTaskTitle(''); setIsTaskDialogOpen(true); }}>
                  <Plus className="w-3.5 h-3.5" /> Hinzufügen
                </Button>
              </div>
              <ScrollArea className="flex-1 bg-slate-50/30">
                <div className="p-4 space-y-2 pb-32">
                  {processTasks.map(t => (
                    <div key={t.id} className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm group hover:border-amber-300 transition-all cursor-pointer" onClick={() => router.push('/tasks')}>
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className={cn("text-[7px] font-black uppercase h-3.5 px-1 border-none", t.status === 'done' ? "bg-emerald-50 text-emerald-600" : t.priority === 'critical' ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600")}>{t.status}</Badge>
                        <span className="text-[8px] font-bold text-slate-400 flex items-center gap-1"><Clock className="w-2 h-2" /> {t.dueDate || '∞'}</span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-800 leading-tight">{t.title}</p>
                      <p className="text-[9px] text-slate-400 mt-1 truncate">{pUsers?.find(u => u.id === t.assigneeId)?.displayName || 'Unzugewiesen'}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="media" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
              <ScrollArea className="flex-1 bg-slate-50/30">
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 gap-3">
                    {mediaFiles?.filter(m => m.entityId === id).map(m => (
                      <div key={m.id} className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                          {m.fileType.includes('image') ? <Activity className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold text-slate-800 truncate">{m.fileName}</p>
                          <p className="text-[8px] text-slate-400 font-bold uppercase">{m.subEntityId ? 'Schritt-Anhang' : 'Global'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
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
          <div className="fixed bottom-6 right-6 z-50">
            <AiFormAssistant 
              formType="process" 
              currentData={{ title: metaTitle, description: metaDesc, inputs: metaInputs, outputs: metaOutputs, kpis: metaKpis }} 
              onApply={(s) => { if (s.title) setMetaTitle(s.title); if (s.description) setMetaDesc(s.description); toast({ title: "KI-Vorschläge übernommen" }); }} 
            />
          </div>
        </main>
      </div>

      <Dialog open={isStepDialogOpen} onOpenChange={setIsStepDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] rounded-2xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white h-[90vh]">
          <DialogHeader className="p-6 bg-white border-b pr-10">
            <div className="flex items-center gap-5">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", localNodeEdits.type === 'decision' ? "bg-amber-50 text-amber-600" : localNodeEdits.type === 'subprocess' ? "bg-indigo-50 text-indigo-600" : "bg-primary/10 text-primary")}>
                {localNodeEdits.type === 'decision' ? <GitBranch className="w-6 h-6" /> : localNodeEdits.type === 'subprocess' ? <Network className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg font-headline font-bold text-slate-900 truncate">{localNodeEdits.title || 'Schritt bearbeiten'}</DialogTitle>
                <DialogDescription className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{isReferenceNode ? 'Prozess-Verknüpfung' : 'Arbeitsschritt-Dokumentation'}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <Tabs defaultValue="base" className="flex-1 flex flex-col min-h-0">
            <TabsList className="bg-slate-50 border-b h-11 px-6 justify-start rounded-none gap-6">
              <TabsTrigger value="base" className="text-[10px] font-bold uppercase gap-2">Stammdaten</TabsTrigger>
              {!isReferenceNode && (
                <>
                  <TabsTrigger value="logic" className="text-[10px] font-bold uppercase gap-2"><GitBranch className="w-3.5 h-3.5" /> Logik</TabsTrigger>
                  <TabsTrigger value="resources" className="text-[10px] font-bold uppercase gap-2"><Server className="w-3.5 h-3.5" /> IT-Systeme</TabsTrigger>
                  <TabsTrigger value="data" className="text-[10px] font-bold uppercase gap-2"><Tag className="w-3.5 h-3.5" /> Daten</TabsTrigger>
                  <TabsTrigger value="details" className="text-[10px] font-bold uppercase gap-2">Details & Expertise</TabsTrigger>
                </>
              )}
            </TabsList>
            <ScrollArea className="flex-1">
              <div className="p-8 space-y-10">
                <TabsContent value="base" className="mt-0 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5 md:col-span-2"><Label className="text-[10px] font-bold uppercase text-slate-400">Bezeichnung</Label><Input value={localNodeEdits.title} onChange={e => setLocalNodeEdits({...localNodeEdits, title: e.target.value})} className="h-11 font-bold rounded-xl" /></div>
                    {!isReferenceNode && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase text-slate-400">Verantwortliche Rolle</Label>
                        <Select value={localNodeEdits.roleId} onValueChange={(val) => setLocalNodeEdits({...localNodeEdits, roleId: val})}>
                          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Rolle wählen..." /></SelectTrigger>
                          <SelectContent>
                            {jobTitles?.map(role => (
                              <SelectItem key={role.id} value={role.id}>{getFullRoleName(role.id)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {isReferenceNode && (
                      <div className="space-y-1.5 md:col-span-2">
                        <Label className="text-[10px] font-bold uppercase text-indigo-600">Referenzierter Ziel-Prozess (Handover)</Label>
                        <Select value={localNodeEdits.targetProcessId} onValueChange={(val) => setLocalNodeEdits({...localNodeEdits, targetProcessId: val})}>
                          <SelectTrigger className="h-11 rounded-xl bg-indigo-50 border-indigo-100"><SelectValue placeholder="Zielprozess wählen..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Keine Referenz</SelectItem>
                            {processes?.filter(p => p.id !== id).map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400">Kurzbeschreibung</Label><Textarea value={localNodeEdits.description} onChange={e => setLocalNodeEdits({...localNodeEdits, description: e.target.value})} className="text-xs min-h-[100px] rounded-xl" /></div>
                </TabsContent>

                {!isReferenceNode && (
                  <>
                    <TabsContent value="logic" className="mt-0 space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-2"><ArrowLeftCircle className="w-4 h-4" /> Vorgänger (Predecessors)</Label>
                          <ScrollArea className="h-48 border rounded-xl bg-slate-50/50 p-2">
                            {currentVersion?.model_json?.nodes?.filter((n: any) => n.id !== selectedNodeId).map((n: any) => (
                              <div key={n.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer" onClick={() => setLocalNodeEdits(prev => ({ ...prev, predecessorIds: prev.predecessorIds.includes(n.id) ? prev.predecessorIds.filter(id => id !== n.id) : [...prev.predecessorIds, n.id] }))}>
                                <Checkbox checked={localNodeEdits.predecessorIds.includes(n.id)} />
                                <span className="text-[11px] font-bold truncate">{n.title}</span>
                              </div>
                            ))}
                          </ScrollArea>
                        </div>
                        <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase text-emerald-600 flex items-center gap-2"><ArrowRightCircle className="w-4 h-4" /> Nachfolger (Successors)</Label>
                          <ScrollArea className="h-48 border rounded-xl bg-slate-50/50 p-2">
                            {currentVersion?.model_json?.nodes?.filter((n: any) => n.id !== selectedNodeId).map((n: any) => (
                              <div key={n.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer" onClick={() => setLocalNodeEdits(prev => ({ ...prev, successorIds: prev.successorIds.includes(n.id) ? prev.successorIds.filter(id => id !== n.id) : [...prev.successorIds, n.id] }))}>
                                <Checkbox checked={localNodeEdits.successorIds.includes(n.id)} />
                                <span className="text-[11px] font-bold truncate">{n.title}</span>
                              </div>
                            ))}
                          </ScrollArea>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="resources" className="mt-0 space-y-6">
                      <div className="space-y-4">
                        <div className="relative group">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                          <Input 
                            placeholder="IT-Systeme suchen..." 
                            value={resSearch}
                            onChange={(e) => setResSearch(e.target.value)}
                            className="pl-10 h-11 rounded-xl"
                          />
                        </div>
                        <ScrollArea className="h-[300px] border rounded-2xl bg-slate-50/30 p-4 shadow-inner">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {filteredResources.map(res => (
                              <div key={res.id} className={cn("p-3 border rounded-xl flex items-center justify-between cursor-pointer transition-all shadow-sm group", localNodeEdits.resourceIds.includes(res.id) ? "border-indigo-500 bg-indigo-50/20" : "bg-white border-slate-100")} onClick={() => setLocalNodeEdits(prev => ({ ...prev, resourceIds: prev.resourceIds.includes(res.id) ? prev.resourceIds.filter(id => id !== res.id) : [...prev.resourceIds, res.id] }))}>
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <Checkbox checked={localNodeEdits.resourceIds.includes(res.id)} />
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-bold text-slate-800 truncate">{res.name}</p>
                                    <p className="text-[8px] text-slate-400 font-black uppercase">{res.assetType}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </TabsContent>

                    <TabsContent value="data" className="mt-0 space-y-10">
                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-sky-600 flex items-center gap-2"><Tag className="w-4 h-4" /> Verarbeitete Daten</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {allFeatures?.filter(f => f.status !== 'archived').map(feat => (
                            <div key={feat.id} className={cn("p-3 border rounded-xl flex items-center justify-between cursor-pointer shadow-sm", localNodeEdits.featureIds.includes(feat.id) ? "border-sky-500 bg-sky-50/20" : "bg-white border-slate-100")} onClick={() => setLocalNodeEdits(prev => ({ ...prev, featureIds: prev.featureIds.includes(feat.id) ? prev.featureIds.filter(id => id !== feat.id) : [...prev.featureIds, feat.id] }))}>
                              <Checkbox checked={localNodeEdits.featureIds.includes(feat.id)} />
                              <div className="min-w-0 flex-1 ml-3"><p className="text-[11px] font-bold text-slate-800 truncate">{feat.name}</p></div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase text-emerald-600 flex items-center gap-2"><UserCircle className="w-4 h-4" /> Betroffene Personengruppen</Label>
                          <ScrollArea className="h-48 border rounded-xl bg-slate-50/50 p-2">
                            {subjectGroups?.filter(g => g.status === 'active').map(g => (
                              <div key={g.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer" onClick={() => setLocalNodeEdits(prev => ({ ...prev, subjectGroupIds: prev.subjectGroupIds.includes(g.id) ? prev.subjectGroupIds.filter(id => id !== g.id) : [...prev.subjectGroupIds, g.id] }))}>
                                <Checkbox checked={localNodeEdits.subjectGroupIds.includes(g.id)} />
                                <span className="text-[11px] font-bold truncate">{g.name}</span>
                              </div>
                            ))}
                          </ScrollArea>
                        </div>
                        <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2"><Layers className="w-4 h-4" /> Datenkategorien (DSGVO)</Label>
                          <ScrollArea className="h-48 border rounded-xl bg-slate-50/50 p-2">
                            {dataCategories?.filter(c => c.status === 'active').map(c => (
                              <div key={c.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer" onClick={() => setLocalNodeEdits(prev => ({ ...prev, dataCategoryIds: prev.dataCategoryIds.includes(c.id) ? prev.dataCategoryIds.filter(id => id !== c.id) : [...prev.dataCategoryIds, c.id] }))}>
                                <Checkbox checked={localNodeEdits.dataCategoryIds.includes(c.id)} />
                                <span className="text-[11px] font-bold truncate">{c.name}</span>
                              </div>
                            ))}
                          </ScrollArea>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="details" className="mt-0 space-y-10">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2"><Lightbulb className="w-3.5 h-3.5" /> Tipps & Expertise</Label>
                          <Textarea value={localNodeEdits.tips} onChange={e => setLocalNodeEdits({...localNodeEdits, tips: e.target.value})} className="text-xs min-h-[100px] rounded-xl bg-blue-50/20" />
                        </div>
                        <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase text-red-600 flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5" /> Häufige Fehler</Label>
                          <Textarea value={localNodeEdits.errors} onChange={e => setLocalNodeEdits({...localNodeEdits, errors: e.target.value})} className="text-xs min-h-[100px] rounded-xl bg-red-50/20" />
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2"><FileStack className="w-3.5 h-3.5" /> Anhänge & Medien</Label>
                        <div className="p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 bg-slate-50/50 relative">
                          <Upload className="w-6 h-6 text-slate-400" />
                          <p className="text-[10px] font-bold uppercase">Klicken zum Hochladen</p>
                          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} disabled={isUploading} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedNodeMedia.map(file => (
                            <div key={file.id} className="p-3 bg-white border rounded-xl flex items-center justify-between">
                              <span className="text-[10px] font-bold truncate">{file.fileName}</span>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deleteMediaAction(file.id, file.tenantId, user?.email || 'admin', dataSource).then(() => refreshMedia())}><Trash2 className="w-3 h-3" /></Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                  </>
                )}
              </div>
            </ScrollArea>
          </Tabs>
          <DialogFooter className="p-4 bg-slate-50 border-t flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setIsStepDialogOpen(false)} className="rounded-xl h-10 px-6 font-bold text-xs">Abbrechen</Button>
            <Button onClick={handleSaveNodeEdits} className="rounded-xl h-10 px-12 bg-primary text-white shadow-lg font-bold text-xs gap-2">
              <Save className="w-4 h-4" /> Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="max-w-md rounded-xl p-0 overflow-hidden border-none shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0 pr-10">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center text-primary shadow-sm border border-white/10">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-headline font-bold uppercase tracking-tight">Prozessaufgabe erstellen</DialogTitle>
                <DialogDescription className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-0.5">Klärungspunkt oder Maßnahme erfassen</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Bezeichnung</Label>
              <Input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} className="h-11 rounded-xl font-bold" placeholder="z.B. IT-Schnittstelle klären..." />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Verantwortlicher</Label>
              <Select value={taskAssigneeId} onValueChange={setTaskAssigneeId}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent>
                  {pUsers?.map(u => <SelectItem key={u.id} value={u.id} className="text-xs font-bold">{u.displayName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t">
            <Button variant="ghost" onClick={() => setIsTaskDialogOpen(false)} className="rounded-xl font-bold text-[10px] uppercase">Abbrechen</Button>
            <Button onClick={handleCreateTask} disabled={isSavingTask || !taskTitle || !taskAssigneeId} className="rounded-xl bg-primary text-white font-bold text-[10px] h-11 px-8 shadow-lg gap-2">
              {isSavingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
