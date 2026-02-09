'use server';

import { saveCollectionRecord } from './mysql-actions';
import { DataSource, Risk, RiskMeasure, Process, ProcessingActivity, Resource, Feature, User, Assignment, JobTitle, ProcessNode, ProcessOperation, RiskControl, PlatformUser, DataSubjectGroup, DataCategory } from '@/lib/types';
import { logAuditEventAction } from './audit-actions';

/**
 * Generiert eine massive Menge an vernetzten Demo-Daten für eine Wohnungsbaugesellschaft.
 * Fokus: Maximale Konsistenz über alle Hubs hinweg (The Golden Chain).
 */
export async function seedDemoDataAction(dataSource: DataSource = 'mysql', actorEmail: string = 'system') {
  try {
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const offsetDate = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d.toISOString();
    };

    // --- 1. MANDANTEN ---
    const t1Id = 't-wohnbau-01';
    await saveCollectionRecord('tenants', t1Id, {
      id: t1Id, 
      name: 'Wohnbau Nord GmbH', 
      slug: 'wohnbau-nord', 
      status: 'active', 
      region: 'EU-DSGVO', 
      createdAt: offsetDate(60),
      companyDescription: 'Mittelständische Wohnungsbaugesellschaft mit ca. 5.000 Wohneinheiten. Fokus auf Mietverwaltung, Bestandsentwicklung und soziale Stadtentwicklung. IT-Strategie: Cloud-First mit ERP-Fokus auf Aareon Wodis Sigma.'
    }, dataSource);

    // --- 2. ABTEILUNGEN ---
    const departmentsData = [
      { id: 'd-mgmt', tenantId: t1Id, name: 'Geschäftsführung' },
      { id: 'd-best', tenantId: t1Id, name: 'Bestandsmanagement' },
      { id: 'd-fibu', tenantId: t1Id, name: 'Finanzbuchhaltung' },
      { id: 'd-it', tenantId: t1Id, name: 'IT & Digitalisierung' },
      { id: 'd-hr', tenantId: t1Id, name: 'Personalwesen' },
      { id: 'd-tech', tenantId: t1Id, name: 'Technik / Instandhaltung' },
      { id: 'd-mkt', tenantId: t1Id, name: 'Marketing & Kommunikation' },
      { id: 'd-legal', tenantId: t1Id, name: 'Recht & Datenschutz' }
    ];
    for (const d of departmentsData) await saveCollectionRecord('departments', d.id, { ...d, status: 'active' }, dataSource);

    // --- 3. DSGVO STAMMDATEN ---
    const subjectGroups: DataSubjectGroup[] = [
      { id: 'dsg-mieter', name: 'Mieter', tenantId: t1Id, status: 'active' },
      { id: 'dsg-interessent', name: 'Mietinteressenten', tenantId: t1Id, status: 'active' },
      { id: 'dsg-mitarbeiter', name: 'Mitarbeiter', tenantId: t1Id, status: 'active' },
      { id: 'dsg-handwerker', name: 'Handwerker / Dienstleister', tenantId: t1Id, status: 'active' },
      { id: 'dsg-eigentuemer', name: 'WEG-Eigentümer', tenantId: t1Id, status: 'active' }
    ];
    for (const g of subjectGroups) await saveCollectionRecord('dataSubjectGroups', g.id, g, dataSource);

    const dataCategories: DataCategory[] = [
      { id: 'dcat-stamm', name: 'Identifikationsdaten / Stammdaten', tenantId: t1Id, status: 'active', isGdprRelevant: true },
      { id: 'dcat-bank', name: 'Bankverbindungen / Zahlungsdaten', tenantId: t1Id, status: 'active', isGdprRelevant: true },
      { id: 'dcat-bonitaet', name: 'Bonitätsdaten (Schufa / Crefo)', tenantId: t1Id, status: 'active', isGdprRelevant: true },
      { id: 'dcat-verbrauch', name: 'Verbrauchs- und Abrechnungsdaten', tenantId: t1Id, status: 'active', isGdprRelevant: true },
      { id: 'dcat-bewerbung', name: 'Bewerberdaten (HR)', tenantId: t1Id, status: 'active', isGdprRelevant: true },
      { id: 'dcat-gebaeude', name: 'Gebäude- und Objektdaten', tenantId: t1Id, status: 'active', isGdprRelevant: false }
    ];
    for (const c of dataCategories) await saveCollectionRecord('dataCategories', c.id, c, dataSource);

    // --- 4. RESSOURCEN ---
    const resourcesData = [
      { id: 'res-wodis', name: 'Aareon Wodis Sigma', assetType: 'Software', operatingModel: 'SaaS Shared', criticality: 'high', isDataRepository: true },
      { id: 'res-archiv', name: 'Aareon Archiv Kompakt', assetType: 'Software', operatingModel: 'SaaS Shared', criticality: 'high', isDataRepository: true },
      { id: 'res-m365', name: 'Microsoft 365', assetType: 'Cloud Service', operatingModel: 'Cloud', criticality: 'medium', isIdentityProvider: true },
      { id: 'res-ad', name: 'Active Directory', assetType: 'Infrastruktur', operatingModel: 'On-Premise', criticality: 'high', isIdentityProvider: true },
      { id: 'res-mareon', name: 'Mareon Handwerkerportal', assetType: 'Software', operatingModel: 'SaaS Shared', criticality: 'medium', isDataRepository: false },
      { id: 'res-sql-cluster', name: 'MS SQL Cluster (Local)', assetType: 'Infrastruktur', operatingModel: 'On-Premise', criticality: 'high', isDataRepository: true }
    ];
    for (const r of resourcesData) {
      await saveCollectionRecord('resources', r.id, { 
        ...r, tenantId: t1Id, status: 'active', createdAt: offsetDate(45), 
        confidentialityReq: r.criticality, integrityReq: r.criticality, availabilityReq: r.criticality,
        dataClassification: r.criticality === 'high' ? 'confidential' : 'internal',
        hasPersonalData: true, 
        dataLocation: r.operatingModel === 'On-Premise' ? 'RZ Hamburg' : 'Azure West Europe'
      }, dataSource);
    }

    // --- 5. SYSTEMROLLEN (ENTITLEMENTS) ---
    const entitlementsData = [
      { id: 'e-wodis-user', resourceId: 'res-wodis', name: 'Standard-Anwender', riskLevel: 'low', isAdmin: false },
      { id: 'e-wodis-admin', resourceId: 'res-wodis', name: 'Key-User / Admin', riskLevel: 'high', isAdmin: true },
      { id: 'e-archiv-read', resourceId: 'res-archiv', name: 'Archiv-Leser', riskLevel: 'low', isAdmin: false },
      { id: 'e-m365-user', resourceId: 'res-m365', name: 'Office Standard', riskLevel: 'low', isAdmin: false },
      { id: 'e-ad-user', resourceId: 'res-ad', name: 'Domain User', riskLevel: 'low', isAdmin: false },
      { id: 'e-mareon-tech', resourceId: 'res-mareon', name: 'Technik-Sachbearbeiter', riskLevel: 'medium', isAdmin: false }
    ];
    for (const e of entitlementsData) await saveCollectionRecord('entitlements', e.id, { ...e, tenantId: t1Id }, dataSource);

    // --- 6. STELLEN-BLUEPRINTS (RBAC) ---
    const jobsData = [
      { id: 'j-immo-kfm', departmentId: 'd-best', name: 'Immobilienkaufmann', ents: ['e-wodis-user', 'e-archiv-read', 'e-m365-user', 'e-ad-user'] },
      { id: 'j-it-admin', departmentId: 'd-it', name: 'Systemadministrator', ents: ['e-wodis-admin', 'e-m365-user', 'e-ad-user'] },
      { id: 'j-tech-ref', departmentId: 'd-tech', name: 'Technischer Referent', ents: ['e-mareon-tech', 'e-m365-user', 'e-ad-user'] },
      { id: 'j-gf', departmentId: 'd-mgmt', name: 'Geschäftsführer', ents: ['e-m365-user', 'e-ad-user'] }
    ];
    for (const j of jobsData) {
      await saveCollectionRecord('jobTitles', j.id, { 
        id: j.id, tenantId: t1Id, departmentId: j.departmentId, name: j.name, 
        status: 'active', entitlementIds: j.ents, description: `Standard-Blueprint für die Rolle ${j.name}.`
      }, dataSource);
    }

    // --- 7. PROZESSE & VVT (Detailed Chain) ---
    const processRegistry = [
      { id: 'p-int-mgmt', title: 'Interessentenmanagement', dept: 'd-best', vvt: 'vvt-lead', next: 'p-vermietung', cats: ['dcat-stamm'], groups: ['dsg-interessent'] },
      { id: 'p-vermietung', title: 'Mietvertragsabschluss', dept: 'd-best', vvt: 'vvt-contract', next: 'p-uebergabe', cats: ['dcat-stamm', 'dcat-bank', 'dcat-bonitaet'], groups: ['dsg-mieter'] },
      { id: 'p-uebergabe', title: 'Wohnungsübergabe', dept: 'd-tech', vvt: 'vvt-handover', cats: ['dcat-gebaeude'], groups: ['dsg-mieter'] },
      { id: 'p-maengel', title: 'Mängelanzeige (Mieter)', dept: 'd-best', vvt: 'vvt-support', next: 'p-instandhaltung', cats: ['dcat-stamm'], groups: ['dsg-mieter'] },
      { id: 'p-instandhaltung', title: 'Instandsetzungsauftrag', dept: 'd-tech', vvt: 'vvt-workorder', cats: ['dcat-gebaeude'], groups: ['dsg-handwerker'], complex: true },
      { id: 'p-bk-abr', title: 'Betriebskostenabrechnung', dept: 'd-best', vvt: 'vvt-utilities', cats: ['dcat-verbrauch', 'dcat-bank'], groups: ['dsg-mieter'] }
    ];

    for (const p of processRegistry) {
      // Create VVT
      await saveCollectionRecord('processingActivities', p.vvt, {
        id: p.vvt, tenantId: t1Id, name: `VVT: ${p.title}`, status: 'active', version: '1.0',
        responsibleDepartment: departmentsData.find(d => d.id === p.dept)?.name || 'General',
        legalBasis: 'Art. 6 Abs. 1 lit. b (Vertrag)', 
        description: `Dokumentation der Verarbeitungstätigkeiten für den Prozess ${p.title}.`,
        retentionPeriod: '10 Jahre nach Abschluss', lastReviewDate: today
      }, dataSource);

      // Create Process
      await saveCollectionRecord('processes', p.id, {
        id: p.id, tenantId: t1Id, title: p.title, status: 'published', currentVersion: 1,
        responsibleDepartmentId: p.dept, vvtId: p.vvt, createdAt: offsetDate(30), updatedAt: now,
        automationLevel: 'partial', dataVolume: 'medium', processingFrequency: 'daily'
      }, dataSource);

      // --- BRANCHING LOGIC FOR INSTANDHALTUNG ---
      let nodes: ProcessNode[] = [];
      let edges: any[] = [];
      let positions: any = {};

      if (p.complex) {
        nodes = [
          { id: 'start', type: 'start', title: 'Meldungseingang' },
          { 
            id: 'step1', type: 'step', title: 'Schadensaufnahme', 
            roleId: 'j-tech-ref', resourceIds: ['res-m365'], 
            dataCategoryIds: p.cats, subjectGroupIds: p.groups,
            description: 'Der technische Mitarbeiter prüft den Mangel vor Ort oder per Foto.',
            tips: 'Achten Sie auf Versicherungsschäden (Leitungswasser).',
            checklist: ['Schadensbild dokumentieren', 'Kostenschätzung erstellen']
          },
          { 
            id: 'dec1', type: 'decision', title: 'Großauftrag > 1.000€?', 
            description: 'Überschreiten die geschätzten Kosten die Kompetenzgrenze des Referenten?'
          },
          { 
            id: 'step2a', type: 'step', title: 'Freigabe Geschäftsführung', 
            roleId: 'j-gf', resourceIds: ['res-m365'], 
            description: 'Manuelle Genehmigung durch die Geschäftsleitung erforderlich.',
            errors: 'Häufig wird die Kostenschätzung nicht angehängt.'
          },
          { 
            id: 'step3', type: 'step', title: 'Beauftragung Handwerker', 
            roleId: 'j-tech-ref', resourceIds: ['res-mareon', 'res-wodis'], 
            description: 'Erstellung des Auftrags im Mareon Portal.',
            checklist: ['Handwerker wählen', 'Termin avisieren', 'Auftrag in Wodis buchen']
          },
          { id: 'end', type: 'end', title: 'Abschluss' }
        ];

        edges = [
          { id: 'e1', source: 'start', target: 'step1' },
          { id: 'e2', source: 'step1', target: 'dec1' },
          { id: 'e3', source: 'dec1', target: 'step2a', label: 'Ja' },
          { id: 'e4', source: 'dec1', target: 'step3', label: 'Nein' },
          { id: 'e5', source: 'step2a', target: 'step3' },
          { id: 'e6', source: 'step3', target: 'end' }
        ];

        positions = {
          start: { x: 50, y: 150 },
          step1: { x: 200, y: 150 },
          dec1: { x: 450, y: 150 },
          step2a: { x: 450, y: 300 },
          step3: { x: 700, y: 150 },
          end: { x: 950, y: 150 }
        };
      } else {
        nodes = [
          { id: 'start', type: 'start', title: 'Start' },
          { 
            id: 'step1', type: 'step', title: 'Datenerfassung', 
            roleId: 'j-immo-kfm', resourceIds: ['res-m365'], 
            dataCategoryIds: p.cats, subjectGroupIds: p.groups,
            description: 'Erfassung der notwendigen Informationen.' 
          },
          { 
            id: 'step2', type: 'step', title: 'System-Eintrag', 
            roleId: 'j-immo-kfm', resourceIds: ['res-wodis'], 
            dataCategoryIds: p.cats, subjectGroupIds: p.groups,
            description: 'Übernahme in das führende ERP System.' 
          },
          { id: 'end', type: p.next ? 'subprocess' : 'end', title: p.next ? 'Weiterleitung' : 'Ende', targetProcessId: p.next || undefined }
        ];

        edges = [
          {id:'e1',source:'start',target:'step1'}, {id:'e2',source:'step1',target:'step2'}, {id:'e3',source:'step2',target:'end'}
        ];

        positions = {start:{x:50,y:100},step1:{x:200,y:100},step2:{x:450,y:100},end:{x:700,y:100}};
      }

      await saveCollectionRecord('process_versions', `ver-${p.id}-1`, {
        id: `ver-${p.id}-1`, process_id: p.id, version: 1, 
        model_json: { nodes, edges },
        layout_json: { positions },
        revision: 1, created_at: offsetDate(30)
      }, dataSource);
    }

    // --- 8. RISIKEN & KONTROLLEN ---
    const r1Id = 'rk-data-loss';
    await saveCollectionRecord('risks', r1Id, {
      id: r1Id, tenantId: t1Id, title: 'Datenverlust im ERP (Wodis)', 
      category: 'IT-Sicherheit', impact: 5, probability: 2, status: 'active', assetId: 'res-wodis', 
      owner: 'CISO', createdAt: offsetDate(20), description: 'Szenario eines technischen Defekts im Cloud-Rechenzentrum.'
    }, dataSource);

    const m1Id = 'msr-backup';
    await saveCollectionRecord('riskMeasures', m1Id, {
      id: m1Id, riskIds: [r1Id], resourceIds: ['res-wodis'], title: 'Revisionssicheres Backup & Restore', 
      description: 'Regelmäßige Sicherung der SQL-Datenbanken und der Dateisysteme auf getrennten Speichermedien.',
      owner: 'Aareon Support', status: 'completed', isTom: true, tomCategory: 'Verfügbarkeitskontrolle', 
      dueDate: in30Days, effectiveness: 5
    }, dataSource);

    await saveCollectionRecord('riskControls', 'ctrl-backup-01', {
      id: 'ctrl-backup-01', measureId: m1Id, title: 'Wöchentlicher Backup-Report Check', 
      owner: 'IT-Leitung', status: 'completed', isEffective: true, checkType: 'Review',
      lastCheckDate: today, nextCheckDate: in30Days, evidenceDetails: 'Report vom Sonntag liegt vor. Keine Fehler.'
    }, dataSource);

    const m2Id = 'msr-mfa';
    await saveCollectionRecord('riskMeasures', m2Id, {
      id: m2Id, riskIds: [r1Id], resourceIds: ['res-m365', 'res-wodis'], title: 'Multi-Faktor Authentifizierung (MFA)',
      description: 'Zwingende Nutzung von MFA für alle administrativen und externen Zugriffe.',
      owner: 'IT-Security', status: 'active', isTom: true, tomCategory: 'Zugriffskontrolle',
      dueDate: in30Days, effectiveness: 4
    }, dataSource);

    // --- 9. AUDIT LOG ---
    for (let i = 0; i < 15; i++) {
      const lid = `audit-seed-${i}`;
      await saveCollectionRecord('auditEvents', lid, {
        id: lid, tenantId: t1Id, actorUid: actorEmail, 
        action: `Demo-Aktion #${i}: Konfiguration angepasst.`,
        entityType: 'system', entityId: 'setup',
        timestamp: offsetDate(i),
        before: { step: i }, after: { step: i + 1 }
      }, dataSource);
    }

    await logAuditEventAction(dataSource, {
      tenantId: 'global', actorUid: actorEmail, action: 'High-Fidelity Demo-Daten eingespielt (Branching-Prozesse + GRC).',
      entityType: 'system', entityId: 'seed-v8'
    });

    return { success: true, message: "Enterprise Szenario V8 (Branching Logic) erfolgreich geladen. Prüfen Sie den Prozess 'Instandsetzungsauftrag' für die neue Weichen-Visualisierung." };
  } catch (e: any) {
    console.error("Seeding Error:", e);
    return { success: false, error: e.message };
  }
}
