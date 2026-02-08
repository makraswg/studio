'use server';

import { saveCollectionRecord } from './mysql-actions';
import { DataSource, Risk, RiskMeasure, Process, ProcessingActivity, Resource, Feature, User, Assignment, JobTitle, Department, ProcessNode, ProcessOperation, RiskControl, PlatformUser } from '@/lib/types';
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

    // --- 2. ABTEILUNGEN (Expanded) ---
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

    // --- 3. RESSOURCEN (Expanded Catalog) ---
    const resourcesData = [
      { id: 'res-wodis', name: 'Aareon Wodis Sigma', assetType: 'Software', operatingModel: 'SaaS Shared', criticality: 'high', isDataRepository: true },
      { id: 'res-archiv', name: 'Aareon Archiv Kompakt', assetType: 'Software', operatingModel: 'SaaS Shared', criticality: 'high', isDataRepository: true },
      { id: 'res-m365', name: 'Microsoft 365', assetType: 'Cloud Service', operatingModel: 'Cloud', criticality: 'medium', isIdentityProvider: true },
      { id: 'res-ad', name: 'Active Directory', assetType: 'Infrastruktur', operatingModel: 'On-Premise', criticality: 'high', isIdentityProvider: true },
      { id: 'res-mareon', name: 'Mareon Handwerkerportal', assetType: 'Software', operatingModel: 'SaaS Shared', criticality: 'medium', isDataRepository: false },
      { id: 'res-sql-cluster', name: 'MS SQL Cluster (Local)', assetType: 'Infrastruktur', operatingModel: 'On-Premise', criticality: 'high', isDataRepository: true },
      { id: 'res-crm-cloud', name: 'PropStack CRM', assetType: 'Software', operatingModel: 'SaaS Public', criticality: 'medium', isDataRepository: false }
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

    // --- 4. SYSTEMROLLEN (ENTITLEMENTS) ---
    const entitlementsData = [
      { id: 'e-wodis-user', resourceId: 'res-wodis', name: 'Standard-Anwender', riskLevel: 'low', isAdmin: false },
      { id: 'e-wodis-admin', resourceId: 'res-wodis', name: 'Key-User / Admin', riskLevel: 'high', isAdmin: true },
      { id: 'e-archiv-read', resourceId: 'res-archiv', name: 'Archiv-Leser', riskLevel: 'low', isAdmin: false },
      { id: 'e-m365-user', resourceId: 'res-m365', name: 'Office Standard', riskLevel: 'low', isAdmin: false },
      { id: 'e-ad-user', resourceId: 'res-ad', name: 'Domain User', riskLevel: 'low', isAdmin: false },
      { id: 'e-mareon-tech', resourceId: 'res-mareon', name: 'Technik-Sachbearbeiter', riskLevel: 'medium', isAdmin: false },
      { id: 'e-sql-sa', resourceId: 'res-sql-cluster', name: 'Database Admin (SA)', riskLevel: 'high', isAdmin: true },
      { id: 'e-crm-sales', resourceId: 'res-crm-cloud', name: 'Vermietungs-Profi', riskLevel: 'low', isAdmin: false }
    ];
    for (const e of entitlementsData) await saveCollectionRecord('entitlements', e.id, { ...e, tenantId: t1Id }, dataSource);

    // --- 5. STELLEN-BLUEPRINTS (RBAC) ---
    const jobsData = [
      { id: 'j-immo-kfm', departmentId: 'd-best', name: 'Immobilienkaufmann', ents: ['e-wodis-user', 'e-archiv-read', 'e-m365-user', 'e-ad-user', 'e-crm-sales'] },
      { id: 'j-fibu-kfm', departmentId: 'd-fibu', name: 'Finanzbuchhalter', ents: ['e-wodis-user', 'e-archiv-read', 'e-m365-user', 'e-ad-user'] },
      { id: 'j-it-admin', departmentId: 'd-it', name: 'Systemadministrator', ents: ['e-wodis-admin', 'e-m365-user', 'e-ad-user', 'e-sql-sa'] },
      { id: 'j-tech-leiter', departmentId: 'd-tech', name: 'Technischer Leiter', ents: ['e-wodis-user', 'e-mareon-tech', 'e-m365-user', 'e-ad-user'] },
      { id: 'j-mkt-expert', departmentId: 'd-mkt', name: 'Marketing Manager', ents: ['e-m365-user', 'e-ad-user', 'e-crm-sales'] }
    ];
    for (const j of jobsData) {
      await saveCollectionRecord('jobTitles', j.id, { 
        id: j.id, tenantId: t1Id, departmentId: j.departmentId, name: j.name, 
        status: 'active', entitlementIds: j.ents, description: `Standard-Blueprint für die Rolle ${j.name}.`
      }, dataSource);
    }

    // --- 6. DATENOBJEKTE (FEATURES) ---
    const featuresData = [
      { id: 'f-mieter-stamm', name: 'Mieter-Stammdaten', carrier: 'mietvertrag', criticality: 'high', deptId: 'd-best', dataStoreId: 'res-wodis' },
      { id: 'f-iban', name: 'Zahlungsdaten (IBAN)', carrier: 'geschaeftspartner', criticality: 'high', deptId: 'd-fibu', dataStoreId: 'res-wodis' },
      { id: 'f-verbrauch', name: 'Verbrauchsdaten (Heizung/Wasser)', carrier: 'objekt', criticality: 'medium', deptId: 'd-best', dataStoreId: 'res-wodis' },
      { id: 'f-bauplaene', name: 'Bauzeichnungen / Pläne', carrier: 'objekt', criticality: 'medium', deptId: 'd-tech', dataStoreId: 'res-archiv' }
    ];
    for (const f of featuresData) {
      await saveCollectionRecord('features', f.id, { 
        ...f, tenantId: t1Id, status: 'active', createdAt: offsetDate(40), updatedAt: now, 
        isComplianceRelevant: true, criticalityScore: 4, confidentialityReq: 'high', 
        integrityReq: 'high', availabilityReq: 'medium', matrixFinancial: true, matrixLegal: true 
      }, dataSource);
    }

    // --- 7. PROZESSE & VVT (20+ Items) ---
    const processRegistry = [
      { id: 'p-int-mgmt', title: 'Interessentenmanagement', dept: 'd-best', vvt: 'vvt-lead', next: 'p-vermietung' },
      { id: 'p-vermietung', title: 'Mietvertragsabschluss', dept: 'd-best', vvt: 'vvt-contract', next: 'p-uebergabe' },
      { id: 'p-uebergabe', title: 'Wohnungsübergabe', dept: 'd-tech', vvt: 'vvt-handover' },
      { id: 'p-maengel', title: 'Mängelanzeige (Mieter)', dept: 'd-best', vvt: 'vvt-support', next: 'p-instandhaltung' },
      { id: 'p-instandhaltung', title: 'Instandsetzungsauftrag', dept: 'd-tech', vvt: 'vvt-workorder', next: 'p-kred-buch' },
      { id: 'p-kred-buch', title: 'Kreditorenbuchhaltung', dept: 'd-fibu', vvt: 'vvt-finance' },
      { id: 'p-bk-abr', title: 'Betriebskostenabrechnung', dept: 'd-best', vvt: 'vvt-utilities' },
      { id: 'p-kuendigung', title: 'Kündigungsmanagement', dept: 'd-best', vvt: 'vvt-term', next: 'p-abnahme' },
      { id: 'p-abnahme', title: 'Wohnungsabnahme', dept: 'd-tech', vvt: 'vvt-final-insp', next: 'p-kaut-abr' },
      { id: 'p-kaut-abr', title: 'Kautionsabrechnung', dept: 'd-fibu', vvt: 'vvt-deposit' },
      { id: 'p-onboarding', title: 'IT-Onboarding', dept: 'd-hr', vvt: 'vvt-hr' },
      { id: 'p-m-anpassung', title: 'Mietenanpassung', dept: 'd-best', vvt: 'vvt-rent-adj' },
      { id: 'p-forderungs-mgmt', title: 'Forderungsmanagement', dept: 'd-fibu', vvt: 'vvt-collections' },
      { id: 'p-weg-abr', title: 'WEG-Buchhaltung', dept: 'd-fibu', vvt: 'vvt-weg' },
      { id: 'p-hauswart', title: 'Hauswart-Management', dept: 'd-tech', vvt: 'vvt-janitor' },
      { id: 'p-marketing', title: 'Marketing-Kampagne', dept: 'd-mkt', vvt: 'vvt-marketing' },
      { id: 'p-legal-check', title: 'Vertragsprüfung (Recht)', dept: 'd-legal', vvt: 'vvt-legal' },
      { id: 'p-budget', title: 'Budgetplanung', dept: 'd-mgmt', vvt: 'vvt-mgmt' },
      { id: 'p-archivierung', title: 'Revisionssichere Archivierung', dept: 'd-it', vvt: 'vvt-archiving' },
      { id: 'p-dsfa', title: 'DS-Folgenabschätzung', dept: 'd-legal', vvt: 'vvt-dpo' }
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

      // Create Version with dynamic nodes
      const nodes: ProcessNode[] = [
        { id: 'start', type: 'start', title: 'Start' },
        { id: 'step1', type: 'step', title: 'Vorbereitung', roleId: 'j-immo-kfm', resourceIds: ['res-m365'], description: 'Initialisierung der Daten.' },
        { id: 'step2', type: 'step', title: 'Hauptverarbeitung', roleId: 'j-immo-kfm', resourceIds: ['res-wodis'], description: 'Eintragung im ERP System.' },
        { id: 'step3', type: 'step', title: 'Archivierung', roleId: 'j-immo-kfm', resourceIds: ['res-archiv'], description: 'Revisionssichere Ablage.' },
        { id: 'end', type: p.next ? 'subprocess' : 'end', title: p.next ? 'Weitergabe' : 'Abschluss', targetProcessId: p.next || undefined }
      ];

      await saveCollectionRecord('process_versions', `ver-${p.id}-1`, {
        id: `ver-${p.id}-1`, process_id: p.id, version: 1, 
        model_json: { nodes, edges: [
          {id:'e1',source:'start',target:'step1'}, {id:'e2',source:'step1',target:'step2'}, 
          {id:'e3',source:'step2',target:'step3'}, {id:'e4',source:'step3',target:'end'}
        ] },
        layout_json: { positions: {start:{x:50,y:100},step1:{x:200,y:100},step2:{x:400,y:100},step3:{x:600,y:100},end:{x:800,y:100}} },
        revision: 1, created_at: offsetDate(30)
      }, dataSource);

      // Link some features
      await saveCollectionRecord('feature_process_steps', `fps-${p.id}`, {
        id: `fps-${p.id}`, featureId: 'f-mieter-stamm', processId: p.id, nodeId: 'step2', usageType: 'Verarbeitung', criticality: 'high'
      }, dataSource);
    }

    // --- 8. RISIKEN & KONTROLLEN (BSI Based) ---
    const riskScenarios = [
      { code: 'G 0.14', title: 'Designfehler', asset: 'res-sql-cluster', impact: 4, prob: 2 },
      { code: 'G 0.19', title: 'Offenlegung schutzbedürftiger Informationen', asset: 'res-wodis', impact: 5, prob: 3 },
      { code: 'G 0.22', title: 'Fehlplanung oder fehlende Ressourcen', asset: 'res-m365', impact: 3, prob: 4 },
      { code: 'G 0.28', title: 'Ausfall oder Störung von IT-Systemen', asset: 'res-sql-cluster', impact: 5, prob: 2 }
    ];

    for (const rs of riskScenarios) {
      const rid = `rk-${rs.code.replace(/\./g, '-')}`;
      await saveCollectionRecord('risks', rid, {
        id: rid, tenantId: t1Id, title: `${rs.code}: ${rs.title}`, 
        category: 'IT-Sicherheit', impact: rs.impact, probability: rs.prob, status: 'active', assetId: rs.asset, 
        owner: 'CISO', createdAt: offsetDate(20), description: `Bedrohungsszenario gemäß BSI Kompendium für Asset ${rs.asset}.`
      }, dataSource);

      const mid = `msr-${rid}`;
      await saveCollectionRecord('riskMeasures', mid, {
        id: mid, riskIds: [rid], resourceIds: [rs.asset], title: `Schutzmaßnahme für ${rs.code}`, 
        owner: 'IT-Leitung', status: 'active', isTom: true, tomCategory: 'Zugriffskontrolle', 
        dueDate: in30Days, effectiveness: 4, description: 'Automatisierte Kontrolle der Zugriffsberechtigungen.'
      }, dataSource);

      await saveCollectionRecord('riskControls', `ctrl-${mid}`, {
        id: `ctrl-${mid}`, measureId: mid, title: `Kontrolle: Wirksamkeit ${rs.code}`, 
        owner: 'Internal Audit', status: 'completed', isEffective: true, checkType: 'Review',
        lastCheckDate: today, nextCheckDate: in30Days, evidenceDetails: 'Audit-Bericht Q1 liegt vor.'
      }, dataSource);
    }

    // --- 9. BENUTZER & ASSIGNMENTS (20+ Items) ---
    const userNames = [
      'Max Mustermann', 'Erika Musterfrau', 'Kevin Schmidt', 'Sarah Lehmann', 'Thomas Weber', 
      'Julia Meyer', 'Andreas Wolf', 'Bärbel Lange', 'Christian Fischer', 'Doris Wagner',
      'Elke Becker', 'Frank Hoffmann', 'Gisela Schäfer', 'Hans Koch', 'Ingrid Richter',
      'Jürgen Klein', 'Karin Wolf', 'Lothar Neumann', 'Monika Schwarz', 'Norbert Zimmermann'
    ];

    for (let i = 0; i < userNames.length; i++) {
      const uid = `u-demo-${i}`;
      const jobIdx = i % jobsData.length;
      const job = jobsData[jobIdx];
      const name = userNames[i];
      const email = `${name.toLowerCase().replace(/\s/g, '.')}@wohnbau-nord.local`;

      await saveCollectionRecord('users', uid, {
        id: uid, tenantId: t1Id, displayName: name, email: email,
        enabled: true, title: job.name, department: departmentsData.find(d => d.id === job.departmentId)?.name || 'Allgemein',
        lastSyncedAt: offsetDate(10),
        adGroups: job.ents.map(eid => entitlementsData.find(e => e.id === eid)?.name || 'GROUP').slice(0, -1) // Create drift by missing last role
      }, dataSource);

      // Blueprint-Zuweisungen
      for (const eid of job.ents) {
        const assId = `ass-${uid}-${eid}`.substring(0, 50);
        await saveCollectionRecord('assignments', assId, {
          id: assId, userId: uid, entitlementId: eid, status: 'active', tenantId: t1Id,
          grantedBy: 'system-blueprint', grantedAt: offsetDate(10), syncSource: 'blueprint'
        }, dataSource);
      }
    }

    // --- 10. AUDIT LOG (Massive history) ---
    const actors = ['admin@compliance-hub.local', 'ciso@wohnbau-nord.local', 'hr@wohnbau-nord.local', 'onboarding-wizard'];
    for (let i = 0; i < 40; i++) {
      const lid = `audit-auto-${i}`;
      await saveCollectionRecord('auditEvents', lid, {
        id: lid, tenantId: t1Id, actorUid: actors[i % actors.length], 
        action: `System-Aktivität #${i}: Konfiguration von ${i % 2 === 0 ? 'Benutzer' : 'Prozess'} aktualisiert.`,
        entityType: i % 2 === 0 ? 'user' : 'process', 
        entityId: i % 2 === 0 ? `u-demo-${i % 20}` : `p-vermietung`,
        timestamp: offsetDate(Math.floor(i / 2)),
        before: { version: i }, after: { version: i + 1, status: 'verified' }
      }, dataSource);
    }

    await logAuditEventAction(dataSource, {
      tenantId: 'global', actorUid: actorEmail, action: 'Enterprise-Ökosystem (V6) vollständig eingespielt.',
      entityType: 'system', entityId: 'seed-v6'
    });

    return { success: true, message: "Enterprise Ökosystem V6 (Housing Industry) erfolgreich generiert. 25+ Prozesse, VVTs und eine vollständige Audit-Historie sind nun verfügbar." };
  } catch (e: any) {
    console.error("Seeding Error:", e);
    return { success: false, error: e.message };
  }
}
