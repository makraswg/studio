'use client';

import { Process, ProcessVersion, Tenant, JobTitle, ProcessingActivity, Resource, RiskMeasure, Policy, PolicyVersion, Department, Feature, ProcessNode } from './types';

/**
 * Utility-Modul für den Export von Daten (PDF & Excel).
 * Optimiert für Enterprise-Reporting und GRC-Nachweise nach ISO-Standards.
 */

export async function exportToExcel(data: any[], fileName: string) {
  try {
    const XLSX = await import('xlsx');
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daten');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  } catch (error) {
    console.error('Excel Export fehlgeschlagen:', error);
  }
}

export async function exportUsersExcel(users: any[], tenants: any[]) {
  const data = users.map(u => ({
    'ID': u.id,
    'Anzeigename': u.displayName,
    'E-Mail': u.email,
    'Abteilung': u.department || '---',
    'Stelle': u.title || '---',
    'Mandant': tenants.find(t => t.id === u.tenantId)?.name || u.tenantId,
    'Status': u.enabled ? 'Aktiv' : 'Inaktiv',
    'Onboarding': u.onboardingDate || '---',
    'Letzter Sync': u.lastSyncedAt ? new Date(u.lastSyncedAt).toLocaleString() : '---'
  }));
  await exportToExcel(data, `Benutzerverzeichnis_${new Date().toISOString().split('T')[0]}`);
}

export async function exportResourcesExcel(resources: any[], tenants: any[]) {
  const data = resources.map(r => ({
    'Name': r.name,
    'Typ': r.assetType,
    'Kategorie': r.category,
    'Betriebsmodell': r.operatingModel,
    'Kritikalität': r.criticality,
    'Mandant': tenants.find(t => t.id === r.tenantId)?.name || r.tenantId,
    'Standort': r.dataLocation || '---',
    'Status': r.status || 'active'
  }));
  await exportToExcel(data, `Ressourcenkatalog_${new Date().toISOString().split('T')[0]}`);
}

export async function exportRisksExcel(risks: any[], resources: any[]) {
  const data = risks.map(r => {
    const asset = resources.find(res => res.id === r.assetId);
    return {
      'Titel': r.title,
      'Kategorie': r.category,
      'Asset': asset?.name || 'Global',
      'Status': r.status,
      'Brutto-Wahrscheinlichkeit': r.probability,
      'Brutto-Schaden': r.impact,
      'Brutto-Score': r.probability * r.impact,
      'Verantwortlich': r.owner,
      'Letzter Review': r.lastReviewDate ? new Date(r.lastReviewDate).toLocaleDateString() : 'Ausstehend'
    };
  });
  await exportToExcel(data, `Risikoinventar_${new Date().toISOString().split('T')[0]}`);
}

export async function exportGdprExcel(activities: any[]) {
  const data = activities.map(a => ({
    'ID': a.id,
    'Name der Tätigkeit': a.name,
    'Version': a.version,
    'Verantwortliche Abteilung': a.responsibleDepartment,
    'Rechtsgrundlage': a.legalBasis,
    'Aufbewahrungsfrist': a.retentionPeriod,
    'Status': a.status,
    'Letzte Prüfung': a.lastReviewDate ? new Date(a.lastReviewDate).toLocaleDateString() : '---'
  }));
  await exportToExcel(data, `Verarbeitungsverzeichnis_VVT_${new Date().toISOString().split('T')[0]}`);
}

/**
 * Zeichnet den Prozessgraphen mit intelligentem Zeilenumbruch.
 */
