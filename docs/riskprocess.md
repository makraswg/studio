# Masterplan: Integrierte Risikoanalyse & Schnellerfassung (V1.0)

Dieses Dokument beschreibt die Umsetzung der Schnellerfassung für Ressourcen/Prozesse im Risikoinventar sowie das Vererbungsmodell für die Risikoanalyse im ProcessHub.

## 🎯 Zielsetzung
- **Effizienz**: Massenerfassung von Risiken für alle Assets/Prozesse direkt aus einem Hauptrisiko.
- **Transparenz**: Sichtbarkeit von Risiken im ProzessHub, die sowohl den Prozess selbst als auch die genutzten IT-Systeme betreffen.
- **Konsistenz**: Keine manuellen Dubletten, sondern saubere hierarchische Verknüpfung.

---

## 🏗️ Phase 1: Schnellerfassung im Risikoinventar (`/risks`)

### 1.1 UI-Erweiterung (Aktionsmenü)
- Hinzufügen von zwei neuen Optionen im Drei-Punkte-Menü der **Hauptrisiken** (Risiken ohne Parent):
    - `⚡ Schnellerfassung: Ressourcen`
    - `⚡ Schnellerfassung: Prozesse` (Nur aktiv, wenn das Risiko KEIN BSI-Katalog-Risiko ist)

### 1.2 Schnellerfassungs-Dialog
- Ein neuer, breiter Dialog, der eine Liste aller relevanten Objekte (Ressourcen oder Prozesse) zeigt.
- **Spalten**: Name des Objekts, Typ, Schadensausmaß (1-5), Eintrittswahrscheinlichkeit (1-5), Kommentar.
- **Logik**:
    - Bereits existierende Sub-Risiken für dieses Hauptrisiko + Objekt werden vorbefüllt.
    - Neue Zeilen können editiert werden.
- **Speicher-Workflow**:
    - Beim Klick auf "Batch-Speichern" wird für jede Zeile mit einer Bewertung geprüft:
        - Existiert ein Sub-Risiko? -> Update.
        - Neu bewertet? -> Erstelle neues Risiko mit `parentId = Hauptrisiko.id` und `assetId` (bzw. künftig `processId`).

---

## 🏗️ Phase 2: Risikoanalyse im ProcessHub (`/processhub/view/[id]`)

### 2.1 Daten-Aggregation (Vererbung)
- Die Risikoanalyse im Prozess zeigt zwei Ebenen:
    1. **Direkte Risiken**: Alle Risiken, die direkt mit der `processId` verknüpft sind.
    2. **Indirekte Risiken (Vererbt)**: Alle Risiken, die mit Ressourcen verknüpft sind, welche in den Prozessschritten (`resourceIds` der Nodes) verwendet werden.

### 2.2 UI-Darstellung
- Neuer Tab oder Sektion "Risikoanalyse" in der Prozess-Detailansicht.
- Visualisierung:
    - Heatmap-Score für den Prozess (Max-Score aus direkt + vererbt).
    - Liste der Top-Risiken mit Herkunftskennzeichnung (z.B. Badge "Vererbt von System X").

---

## 🏗️ Phase 3: Reporting & Analytics (`/risks/reports`)

### 3.1 Erweiterung der Reports
- Die Risiko-Matrix (Heatmap) und die Statistik-Charts müssen um die Dimension "Prozess" erweitert werden.
- Filter-Option: "Nach Objekttyp" (Global, Ressource, Prozess).
- In der Detail-Liste unter der Heatmap wird die Spalte "Bezug" um den Prozessnamen ergänzt.

---

## 🛠️ Technische Anpassungen (Übersicht)

| Datei | Änderung |
|-------|----------|
| `src/lib/types.ts` | Ergänzung `processId?: string` im `Risk` Interface. |
| `src/app/(dashboard)/risks/page.tsx` | Implementierung der `QuickAssessmentDialog` Komponente und Menü-Trigger. |
| `src/app/(dashboard)/processhub/view/[id]/page.tsx` | Logik zur Aggregation vererbter Risiken über die `resourceIds` der Prozessschritte. |
| `src/app/(dashboard)/risks/reports/page.tsx` | Update der Daten-Selektoren für die Heatmap. |

---
*Status: Planung abgeschlossen. Umsetzung folgt nach Freigabe.*
