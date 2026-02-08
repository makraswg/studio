
import { Process, ProcessVersion, ProcessNode } from './types';

export interface MaturityDimension {
  name: string;
  score: number;
  maxScore: number;
  status: 'complete' | 'incomplete' | 'missing';
  label: string;
}

export interface ProcessMaturity {
  totalPercent: number;
  level: 1 | 2 | 3 | 4 | 5;
  levelLabel: string;
  dimensions: MaturityDimension[];
}

/**
 * Berechnet den Reifegrad eines Prozesses basierend auf den Inhalten.
 */
export function calculateProcessMaturity(process: Process, version?: ProcessVersion, mediaCount: number = 0): ProcessMaturity {
  const dimensions: MaturityDimension[] = [];
  const model = version?.model_json;
  const nodes = model?.nodes || [];

  // 1. Dimension: Basisdaten (20 Punkte)
  let baseScore = 0;
  if (process.title) baseScore += 5;
  if (process.description && process.description.length > 20) baseScore += 5;
  if (process.responsibleDepartmentId) baseScore += 5;
  if (process.ownerUserId) baseScore += 5;
  dimensions.push({
    name: 'Stammdaten',
    score: baseScore,
    maxScore: 20,
    status: baseScore === 20 ? 'complete' : baseScore > 0 ? 'incomplete' : 'missing',
    label: 'Titel, Beschreibung, Abteilung & Owner'
  });

  // 2. Dimension: Strukturtiefe (20 Punkte)
  let structureScore = 0;
  if (nodes.length >= 3) structureScore += 10;
  if (nodes.length >= 6) structureScore += 5;
  if (model?.edges && model.edges.length > 0) structureScore += 5;
  dimensions.push({
    name: 'Struktur',
    score: structureScore,
    maxScore: 20,
    status: structureScore === 20 ? 'complete' : structureScore > 0 ? 'incomplete' : 'missing',
    label: 'Anzahl der Schritte & logische Verknüpfung'
  });

  // 3. Dimension: Operative Details (20 Punkte)
  let detailScore = 0;
  const nodesWithDesc = nodes.filter(n => n.description && n.description.length > 10).length;
  const nodesWithChecklist = nodes.filter(n => n.checklist && n.checklist.length > 0).length;
  if (nodes.length > 0) {
    detailScore += Math.min(10, Math.floor((nodesWithDesc / nodes.length) * 10));
    detailScore += Math.min(10, Math.floor((nodesWithChecklist / nodes.length) * 10));
  }
  dimensions.push({
    name: 'Tätigkeitsdetails',
    score: detailScore,
    maxScore: 20,
    status: detailScore === 20 ? 'complete' : detailScore > 0 ? 'incomplete' : 'missing',
    label: 'Schrittbeschreibungen & Checklisten'
  });

  // 4. Dimension: Verantwortlichkeiten (15 Punkte)
  let roleScore = 0;
  const nodesWithRole = nodes.filter(n => n.roleId && n.roleId !== '').length;
  if (nodes.length > 0) {
    roleScore += Math.min(15, Math.floor((nodesWithRole / nodes.length) * 15));
  }
  dimensions.push({
    name: 'Zuständigkeiten',
    score: roleScore,
    maxScore: 15,
    status: roleScore === 15 ? 'complete' : roleScore > 0 ? 'incomplete' : 'missing',
    label: 'Rollenzuordnung pro Arbeitsschritt'
  });

  // 5. Dimension: Nachweise & Medien (10 Punkte)
  let mediaScore = 0;
  if (mediaCount >= 1) mediaScore += 5;
  if (mediaCount >= 3) mediaScore += 5;
  dimensions.push({
    name: 'Dokumentation',
    score: mediaScore,
    maxScore: 10,
    status: mediaScore === 10 ? 'complete' : mediaScore > 0 ? 'incomplete' : 'missing',
    label: 'Anhänge, Belege & Bilder'
  });

  // 6. Dimension: Regulatorik (15 Punkte)
  let regScore = 0;
  if (process.regulatoryFramework) regScore += 15;
  dimensions.push({
    name: 'Regulatorik',
    score: regScore,
    maxScore: 15,
    status: regScore === 15 ? 'complete' : 'missing',
    label: 'Zuordnung zu Normen & Standards'
  });

  const totalScore = dimensions.reduce((acc, d) => acc + d.score, 0);
  const totalPercent = Math.min(100, Math.floor(totalScore));

  let level: 1 | 2 | 3 | 4 | 5 = 1;
  let levelLabel = 'Initial (Ad-hoc)';
  if (totalPercent >= 90) { level = 5; levelLabel = 'Optimiert'; }
  else if (totalPercent >= 75) { level = 4; levelLabel = 'Gesteuert'; }
  else if (totalPercent >= 50) { level = 3; levelLabel = 'Definiert'; }
  else if (totalPercent >= 25) { level = 2; levelLabel = 'Wiederholbar'; }

  return { totalPercent, level, levelLabel, dimensions };
}