async function drawProcessGraph(doc: any, version: ProcessVersion, startY: number) {
  const nodes = version.model_json.nodes || [];
  const edges = version.model_json.edges || [];
  if (nodes.length === 0) return startY;

  const levels: Record<string, number> = {};
  const lanes: Record<string, number> = {};
  const occupiedLanesPerLevel = new Map<number, Set<number>>();

  nodes.forEach(n => levels[n.id] = 0);
  let changed = true;
  let limit = nodes.length * 2;
  while (changed && limit > 0) {
    changed = false;
    edges.forEach(edge => {
      if (levels[edge.target] <= levels[edge.source]) {
        levels[edge.target] = levels[edge.source] + 1;
        changed = true;
      }
    });
    limit--;
  }

  const processed = new Set<string>();
  const queue = nodes.filter(n => !edges.some(e => e.target === n.id)).map(n => ({ id: n.id, lane: 0 }));
  while (queue.length > 0) {
    const { id, lane } = queue.shift()!;
    if (processed.has(id)) continue;
    const lv = levels[id];
    let finalLane = lane;
    if (!occupiedLanesPerLevel.has(lv)) occupiedLanesPerLevel.set(lv, new Set());
    const levelOccupancy = occupiedLanesPerLevel.get(lv)!;
    while (levelOccupancy.has(finalLane)) { finalLane++; }
    lanes[id] = finalLane;
    levelOccupancy.add(finalLane);
    processed.add(id);
    const children = edges.filter(e => e.source === id).map(e => e.target);
    children.forEach((childId, idx) => { queue.push({ id: childId, lane: finalLane + idx }); });
  }

  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const canvasWidth = pageWidth - (2 * margin);
  
  // Optimierte Abstände
  const H_GAP = 25; 
  const V_GAP = 10;
  const nodesPerRow = Math.floor((canvasWidth - 10) / H_GAP);
  const maxLaneOverall = Math.max(...Object.values(lanes), 0);
  const rowHeight = (maxLaneOverall + 1) * V_GAP + 15;

  let localMaxY = startY + 15;

  const getPdfCoords = (id: string) => {
    const lv = levels[id] || 0;
    const lane = lanes[id] || 0;
    const row = Math.floor(lv / nodesPerRow);
    const col = lv % nodesPerRow;
    
    const x = margin + 10 + (col * H_GAP);
    const y = startY + 15 + (row * rowHeight) + (lane * V_GAP);
    if (y + 10 > localMaxY) localMaxY = y + 10;
    return { x, y };
  };

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.text('Ablaufdiagramm', margin, startY + 5);

  doc.setLineWidth(0.15);
  edges.forEach((edge: any) => {
    const s = getPdfCoords(edge.source);
    const t = getPdfCoords(edge.target);
    doc.setDrawColor(148, 163, 184);
    doc.line(s.x, s.y, t.x, t.y);
    
    const angle = Math.atan2(t.y - s.y, t.x - s.x);
    const hL = 1.5;
    doc.line(t.x, t.y, t.x - hL * Math.cos(angle - Math.PI/6), t.y - hL * Math.sin(angle - Math.PI/6));
    doc.line(t.x, t.y, t.x - hL * Math.cos(angle + Math.PI/6), t.y - hL * Math.sin(angle + Math.PI/6));
  });

  nodes.forEach((node, i) => {
    const { x, y } = getPdfCoords(node.id);
    const r = 2.5;
    const outDegree = edges.filter((e: any) => e.source === node.id).length;
    const isBranch = outDegree > 1 || node.type === 'decision';

    let fillColor = [241, 245, 249]; 
    if (node.type === 'start') fillColor = [16, 185, 129];
    else if (node.type === 'end') fillColor = [239, 68, 68];
    else if (isBranch) fillColor = [245, 158, 11];
    else if (node.type === 'subprocess') fillColor = [79, 70, 229];

    doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
    doc.setDrawColor(71, 85, 105);
    doc.circle(x, y, r, 'FD');

    doc.setFontSize(5);
    doc.setTextColor(node.type === 'subprocess' || node.type === 'end' || node.type === 'start' ? 255 : 30);
    doc.text(`${i + 1}`, x, y + 0.5, { align: 'center' });

    doc.setFontSize(5);
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.text(node.title, x, y + r + 3, { align: 'center', maxWidth: 22 });
  });

  return localMaxY + 8;
}

