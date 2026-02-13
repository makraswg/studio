'use client';

import { Process, ProcessVersion, Tenant, JobTitle, ProcessingActivity, Resource, RiskMeasure, Policy, PolicyVersion, Department } from './types';

/**
 * Utility-Modul für den Export von Daten (PDF & Excel).
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
      'Netto-Wahrscheinlichkeit': r.residualProbability || '---',
      'Netto-Schaden': r.residualImpact || '---',
      'Netto-Score': (r.residualProbability && r.residualImpact) ? r.residualProbability * r.residualImpact : '---',
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
 * Offizieller VVT-Bericht nach Art. 30 DSGVO (PDF).
 */
export async function exportGdprPdf(
  activity: ProcessingActivity,
  tenant: Tenant,
  resources: Resource[],
  toms: RiskMeasure[]
) {
  try {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString('de-DE');

    // Header
    doc.setFontSize(18);
    doc.setTextColor(5, 150, 105); // Emerald
    doc.text('Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO)', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Mandant: ${tenant.name}`, 14, 28);
    doc.text(`Exportdatum: ${timestamp}`, 14, 33);

    // 1. Stammdaten
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`1. Bezeichnung: ${activity.name}`, 14, 45);
    
    autoTable(doc, {
      startY: 50,
      body: [
        ['Version', activity.version || '1.0'],
        ['Zuständige Abteilung', activity.responsibleDepartment || '-'],
        ['Status', activity.status.toUpperCase()],
        ['Rechtsgrundlage', activity.legalBasis || '-'],
        ['Aufbewahrungsfrist', activity.retentionPeriod || '-'],
        ['Zweckbeschreibung', activity.description || '-']
      ],
      theme: 'grid',
      styles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold', width: 50 } }
    });

    // 2. Transfer & Rollen
    doc.text('2. Übermittlung & Verantwortlichkeit', 14, (doc as any).lastAutoTable.finalY + 15);
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      body: [
        ['Gemeinsame Verantw.', activity.jointController ? 'JA' : 'NEIN'],
        ['Drittstaatentransfer', activity.thirdCountryTransfer ? 'JA' : 'NEIN'],
        ['Zielland', activity.targetCountry || '-'],
        ['Transfer-Mechanismus', activity.transferMechanism || 'Keiner']
      ],
      theme: 'grid',
      styles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold', width: 50 } }
    });

    // 3. IT-Systeme
    doc.text('3. Involvierte IT-Ressourcen', 14, (doc as any).lastAutoTable.finalY + 15);
    const resourceData = resources.map(r => [r.name, r.assetType, r.dataLocation || '-', r.criticality.toUpperCase()]);
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['System', 'Typ', 'Standort', 'Schutzbedarf']],
      body: resourceData.length > 0 ? resourceData : [['Keine Systeme verknüpft', '', '', '']],
      theme: 'striped',
      headStyles: { fillColor: [5, 150, 105] },
      styles: { fontSize: 8 }
    });

    // 4. TOM (Art. 32)
    doc.addPage();
    doc.setFontSize(14);
    doc.text('4. Technisch-organisatorische Maßnahmen (Art. 32 DSGVO)', 14, 20);
    const tomData = toms.map(t => [t.title, t.tomCategory || '-', t.status.toUpperCase(), t.effectiveness === 5 ? 'HOCH' : 'MITTEL']);
    autoTable(doc, {
      startY: 25,
      head: [['Kontrolle / Maßnahme', 'Kategorie', 'Status', 'Wirksamkeit']],
      body: tomData.length > 0 ? tomData : [['Keine automatisierten TOM hinterlegt', '', '', '']],
      theme: 'striped',
      headStyles: { fillColor: [5, 150, 105] },
      styles: { fontSize: 8 }
    });

    doc.save(`VVT_Bericht_${activity.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('PDF Export fehlgeschlagen:', error);
  }
}

export async function exportResourcesExcel(resources: any[]) {
  const data = resources.map(r => ({
    'Name': r.name,
    'Typ': r.assetType,
    'Kategorie': r.category,
    'Modell': r.operatingModel,
    'Kritikalität': r.criticality,
    'Schutzbedarf (V)': r.confidentialityReq,
    'Schutzbedarf (I)': r.integrityReq,
    'Schutzbedarf (V)': r.availabilityReq,
    'Pers. Daten': r.hasPersonalData ? 'JA' : 'NEIN',
    'System Owner': r.systemOwner,
    'Risk Owner': r.riskOwner
  }));
  await exportToExcel(data, `Ressourcenkatalog_${new Date().toISOString().split('T')[0]}`);
}

/**
 * Detaillierter Prozessbericht (PDF)
 */
export async function exportDetailedProcessPdf(
  process: Process,
  version: ProcessVersion,
  tenant: Tenant,
  jobTitles: JobTitle[],
  departments: Department[]
) {
  try {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString('de-DE');
    const dept = departments.find(d => d.id === process.responsibleDepartmentId);
    const owner = jobTitles.find(j => j.id === process.ownerRoleId);

    // Header
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235); // Primary Blue
    doc.text(process.title, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Prozessbericht V${version.version}.0`, 14, 28);
    doc.text(`Mandant: ${tenant.name} | Abteilung: ${dept?.name || '---'}`, 14, 33);
    doc.text(`Exportdatum: ${timestamp}`, 14, 38);

    doc.setDrawColor(200);
    doc.line(14, 42, 196, 42);

    // 1. Stammdaten
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('1. Stammdaten & Governance', 14, 52);
    
    autoTable(doc, {
      startY: 56,
      body: [
        ['Bezeichnung', process.title],
        ['Status', process.status.toUpperCase()],
        ['Process Owner', owner?.name || '---'],
        ['Automatisierung', process.automationLevel || 'manual'],
        ['Frequenz', process.processingFrequency || 'on_demand'],
        ['Eingang (Inputs)', process.inputs || '-'],
        ['Ergebnis (Outputs)', process.outputs || '-'],
        ['Beschreibung', process.description || '-']
      ],
      theme: 'grid',
      styles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold', width: 45, fillColor: [245, 247, 250] } }
    });

    // 2. Operativer Leitfaden
    doc.text('2. Arbeitsschritte & Checklisten', 14, (doc as any).lastAutoTable.finalY + 15);
    
    const stepsData = (version.model_json.nodes || []).map((node, i) => {
      const role = jobTitles.find(j => j.id === node.roleId);
      return [
        node.title,
        role?.name || '-',
        node.description || '-',
        (node.checklist || []).join('\n')
      ];
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Schritt', 'Verantwortung', 'Tätigkeit', 'Prüfschritte']],
      body: stepsData.length > 0 ? stepsData : [['Keine Schritte definiert', '', '', '']],
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 8 },
      columnStyles: { 3: { width: 50 } }
    });

    doc.save(`Prozessbericht_${process.title.replace(/\s+/g, '_')}_V${version.version}.pdf`);
  } catch (error) {
    console.error('PDF Export fehlgeschlagen:', error);
  }
}

/**
 * Unternehmens-Handbuch: Alle Prozesse gruppiert nach Abteilungen
 */
export async function exportProcessManualPdf(
  processes: Process[],
  versions: ProcessVersion[],
  tenant: Tenant,
  departments: Department[],
  jobTitles: JobTitle[]
) {
  try {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    const now = new Date().toLocaleDateString('de-DE');

    // Deckblatt
    doc.setFontSize(30);
    doc.setTextColor(37, 99, 235);
    doc.text('Unternehmens-Handbuch', 105, 80, { align: 'center' });
    
    doc.setFontSize(18);
    doc.setTextColor(100);
    doc.text(tenant.name, 105, 95, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Stand: ${now}`, 105, 110, { align: 'center' });
    doc.text(`Umfang: ${processes.length} Workflows`, 105, 117, { align: 'center' });

    // Inhaltsverzeichnis simulieren
    doc.addPage();
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('Inhaltsverzeichnis', 14, 20);
    
    let tocY = 35;
    departments.forEach(dept => {
      const deptProcs = processes.filter(p => p.responsibleDepartmentId === dept.id);
      if (deptProcs.length === 0) return;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(dept.name, 14, tocY);
      tocY += 7;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      deptProcs.forEach(p => {
        doc.text(`- ${p.title}`, 20, tocY);
        tocY += 6;
        if (tocY > 270) { doc.addPage(); tocY = 20; }
      });
      tocY += 5;
    });

    // Hauptteil
    departments.forEach(dept => {
      const deptProcs = processes.filter(p => p.responsibleDepartmentId === dept.id);
      if (deptProcs.length === 0) return;

      doc.addPage();
      doc.setFontSize(20);
      doc.setTextColor(37, 99, 235);
      doc.text(`Abteilung: ${dept.name}`, 14, 30);
      doc.line(14, 35, 196, 35);

      deptProcs.forEach(p => {
        const ver = versions.find(v => v.process_id === p.id && v.version === p.currentVersion);
        if (!ver) return;

        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text(p.title, 14, (doc as any).lastAutoTable?.finalY + 25 || 50);
        
        autoTable(doc, {
          startY: (doc as any).lastAutoTable?.finalY + 30 || 55,
          head: [['Schritt', 'Rolle', 'Beschreibung']],
          body: ver.model_json.nodes.map(n => [
            n.title, 
            jobTitles.find(j => j.id === n.roleId)?.name || '-',
            n.description || '-'
          ]),
          theme: 'striped',
          headStyles: { fillColor: [100, 116, 139] },
          styles: { fontSize: 8 }
        });
      });
    });

    doc.save(`Unternehmens_Handbuch_${tenant.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('Handbuch Export fehlgeschlagen:', error);
  }
}

export async function exportComplianceReportPdf(
  users: any[],
  resources: any[],
  assignments: any[],
  auditLogs: any[]
) {
  try {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString('de-DE');

    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235);
    doc.text('ComplianceHub Compliance Statusbericht', 14, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Erstellungsdatum: ${timestamp}`, 14, 35);
    doc.text('Status: Vertraulich / Intern', 14, 40);

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('1. Zusammenfassung der IAM-Umgebung', 14, 55);
    
    const statsData = [
      ['Metrik', 'Wert'],
      ['Gesamtbenutzer', (users?.length || 0).toString()],
      ['Systeme im Katalog', (resources?.length || 0).toString()],
      ['Aktive Zugriffsberechtigungen', (assignments?.filter((a: any) => a.status === 'active').length || 0).toString()],
      ['Review-Fortschritt', `${Math.round((assignments?.filter((a: any) => !!a.lastReviewedAt).length / (assignments?.length || 1)) * 100)}%`]
    ];

    autoTable(doc, {
      startY: 60,
      head: [['Metrik', 'Wert']],
      body: statsData.slice(1),
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] }
    });

    doc.save(`Compliance_Statusbericht_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('Compliance Export fehlgeschlagen:', error);
  }
}

export async function exportFullComplianceReportPdf(
  users: any[],
  resources: any[],
  entitlements: any[],
  assignments: any[],
  mode: 'user' | 'resource'
) {
  try {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString('de-DE');

    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235);
    doc.text('Detaillierter Compliance Zuweisungsbericht', 14, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Struktur: Gruppiert nach ${mode === 'user' ? 'Benutzern' : 'Ressourcen'}`, 14, 35);
    doc.text(`Erstellungsdatum: ${timestamp}`, 14, 40);

    let startY = 50;

    if (mode === 'user') {
      const activeAssignments = assignments.filter(a => a.status !== 'removed');
      const uniqueUserIds = [...new Set(activeAssignments.map(a => a.userId))];
      
      uniqueUserIds.forEach((uid, index) => {
        const user = users.find(u => u.id === uid);
        const userAssignments = activeAssignments.filter(a => a.userId === uid);
        
        if (startY > 250) { doc.addPage(); startY = 20; }

        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`${index + 1}. ${user?.displayName || uid} (${user?.email || 'keine E-Mail'})`, 14, startY);
        startY += 5;

        const tableData = userAssignments.map(a => {
          const ent = entitlements.find(e => e.id === a.entitlementId);
          const res = resources.find(r => r.id === ent?.resourceId);
          return [
            res?.name || 'Unbekanntes System',
            ent?.name || 'Unbekannte Rolle',
            ent?.riskLevel?.toUpperCase() || 'MEDIUM',
            a.status.toUpperCase(),
            a.validUntil ? new Date(a.validUntil).toLocaleDateString() : 'Unbefristet'
          ];
        });

        autoTable(doc, {
          startY: startY,
          head: [['System', 'Rolle', 'Risiko', 'Status', 'Gültigkeit']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [37, 99, 235] },
          styles: { fontSize: 8 },
          margin: { left: 14 }
        });

        startY = (doc as any).lastAutoTable.finalY + 15;
      });
    } else {
      const activeAssignments = assignments.filter(a => a.status !== 'removed');
      resources.forEach((res, index) => {
        const resAssignments = activeAssignments.filter(a => {
          const ent = entitlements.find(e => e.id === a.entitlementId);
          return ent?.resourceId === res.id;
        });

        if (resAssignments.length === 0) return;

        if (startY > 250) { doc.addPage(); startY = 20; }

        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`${index + 1}. System: ${res.name}`, 14, startY);
        startY += 5;

        const tableData = resAssignments.map(a => {
          const user = users.find(u => u.id === a.userId);
          const ent = entitlements.find(e => e.id === a.entitlementId);
          return [
            user?.displayName || a.userId,
            user?.email || '-',
            ent?.name || 'Unbekannte Rolle',
            a.status.toUpperCase(),
            a.validUntil ? new Date(a.validUntil).toLocaleDateString() : 'Unbefristet'
          ];
        });

        autoTable(doc, {
          startY: startY,
          head: [['Benutzer', 'E-Mail', 'Rolle', 'Status', 'Gültigkeit']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [37, 99, 235] },
          styles: { fontSize: 8 },
          margin: { left: 14 }
        });

        startY = (doc as any).lastAutoTable.finalY + 15;
      });
    }

    doc.save(`Compliance_Detailbericht_${mode}_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('Compliance Export fehlgeschlagen:', error);
  }
}

/**
 * Richtlinien-Export als PDF.
 */
export async function exportPolicyPdf(policy: Policy, version: PolicyVersion, tenantName: string) {
  try {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleDateString('de-DE');

    // Branding
    doc.setFontSize(22);
    doc.setTextColor(5, 150, 105); // Emerald Green
    doc.text(policy.title, 14, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Mandant: ${tenantName}`, 14, 33);
    doc.text(`Stand: ${timestamp} • Version ${version.version}.${version.revision}`, 14, 38);
    
    doc.setDrawColor(200);
    doc.line(14, 45, 196, 45);

    // Metadata Table
    autoTable(doc, {
      startY: 50,
      body: [
        ['ID', policy.id],
        ['Dokumenten-Typ', policy.type],
        ['Status', policy.status.toUpperCase()],
        ['Letzte Änderung', version.changelog || '-']
      ],
      theme: 'grid',
      styles: { fontSize: 8 },
      columnStyles: { 0: { fontStyle: 'bold', width: 40 } }
    });

    // Main Content
    doc.setFontSize(12);
    doc.setTextColor(0);
    const splitContent = doc.splitTextToSize(version.content, 180);
    doc.text(splitContent, 14, (doc as any).lastAutoTable.finalY + 15);

    doc.save(`Richtlinie_${policy.title.replace(/\s+/g, '_')}_V${version.version}.pdf`);
  } catch (error) {
    console.error('Policy PDF Export failed:', error);
  }
}

/**
 * Richtlinien-Export als DOCX (Pragmatische HTML-Blob Lösung).
 */
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
        ${version.content.replace(/\n/g, '<br/>')}
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', content], {
    type: 'application/msword'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Richtlinie_${policy.title.replace(/\s+/g, '_')}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
