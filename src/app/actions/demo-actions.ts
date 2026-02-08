'use server';

import { saveCollectionRecord } from './mysql-actions';
import { DataSource, Risk, RiskMeasure, Process, ProcessingActivity, Resource, Feature, User, Assignment, JobTitle, Department, ProcessNode, ProcessOperation, RiskControl } from '@/lib/types';
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
      id: t1Id, name: 'Wohnbau Nord GmbH', slug: 'wohnbau-nord', status: 'active', region: 'EU-DSGVO', createdAt: offsetDate(30),
      companyDescription: 'Mittelständische Wohnungsbaugesellschaft mit ca. 5.000 Wohneinheiten. Fokus auf Mietverwaltung und soziale Stadtentwicklung.'
    }, dataSource);

    // --- 2. ABTEILUNGEN ---
    const departmentsData = [
      { id: 'd-mgmt', tenantId: t1Id, name: 'Geschäftsführung' },
      { id: 'd-best', tenantId: t1Id, name: 'Bestandsmanagement' },
      { id: 'd-fibu', tenantId: t1Id, name: 'Finanzbuchhaltung' },
      { id: 'd-it', tenantId: t1Id, name: 'IT & Digitalisierung' },
      { id: 'd-hr', tenantId: t1Id, name: 'Personalwesen' }
    ];
    for (const d of departmentsData) await saveCollectionRecord('departments', d.id, { ...d, status: 'active' }, dataSource);

    // --- 3. RESSOURCEN (SYSTEME) ---
    const resourcesData = [
      { id: 'res-wodis', name: 'Aareon Wodis Sigma', assetType: 'Software', operatingModel: 'SaaS Shared', criticality: 'high', isDataRepository: true },
      { id: 'res-archiv', name: 'Aareon Archiv Kompakt', assetType: 'Software', operatingModel: 'SaaS Shared', criticality: 'high', isDataRepository: true },
      { id: 'res-m365', name: 'Microsoft 365', assetType: 'Cloud Service', operatingModel: 'Cloud', criticality: 'medium', isIdentityProvider: true },
      { id: 'res-ad', name: 'Active Directory', assetType: 'Infrastruktur', operatingModel: 'On-Premise', criticality: 'high', isIdentityProvider: true }
    ];
    for (const r of resourcesData) {
      await saveCollectionRecord('resources', r.id, { 
        ...r, tenantId: t1Id, status: 'active', createdAt: offsetDate(25), 
        confidentialityReq: r.criticality, integrityReq: r.criticality, availabilityReq: r.criticality,
        dataClassification: r.criticality === 'high' ? 'confidential' : 'internal',
        hasPersonalData: true
      }, dataSource);
    }

    // --- 4. SYSTEMROLLEN (ENTITLEMENTS) ---
    const entitlementsData = [
      { id: 'e-wodis-user', resourceId: 'res-wodis', name: 'Standard-Anwender', riskLevel: 'low', isAdmin: false },
      { id: 'e-wodis-admin', resourceId: 'res-wodis', name: 'Key-User / Admin', riskLevel: 'high', isAdmin: true },
      { id: 'e-archiv-read', resourceId: 'res-archiv', name: 'Archiv-Leser', riskLevel: 'low', isAdmin: false },
      { id: 'e-m365-user', resourceId: 'res-m365', name: 'Office Standard', riskLevel: 'low', isAdmin: false },
      { id: 'e-ad-user', resourceId: 'res-ad', name: 'Domain User', riskLevel: 'low', isAdmin: false }
    ];
    for (const e of entitlementsData) await saveCollectionRecord('entitlements', e.id, { ...e, tenantId: t1Id }, dataSource);

    // --- 5. STELLEN-BLUEPRINTS (RBAC) ---
    // Hier verknüpfen wir die Rollen fest mit den Stellen für die Drift-Detection
    const jobsData = [
      { id: 'j-immo-kfm', departmentId: 'd-best', name: 'Immobilienkaufmann', ents: ['e-wodis-user', 'e-archiv-read', 'e-m365-user', 'e-ad-user'] },
      { id: 'j-fibu-kfm', departmentId: 'd-fibu', name: 'Finanzbuchhalter', ents: ['e-wodis-user', 'e-archiv-read', 'e-m365-user', 'e-ad-user'] },
      { id: 'j-it-admin', departmentId: 'd-it', name: 'Systemadministrator', ents: ['e-wodis-admin', 'e-m365-user', 'e-ad-user'] }
    ];
    for (const j of jobsData) {
      await saveCollectionRecord('jobTitles', j.id, { 
        id: j.id, tenantId: t1Id, departmentId: j.departmentId, name: j.name, 
        status: 'active', entitlementIds: j.ents 
      }, dataSource);
    }

    // --- 6. DATENOBJEKTE (FEATURES) ---
    const featuresData = [
      { id: 'f-mieter-stamm', name: 'Mieter-Stammdaten', carrier: 'mietvertrag', criticality: 'high', deptId: 'd-best', dataStoreId: 'res-wodis' },
      { id: 'f-iban', name: 'Zahlungsdaten (IBAN)', carrier: 'geschaeftspartner', criticality: 'high', deptId: 'd-fibu', dataStoreId: 'res-wodis' }
    ];
    for (const f of featuresData) {
      await saveCollectionRecord('features', f.id, { 
        ...f, tenantId: t1Id, status: 'active', createdAt: offsetDate(20), updatedAt: now, 
        isComplianceRelevant: true, criticalityScore: 4, confidentialityReq: 'high', 
        integrityReq: 'high', availabilityReq: 'medium', matrixFinancial: true, matrixLegal: true 
      }, dataSource);
    }

    // --- 7. PROZESSE & VVT ---
    const p1Id = 'p-vermietung';
    const v1Id = 'vvt-vermietung';

    await saveCollectionRecord('processingActivities', v1Id, {
      id: v1Id, tenantId: t1Id, name: 'VVT: Vermietungsprozess', status: 'active', version: '1.0',
      responsibleDepartment: 'Bestandsmanagement', legalBasis: 'Art. 6 Abs. 1 lit. b (Vertrag)', 
      description: 'Verarbeitung von Mieterdaten zum Zwecke des Mietvertragsabschlusses.',
      retentionPeriod: '10 Jahre nach Vertragsende', lastReviewDate: today
    }, dataSource);

    await saveCollectionRecord('processes', p1Id, {
      id: p1Id, tenantId: t1Id, title: 'Mietvertragsabschluss', status: 'published', currentVersion: 1,
      responsibleDepartmentId: 'd-best', vvtId: v1Id, createdAt: offsetDate(15), updatedAt: now,
      automationLevel: 'partial', dataVolume: 'medium', processingFrequency: 'daily'
    }, dataSource);

    const p1Nodes: ProcessNode[] = [
      { id: 'n1', type: 'start', title: 'Start' },
      { id: 'n2', type: 'step', title: 'Datenaufnahme', roleId: 'j-immo-kfm', resourceIds: ['res-wodis'], description: 'Erfassung der Mieterdaten.' },
      { id: 'n3', type: 'step', title: 'Bonitätsprüfung', roleId: 'j-immo-kfm', resourceIds: ['res-m365'], description: 'Prüfung der Zahlungsfähigkeit.' },
      { id: 'n4', type: 'step', title: 'Vertragserstellung', roleId: 'j-immo-kfm', resourceIds: ['res-wodis', 'res-archiv'], description: 'Generierung des Mietvertrags.' },
      { id: 'n5', type: 'end', title: 'Ende' }
    ];

    await saveCollectionRecord('process_versions', `ver-${p1Id}-1`, {
      id: `ver-${p1Id}-1`, process_id: p1Id, version: 1, 
      model_json: { nodes: p1Nodes, edges: [
        {id:'e1',source:'n1',target:'n2'}, {id:'e2',source:'n2',target:'n3'}, 
        {id:'e3',source:'n3',target:'n4'}, {id:'e4',source:'n4',target:'n5'}
      ] },
      layout_json: { positions: {n1:{x:50,y:100},n2:{x:200,y:100},n3:{x:400,y:100},n4:{x:600,y:100},n5:{x:800,y:100}} },
      revision: 1, created_at: offsetDate(15)
    }, dataSource);

    // Verknüpfung Daten ↔ Prozessschritt
    await saveCollectionRecord('feature_process_steps', 'fpl-1', {
      id: 'fpl-1', featureId: 'f-mieter-stamm', processId: p1Id, nodeId: 'n2', usageType: 'Erfassung', criticality: 'high'
    }, dataSource);

    // --- 8. RISIKEN & KONTROLLEN (BSI) ---
    const r1Id = 'rk-bsi-g019';
    await saveCollectionRecord('risks', r1Id, {
      id: r1Id, tenantId: t1Id, title: 'G 0.19: Offenlegung schutzbedürftiger Informationen', 
      category: 'Datenschutz', impact: 5, probability: 2, status: 'active', assetId: 'res-wodis', 
      owner: 'CISO', createdAt: offsetDate(10), description: 'Unbefugter Zugriff auf Mieterdaten in Wodis Sigma.'
    }, dataSource);

    const m1Id = 'msr-rk-bsi-g019';
    await saveCollectionRecord('riskMeasures', m1Id, {
      id: m1Id, riskIds: [r1Id], resourceIds: ['res-wodis'], title: 'Berechtigungskonzept Wodis Sigma', 
      owner: 'IT-Leitung', status: 'active', isTom: true, tomCategory: 'Zugriffskontrolle', 
      dueDate: in30Days, effectiveness: 4, description: 'Strikte Trennung der Zugriffsrechte nach Rollenprofilen.'
    }, dataSource);

    const c1Id = 'ctrl-rk-bsi-g019';
    await saveCollectionRecord('riskControls', c1Id, {
      id: c1Id, measureId: m1Id, title: 'Jährlicher User-Access-Review', 
      owner: 'CISO', status: 'completed', isEffective: true, checkType: 'Review',
      lastCheckDate: today, nextCheckDate: in30Days, evidenceDetails: 'Review-Protokoll Q1/2024 liegt vor.'
    }, dataSource);

    // --- 9. BENUTZER & ASSIGNMENTS ---
    const users = [
      { id: 'u-demo-1', name: 'Max Mustermann', email: 'max@wohnbau-nord.local', role: 'Immobilienkaufmann', dept: 'Bestandsmanagement' },
      { id: 'u-demo-2', name: 'Erika Musterfrau', email: 'erika@wohnbau-nord.local', role: 'Finanzbuchhalter', dept: 'Finanzbuchhaltung' }
    ];

    for (const u of users) {
      await saveCollectionRecord('users', u.id, {
        id: u.id, tenantId: t1Id, displayName: u.name, email: u.email,
        enabled: true, title: u.role, department: u.dept, lastSyncedAt: offsetDate(5),
        adGroups: ['G_WODIS_USER', 'G_M365_STANDARD'] // Simulierter AD-Drift (AD-Gruppen passen teils nicht zum Blueprint)
      }, dataSource);

      // Blueprint-Zuweisung (simuliert)
      const job = jobsData.find(j => j.name === u.role);
      if (job) {
        for (const eid of job.ents) {
          const assId = `ass-${u.id}-${eid}`.substring(0, 50);
          await saveCollectionRecord('assignments', assId, {
            id: assId, userId: u.id, entitlementId: eid, status: 'active', tenantId: t1Id,
            grantedBy: 'system-blueprint', grantedAt: offsetDate(5), syncSource: 'blueprint'
          }, dataSource);
        }
      }
    }

    // --- 10. AUDIT LOG ---
    const logs = [
      { action: 'Datenquelle initialisiert', type: 'system', entity: 'db', actor: 'admin@compliance-hub.local' },
      { action: 'Mandant Wohnbau Nord GmbH angelegt', type: 'tenant', entity: t1Id, actor: 'admin@compliance-hub.local' },
      { action: 'Risiko-Assessment abgeschlossen: G 0.19', type: 'risk', entity: r1Id, actor: 'ciso@wohnbau-nord.local' },
      { action: 'Kontroll-Wirksamkeit bestätigt', type: 'riskControl', entity: c1Id, actor: 'ciso@wohnbau-nord.local' }
    ];

    for (const l of logs) {
      const lid = `audit-${Math.random().toString(36).substring(2, 7)}`;
      await saveCollectionRecord('auditEvents', lid, {
        id: lid, tenantId: 'global', actorUid: l.actor, action: l.action,
        entityType: l.type, entityId: l.entity, timestamp: offsetDate(2),
        before: { status: 'none' }, after: { status: 'active', verified: true }
      }, dataSource);
    }

    await logAuditEventAction(dataSource, {
      tenantId: 'global', actorUid: actorEmail, action: 'High-Fidelity Enterprise Seeding (V5) erfolgreich abgeschlossen.',
      entityType: 'system', entityId: 'seed-v5'
    });

    return { success: true, message: "Enterprise Ökosystem V5 generiert. Alle Verlinkungen (Identität -> Prozess -> Asset -> Risiko) sind nun konsistent." };
  } catch (e: any) {
    console.error("Seeding Error:", e);
    return { success: false, error: e.message };
  }
}
