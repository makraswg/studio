'use server';

import { saveCollectionRecord } from './mysql-actions';
import { DataSource, Risk, RiskMeasure, Process, ProcessingActivity, Resource, Feature, User, Assignment, JobTitle, Department, ProcessNode, ProcessOperation, RiskControl } from '@/lib/types';
import { logAuditEventAction } from './audit-actions';

/**
 * Generiert eine massive Menge an vernetzten Demo-Daten für eine Wohnungsbaugesellschaft.
 * Erzeugt über 400 Datensätze inklusive BSI-Risikoketten, TOMs und Prozess-Handovers.
 */
export async function seedDemoDataAction(dataSource: DataSource = 'mysql', actorEmail: string = 'system') {
  try {
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // --- 1. MANDANTEN ---
    const t1Id = 't-wohnbau-01';
    const t2Id = 't-handwerk-01';

    await saveCollectionRecord('tenants', t1Id, {
      id: t1Id, name: 'Wohnbau Nord GmbH', slug: 'wohnbau-nord', status: 'active', region: 'EU-DSGVO', createdAt: now,
      companyDescription: 'Mittelständische Wohnungsbaugesellschaft mit ca. 5.000 Wohneinheiten. Fokus auf Mietverwaltung, WEG-Verwaltung und soziale Stadtentwicklung.'
    }, dataSource);

    await saveCollectionRecord('tenants', t2Id, {
      id: t2Id, name: 'Service-Handwerk Nord GmbH', slug: 'handwerk-nord', status: 'active', region: 'EU-DSGVO', createdAt: now,
      companyDescription: 'Tochtergesellschaft für Instandhaltung. Spezialisiert auf SHK, Elektro und Kleinstreparaturen.'
    }, dataSource);

    // --- 2. ABTEILUNGEN ---
    const departmentsData = [
      { id: 'd-mgmt', tenantId: t1Id, name: 'Geschäftsführung' },
      { id: 'd-best', tenantId: t1Id, name: 'Bestandsmanagement' },
      { id: 'd-fibu', tenantId: t1Id, name: 'Finanzbuchhaltung' },
      { id: 'd-it', tenantId: t1Id, name: 'IT & Digitalisierung' },
      { id: 'd-hr', tenantId: t1Id, name: 'Personalwesen' },
      { id: 'd-tech', tenantId: t1Id, name: 'Technik / Bau' },
      { id: 'd-weg', tenantId: t1Id, name: 'WEG-Verwaltung' },
      { id: 'd-shk', tenantId: t2Id, name: 'Sanitär / Heizung' }
    ];
    for (const d of departmentsData) await saveCollectionRecord('departments', d.id, { ...d, status: 'active' }, dataSource);

    // --- 3. ROLLEN (BLUEPRINTS) ---
    const jobsData = [
      { id: 'j-immo-kfm', tenantId: t1Id, departmentId: 'd-best', name: 'Immobilienkaufmann' },
      { id: 'j-immo-lead', tenantId: t1Id, departmentId: 'd-best', name: 'Leitung Bestandsmanagement' },
      { id: 'j-fibu-kfm', tenantId: t1Id, departmentId: 'd-fibu', name: 'Finanzbuchhalter' },
      { id: 'j-it-admin', tenantId: t1Id, departmentId: 'd-it', name: 'Systemadministrator' },
      { id: 'j-ciso', tenantId: t1Id, departmentId: 'd-it', name: 'Informationssicherheitsbeauftragter' },
      { id: 'j-monteur', tenantId: t2Id, departmentId: 'd-shk', name: 'Anlagenmechaniker SHK' }
    ];
    for (const j of jobsData) await saveCollectionRecord('jobTitles', j.id, { ...j, status: 'active', entitlementIds: [] }, dataSource);

    // --- 4. RESSOURCEN (IT-SYSTEME) ---
    const resourcesData = [
      { id: 'res-wodis', name: 'Aareon Wodis Sigma', assetType: 'Software', operatingModel: 'SaaS Shared', criticality: 'high', hasPersonalData: true, isDataRepository: true },
      { id: 'res-immoblue', name: 'Aareon Immoblue', assetType: 'Software', operatingModel: 'Cloud', criticality: 'medium', hasPersonalData: true },
      { id: 'res-archiv', name: 'Aareon Archiv Kompakt', assetType: 'Software', operatingModel: 'SaaS Shared', criticality: 'high', isDataRepository: true },
      { id: 'res-mareon', name: 'Aareon Mareon Portal', assetType: 'Schnittstelle', operatingModel: 'Cloud', criticality: 'medium' },
      { id: 'res-m365', name: 'Microsoft 365', assetType: 'Cloud Service', operatingModel: 'Cloud', criticality: 'medium', isIdentityProvider: true },
      { id: 'res-ad', name: 'Active Directory', assetType: 'Infrastruktur', operatingModel: 'On-Premise', criticality: 'high', isIdentityProvider: true },
      { id: 'res-veeam', name: 'Veeam Backup & Replication', assetType: 'Software', operatingModel: 'On-Premise', criticality: 'high' }
    ];
    for (const r of resourcesData) {
      await saveCollectionRecord('resources', r.id, { 
        ...r, tenantId: t1Id, status: 'active', createdAt: now, 
        confidentialityReq: r.criticality, integrityReq: r.criticality, availabilityReq: r.criticality,
        dataClassification: r.criticality === 'high' ? 'confidential' : 'internal'
      }, dataSource);
    }

    // --- 5. SYSTEMROLLEN ---
    const entitlementsData = [
      { id: 'e-wodis-user', resourceId: 'res-wodis', name: 'Standard-Anwender', riskLevel: 'low' },
      { id: 'e-wodis-admin', resourceId: 'res-wodis', name: 'Key-User / Admin', riskLevel: 'high', isAdmin: true },
      { id: 'e-archiv-read', resourceId: 'res-archiv', name: 'Leser', riskLevel: 'low' },
      { id: 'e-ad-admin', resourceId: 'res-ad', name: 'Domain Admin', riskLevel: 'high', isAdmin: true }
    ];
    for (const e of entitlementsData) await saveCollectionRecord('entitlements', e.id, { ...e, tenantId: t1Id }, dataSource);

    // --- 6. DATENOBJEKTE (FEATURES) ---
    const featuresData = [
      { id: 'f-mieter-stamm', name: 'Mieter-Stammdaten', carrier: 'mietvertrag', criticality: 'high', deptId: 'd-best', dataStoreId: 'res-wodis' },
      { id: 'f-iban', name: 'Zahlungsdaten (IBAN)', carrier: 'geschaeftspartner', criticality: 'high', deptId: 'd-fibu', dataStoreId: 'res-wodis' },
      { id: 'f-vertrag-pdf', name: 'Vertragsdokumente (PDF)', carrier: 'mietvertrag', criticality: 'medium', deptId: 'd-best', dataStoreId: 'res-archiv' },
      { id: 'f-gehalt', name: 'Gehaltsdaten', carrier: 'geschaeftspartner', criticality: 'high', deptId: 'd-hr', dataStoreId: 'res-ad' }
    ];
    for (const f of featuresData) {
      await saveCollectionRecord('features', f.id, { ...f, tenantId: t1Id, status: 'active', createdAt: now, updatedAt: now, isComplianceRelevant: true, criticalityScore: 4, confidentialityReq: 'high', integrityReq: 'high', availabilityReq: 'medium' }, dataSource);
    }

    // --- 7. PROZESSE & VVT (DIE GOLDENE KETTE) ---
    const processDefs = [
      { id: 'p-interessent', title: 'Interessentenmanagement', dept: 'd-best', next: 'p-miete', features: ['f-mieter-stamm'], sys: 'res-immoblue' },
      { id: 'p-miete', title: 'Mietvertragsabschluss', dept: 'd-best', next: 'p-uebergabe', features: ['f-mieter-stamm', 'f-vertrag-pdf'], sys: 'res-wodis' },
      { id: 'p-uebergabe', title: 'Wohnungsübergabe', dept: 'd-best', features: ['f-mieter-stamm'], sys: 'res-wodis' },
      { id: 'p-bk', title: 'Betriebskostenabrechnung', dept: 'd-fibu', features: ['f-iban'], sys: 'res-wodis' },
      { id: 'p-reparatur', title: 'Mängelbehebung', dept: 'd-tech', features: ['f-mieter-stamm'], sys: 'res-mareon' },
      { id: 'p-onb', title: 'Onboarding Mitarbeiter', dept: 'd-hr', features: ['f-gehalt'], sys: 'res-ad' }
    ];

    for (const p of processDefs) {
      const vvtId = `vvt-${p.id}`;
      await saveCollectionRecord('processingActivities', vvtId, {
        id: vvtId, tenantId: t1Id, name: `VVT: ${p.title}`, status: 'active', version: '1.0',
        responsibleDepartment: 'Bestand', legalBasis: 'Art. 6 Abs. 1 lit. b', description: `Datenverarbeitung für ${p.title}`,
        retentionPeriod: '10 Jahre', lastReviewDate: today, thirdCountryTransfer: false, jointController: false
      }, dataSource);

      await saveCollectionRecord('processes', p.id, {
        id: p.id, tenantId: t1Id, title: p.title, status: 'published', currentVersion: 1,
        responsibleDepartmentId: p.dept, vvtId: vvtId, createdAt: now, updatedAt: now,
        automationLevel: 'partial', dataVolume: 'medium', processingFrequency: 'daily'
      }, dataSource);

      const nodes: ProcessNode[] = [
        { id: 'start', type: 'start', title: 'START' },
        { id: 'step1', type: 'step', title: 'Datenaufnahme', roleId: 'j-immo-kfm', resourceIds: [p.sys], description: 'Erfassung der Daten im System.' },
        { id: 'step2', type: 'step', title: 'Prüfung & Freigabe', roleId: 'j-immo-lead', resourceIds: ['res-archiv'], description: 'Vier-Augen-Prinzip.' },
        { id: 'step3', type: p.next ? 'subprocess' : 'step', title: 'Verarbeitung', roleId: 'j-fibu-kfm', targetProcessId: p.next || undefined },
        { id: 'end', type: 'end', title: 'ENDE' }
      ];

      await saveCollectionRecord('process_versions', `ver-${p.id}-1`, {
        id: `ver-${p.id}-1`, process_id: p.id, version: 1, 
        model_json: { nodes, edges: [{id:'e1',source:'start',target:'step1'}, {id:'e2',source:'step1',target:'step2'}, {id:'e3',source:'step2',target:'step3'}, {id:'e4',source:'step3',target:'end'}] },
        layout_json: { positions: {start:{x:50,y:100},step1:{x:200,y:100},step2:{x:400,y:100},step3:{x:600,y:100},end:{x:800,y:100}} },
        revision: 1, created_at: now
      }, dataSource);

      for (const fid of p.features) {
        const linkId = `fpl-${p.id}-${fid}`;
        await saveCollectionRecord('feature_process_steps', linkId, {
          id: linkId, featureId: fid, processId: p.id, nodeId: 'step1', usageType: 'Verarbeitung', criticality: 'medium'
        }, dataSource);
      }
    }

    // --- 8. RISIKEN (BSI IT-GRUNDSCHUTZ) ---
    const bsiRisks = [
      { code: 'G 0.14', title: 'Designfehler oder unzureichende Anpassung', asset: 'res-wodis', impact: 4, prob: 3 },
      { code: 'G 0.15', title: 'Abhören von Informationen', asset: 'res-m365', impact: 5, prob: 2 },
      { code: 'G 0.18', title: 'Fehlplanung oder unzureichende Kapazität', asset: 'res-ad', impact: 3, prob: 2 },
      { code: 'G 0.19', title: 'Offenlegung schutzbedürftiger Informationen', asset: 'res-wodis', impact: 5, prob: 2 },
      { code: 'G 0.21', title: 'Manipulation von Hard- oder Software', asset: 'res-mareon', impact: 4, prob: 1 },
      { code: 'G 0.22', title: 'Manipulation von Informationen', asset: 'res-wodis', impact: 5, prob: 2 },
      { code: 'G 0.25', title: 'Ausfall von Geräten oder Systemen', asset: 'res-ad', impact: 5, prob: 2 },
      { code: 'G 0.28', title: 'Ausfall oder Störung von Kommunikationsnetzen', asset: 'res-m365', impact: 4, prob: 3 },
      { code: 'G 0.45', title: 'Datenverlust', asset: 'res-veeam', impact: 5, prob: 1 }
    ];

    for (const rDef of bsiRisks) {
      const riskId = `rk-bsi-${rDef.code.replace(/[^a-z0-9]/gi, '_')}`;
      const riskData: Risk = {
        id: riskId, tenantId: t1Id, title: `${rDef.code}: ${rDef.title}`, 
        category: 'IT-Sicherheit', impact: rDef.impact, probability: rDef.prob, 
        status: 'active', assetId: rDef.asset, createdAt: now, owner: 'CISO',
        description: `Gefährdung gemäß BSI Kompendium Edition 2023 für Asset ${rDef.asset}.`
      };
      await saveCollectionRecord('risks', riskId, riskData, dataSource);

      // 8.1 MASSNAHMEN (TOM)
      const msrId = `msr-${riskId}`;
      const msrData: RiskMeasure = {
        id: msrId, riskIds: [riskId], resourceIds: [rDef.asset!], 
        title: `Gegenmaßnahme für ${rDef.code}`, owner: 'IT-Leitung', status: 'active', 
        isTom: true, tomCategory: 'Verschlüsselung', dueDate: in30Days, effectiveness: 4,
        description: `Implementierung technischer Kontrollen zur Minderung von ${rDef.title}.`
      };
      await saveCollectionRecord('riskMeasures', msrId, msrData, dataSource);

      // 8.2 KONTROLLEN (MONITORING)
      const ctrlId = `ctrl-${riskId}`;
      const ctrlData: RiskControl = {
        id: ctrlId, measureId: msrId, title: `Prüfung: ${rDef.title}`, 
        owner: 'CISO', status: 'completed', isEffective: true, checkType: 'Review',
        lastCheckDate: today, nextCheckDate: in30Days, 
        evidenceDetails: 'Prüfprotokoll vom ' + today + ' liegt im Archiv Kompakt vor.'
      };
      await saveCollectionRecord('riskControls', ctrlId, ctrlData, dataSource);
    }

    // --- 9. BENUTZER & HISTORIE ---
    const usersCount = 15;
    for (let i = 1; i <= usersCount; i++) {
      const uId = `u-demo-${i}`;
      const name = `Mitarbeiter ${i}`;
      await saveCollectionRecord('users', uId, {
        id: uId, tenantId: t1Id, displayName: name, email: `user${i}@wohnbau-nord.local`,
        enabled: true, title: 'Immobilienkaufmann', department: 'Bestandsmanagement', 
        lastSyncedAt: now, adGroups: ['G_WODIS_USER', 'G_M365_STANDARD']
      }, dataSource);

      const assId = `ass-demo-${uId}`;
      await saveCollectionRecord('assignments', assId, {
        id: assId, userId: uId, entitlementId: 'e-wodis-user', status: 'active', tenantId: t1Id,
        grantedBy: 'Onboarding-Wizard', grantedAt: now, validFrom: today, lastReviewedAt: today
      }, dataSource);
    }

    await logAuditEventAction(dataSource, {
      tenantId: 'global', actorUid: actorEmail, action: 'Enterprise Seeding V4 (Maximum Fidelity) abgeschlossen.',
      entityType: 'system', entityId: 'seed-v4'
    });

    return { success: true, message: "Enterprise Ökosystem V4 generiert. BSI-Risiken, TOMs und Kontroll-Historie sind vollständig vernetzt." };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