function addPageDecorations(doc: any, tenant: Tenant) {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(tenant.name, 14, 8);
    
    doc.setDrawColor(241, 245, 249);
    doc.line(14, 10, pageWidth - 14, 10);
    
    // Logo Stilelement oben rechts
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(pageWidth - 22, 4, 8, 8, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(5);
    doc.text('HUB', pageWidth - 18, 9, { align: 'center' });

    doc.setTextColor(148, 163, 184);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
    doc.setFontSize(7);
    doc.text(`Seite ${i} von ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.text(`Vertraulich | Stand: ${new Date().toLocaleDateString()}`, 14, pageHeight - 8);
  }
}

export async function exportProcessManualPdf(
  processes: Process[],
  versions: ProcessVersion[],
  tenant: Tenant,
  departments: Department[],
  jobTitles: JobTitle[],
  resources: Resource[] = [],
  allFeatures: Feature[] = [],
  allActivities: ProcessingActivity[] = []
) {
  try {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    const now = new Date().toLocaleDateString('de-DE');

    // --- 1. DECKBLATT ---
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(95, 40, 20, 20, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('HUB', 105, 52, { align: 'center' });

    doc.setTextColor(51, 65, 85);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('Prozess-Handbuch', 105, 100, { align: 'center' });
    doc.setFontSize(14);
    doc.setTextColor(71, 85, 105);
    doc.text(tenant.name, 105, 112, { align: 'center' });
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Erstellt am: ${now} | GRC-Reporting`, 105, 135, { align: 'center' });

    // --- 2. PROZESS-SEITEN GENERIEREN ---
    const pageMap: Record<string, number> = {};
    const grouped: Record<string, Process[]> = {};
    processes.forEach(p => {
      const d = departments.find(dept => dept.id === p.responsibleDepartmentId);
      const dName = d?.name || 'Zentral';
      if (!grouped[dName]) grouped[dName] = [];
      grouped[dName].push(p);
    });

    for (const deptName of Object.keys(grouped).sort()) {
      for (const p of grouped[deptName]) {
        const ver = versions.find(v => v.process_id === p.id && v.version === p.currentVersion);
        if (!ver) continue;

        doc.addPage();
        pageMap[p.id] = (doc as any).internal.getNumberOfPages();
        
        doc.setFontSize(18);
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'bold');
        doc.text(p.title, 14, 22);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`${deptName} | V${p.currentVersion}.0`, 14, 27);
        doc.line(14, 30, 196, 30);

        const activity = allActivities.find(a => a.id === p.vvtId);
        const usedResourceIds = new Set<string>();
        ver.model_json.nodes.forEach(n => n.resourceIds?.forEach(id => usedResourceIds.add(id)));
        const resNames = resources.filter(r => usedResourceIds.has(r.id)).map(r => r.name).join(', ') || '---';

        autoTable(doc, {
          startY: 35,
          body: [
            ['Verantwortlich', jobTitles.find(j => j.id === p.ownerRoleId)?.name || '---'],
            ['Freigabestatus', `Freigegeben am ${now} durch ${jobTitles.find(j => j.id === p.ownerRoleId)?.name || 'System'}`],
            ['Verfahrensverzeichnis', activity?.name || '---'],
            ['Eingang (ISO)', p.inputs || '---'],
            ['Ausgang (ISO)', p.outputs || '---'],
            ['IT-Systeme', resNames]
          ],
          theme: 'grid',
          styles: { fontSize: 7, font: 'helvetica' },
          columnStyles: { 0: { fontStyle: 'bold', width: 45, fillColor: [248, 250, 252] } }
        });

        const graphY = (doc as any).lastAutoTable.finalY + 8;
        const tableY = await drawProcessGraph(doc, ver, graphY);

        autoTable(doc, {
          startY: tableY,
          head: [['Nr', 'Arbeitsschritt', 'Rolle', 'Durchführung', 'Nächste Schritte']],
          body: ver.model_json.nodes.map((n, i) => {
            const successors = ver.model_json.edges
              .filter(e => e.source === n.id)
              .map(e => {
                const targetNode = ver.model_json.nodes.find(node => node.id === e.target);
                const targetIdx = ver.model_json.nodes.findIndex(node => node.id === e.target) + 1;
                const label = e.label && String(e.label).trim() ? `[${e.label}] ` : '';
                const targetPage = targetNode?.targetProcessId ? ` (S. ${pageMap[targetNode.targetProcessId] || '?'})` : '';
                return `${label}-> (${targetIdx}) ${targetNode?.title}${targetPage}`;
              }).join('\n');

            return [
              `${i + 1}`,
              { content: n.title, styles: { fontStyle: 'bold' } }, 
              jobTitles.find(j => j.id === n.roleId)?.name || '-',
              { content: `${n.description || ''}${n.checklist?.length ? '\n- ' + n.checklist.join('\n- ') : ''}` },
              { content: successors || 'Ende' }
            ];
          }),
          theme: 'striped',
          styles: { fontSize: 6.5, font: 'helvetica', overflow: 'linebreak' },
          headStyles: { font: 'helvetica', fillColor: [71, 85, 105] },
          columnStyles: { 0: { width: 8 }, 1: { width: 35 }, 3: { width: 75 }, 4: { width: 35 } }
        });
      }
    }

    // --- 3. INHALTSVERZEICHNIS (NACHTRÄGLICH EINFÜGEN) ---
    doc.insertPage(1);
    doc.setPage(2);
    doc.setTextColor(37, 99, 235);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Inhaltsverzeichnis', 14, 25);

    const tocRows: any[] = [];
    Object.keys(grouped).sort().forEach(deptName => {
      tocRows.push([{ content: deptName.toUpperCase(), colSpan: 2, styles: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], fontSize: 9 } }]);
      grouped[deptName].forEach(p => {
        const actualPage = (pageMap[p.id] || 0) + 1;
        tocRows.push([`   ${p.title}`, actualPage.toString()]);
      });
    });

    autoTable(doc, {
      startY: 35,
      body: tocRows,
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.5 },
      columnStyles: { 0: { width: 165 }, 1: { halign: 'right', fontStyle: 'bold', width: 15 } },
      didDrawCell: (data) => {
        if (data.column.index === 0 && data.cell.text[0] && data.cell.text[0].startsWith('   ')) {
          const textWidth = doc.getTextWidth(data.cell.text[0]);
          const startX = data.cell.x + textWidth + 2;
          const endX = 188; 
          if (endX > startX) {
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.1);
            doc.setLineDashPattern([0.5, 1.5], 0);
            doc.line(startX, data.cell.y + data.cell.height - 2, endX, data.cell.y + data.cell.height - 2);
            doc.setLineDashPattern([], 0);
          }
        }
      }
    });

    addPageDecorations(doc, tenant);
    doc.save(`Prozesshandbuch_${tenant.name.replace(/\s+/g, '_')}.pdf`);
  } catch (error) {
    console.error('Handbuch Export fehlgeschlagen:', error);
  }
}

