
'use client';

import { Process, ProcessVersion, Tenant, JobTitle } from './types';

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
 * Enthält Logo, Stammdaten, Leitfaden und Diagramm-Notiz.
 */
export async function exportDetailedProcessPdf(
  process: Process,
  version: ProcessVersion,
  tenant: Tenant,
  jobTitles: JobTitle[]
) {
  try {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString('de-DE');

    // 1. Header & Logo
    if (tenant.logoUrl) {
      try {
        doc.addImage(tenant.logoUrl, 'PNG', 14, 10, 30, 30);
      } catch (e) {}
    }
    
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235);
    doc.text(process.title, 50, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Prozessbericht V${version.version}.0`, 50, 32);
    doc.text(`Mandant: ${tenant.name}`, 50, 37);
    doc.text(`Erstellungsdatum: ${timestamp}`, 14, 45);

    // 2. Stammdaten Tabelle
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('1. Stammdaten', 14, 55);
    
    autoTable(doc, {
      startY: 60,
      body: [
        ['Bezeichnung', process.title],
        ['Status', process.status.toUpperCase()],
        ['Regulatorik', process.regulatoryFramework || 'Nicht definiert'],
        ['Zusammenfassung', process.description || '-']
      ],
      theme: 'grid',
      styles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold', width: 40 } }
    });

    // 3. Leitfaden (Operative Schritte)
    doc.text('2. Operativer Leitfaden', 14, (doc as any).lastAutoTable.finalY + 15);
    
    const stepsData = version.model_json.nodes.map((node, i) => {
      const role = jobTitles.find(j => j.id === node.roleId);
      return [
        (i + 1).toString(),
        node.title,
        role?.name || '-',
        node.description || '-',
        (node.checklist || []).join('\n')
      ];
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['#', 'Schritt', 'Verantwortung', 'Tätigkeit', 'Prüfschritte']],
      body: stepsData,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 8 }
    });

    // 4. Diagramm-Anhang (Text-Repräsentation für den Druck)
    doc.addPage();
    doc.setFontSize(14);
    doc.text('3. Visuelle Prozesslogik', 14, 20);
    doc.setFontSize(10);
    doc.text('Logische Verknüpfungen (Diagramm-Zusammenfassung):', 14, 30);

    const edgesData = version.model_json.edges.map(edge => {
      const src = version.model_json.nodes.find(n => n.id === edge.source);
      const trg = version.model_json.nodes.find(n => n.id === edge.target);
      return [`${src?.title}`, `-->`, `${trg?.title}`, `${edge.label || '-'}`];
    });

    autoTable(doc, {
      startY: 35,
      head: [['Von', '', 'Nach', 'Bedingung']],
      body: edgesData,
      theme: 'plain',
      styles: { fontSize: 8 }
    });

    doc.save(`Prozessbericht_${process.title.replace(/\s+/g, '_')}_V${version.version}.pdf`);
  } catch (error) {
    console.error('PDF Export fehlgeschlagen:', error);
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
          const user = users.find(u => u.id === uid);
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
    console.error('PDF Export fehlgeschlagen:', error);
  }
}