export async function exportPolicyPdf(policy: Policy, version: PolicyVersion, tenantName: string) {
  try {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor(5, 150, 105); 
    doc.text(policy.title, 14, 25);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Organisation: ${tenantName} | V${version.version}.${version.revision}`, 14, 35);
    doc.line(14, 40, 196, 40);

    autoTable(doc, {
      startY: 45,
      body: [['Typ', policy.type], ['Status', policy.status.toUpperCase()], ['Änderung', version.changelog || '-']],
      theme: 'grid',
      styles: { fontSize: 8, font: 'helvetica' },
      headStyles: { fillColor: [71, 85, 105] }
    });

    const contentY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(11);
    doc.setTextColor(0);
    const splitContent = doc.splitTextToSize(version.content.replace(/<[^>]*>?/gm, ''), 180);
    doc.text(splitContent, 14, contentY);

    doc.save(`Richtlinie_${policy.title.replace(/\s+/g, '_')}.pdf`);
  } catch (error) {
    console.error('Policy PDF Export failed:', error);
  }
}

export async function exportPolicyDocx(policy: Policy, version: PolicyVersion) {
  const content = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${policy.title}</title></head>
    <body style="font-family: Arial, sans-serif;">
      <h1 style="color: #059669;">${policy.title}</h1>
      <p><strong>Version:</strong> ${version.version}.${version.revision}</p>
      <p><strong>Status:</strong> ${policy.status}</p>
      <hr/>
      <div style="white-space: pre-wrap;">
        ${version.content.replace(/<[^>]*>?/gm, '')}
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Richtlinie_${policy.title.replace(/\s+/g, '_')}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportDetailedProcessPdf(
  process: Process, 
  version: ProcessVersion, 
  tenant: Tenant, 
  jobTitles: JobTitle[], 
  departments: Department[],
  resources: Resource[] = [],
  allActivities: ProcessingActivity[] = []
) {
  try {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    const now = new Date().toLocaleDateString('de-DE');
    const dept = departments.find(d => d.id === process.responsibleDepartmentId);
    
    doc.setFontSize(18);
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'bold');
    doc.text(process.title, 14, 22);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`${dept?.name || 'Zentral'} | V${process.currentVersion}.0`, 14, 27);
    doc.line(14, 30, 196, 30);

    const activity = allActivities.find(a => a.id === process.vvtId);
    const usedResourceIds = new Set<string>();
    version.model_json.nodes.forEach(n => n.resourceIds?.forEach(id => usedResourceIds.add(id)));
    const resNames = resources.filter(r => usedResourceIds.has(r.id)).map(r => r.name).join(', ') || '---';

    autoTable(doc, {
      startY: 35,
      body: [
        ['Verantwortlich', jobTitles.find(j => j.id === process.ownerRoleId)?.name || '---'],
        ['Freigabestatus', `Freigegeben am ${now} durch ${jobTitles.find(j => j.id === process.ownerRoleId)?.name || 'System'}`],
        ['Verfahrensverzeichnis', activity?.name || '---'],
        ['Eingang (ISO)', process.inputs || '---'],
        ['Ausgang (ISO)', process.outputs || '---'],
        ['IT-Systeme', resNames]
      ],
      theme: 'grid',
      styles: { fontSize: 7, font: 'helvetica' },
      columnStyles: { 0: { fontStyle: 'bold', width: 45, fillColor: [248, 250, 252] } }
    });

    const graphY = (doc as any).lastAutoTable.finalY + 10;
    const tableY = await drawProcessGraph(doc, version, graphY);

    autoTable(doc, {
      startY: tableY,
      head: [['Nr', 'Arbeitsschritt', 'Rolle', 'Durchführung', 'Nächste Schritte']],
      body: version.model_json.nodes.map((n, i) => {
        const successors = version.model_json.edges
          .filter(e => e.source === n.id)
          .map(e => {
            const targetNode = version.model_json.nodes.find(node => node.id === e.target);
            const targetIdx = version.model_json.nodes.findIndex(node => node.id === e.target) + 1;
            const label = e.label && String(e.label).trim() ? `[${e.label}] ` : '';
            return `${label}-> (${targetIdx}) ${targetNode?.title}`;
          }).join('\n');

        return [
          `${i + 1}`,
          { content: n.title, styles: { fontStyle: 'bold' } }, 
          jobTitles.find(j => j.id === n.roleId)?.name || '-',
          { content: `${n.description || ''}${n.checklist?.length ? '\n- ' + n.checklist.join('\n- ') : ''}` },
          { content: successors || 'Ende' }
        ];
      }),
      theme: 'striped',
      styles: { fontSize: 6.5, font: 'helvetica', overflow: 'linebreak' },
      headStyles: { font: 'helvetica', fillColor: [71, 85, 105] },
      columnStyles: { 0: { width: 8 }, 1: { width: 35 }, 3: { width: 75 }, 4: { width: 35 } }
    });

    addPageDecorations(doc, tenant);
    doc.save(`Prozess_${process.title.replace(/\s+/g, '_')}.pdf`);
  } catch (error) {
    console.error('Export fehlgeschlagen:', error);
  }
}
