# Masterplan: Integrierte GRC-Workflows (Risk & VVT)

Dieses Dokument vereint die Strategien für die Risikoanalyse und die VVT-Dokumentation zu einem durchgängigen Governance-Modell. Ziel ist die Vermeidung von Datensilos und die Automatisierung von Compliance-Nachweisen (TOM).

---

## 🎯 Kernvision: "Single Source of Truth"
Daten fließen entlang der Wertschöpfungskette:
`Risiko (Bedrohung) --> Maßnahme (TOM) --> Ressource (Asset) --> Prozess (Workflow) --> VVT (Zweck)`.

---

## 🏗️ Phase 1: Datenmodell & Relationen (Das Fundament)
Bevor funktionale Erweiterungen erfolgen, müssen die Relationen im Backend stabil sein.

1.  **Erweiterung `risks`**: 
    *   Hinzufügen von `processId` zur direkten Verknüpfung von Risiken mit Geschäftsprozessen (analog zu `assetId`).
2.  **Erweiterung `processingActivities` (VVT)**:
    *   Entkoppelung der direkten System-Zuweisung. Systeme werden primär über die verknüpften Prozesse "geerbt".
3.  **Erweiterung `riskMeasures` (TOM)**:
    *   Validierung der `isTom` und `isEffective` Flags als Basis für den Datenschutz-Status.

---

## 🏗️ Phase 2: Risiko-Schnellerfassung & BSI-Integration
Fokus auf Effizienz im Risikomanagement.

1.  **Batch-Assessment für Ressourcen**:
    *   Dialog zur Massenerfassung von Sub-Risiken für alle IT-Systeme basierend auf einem Hauptrisiko (z.B. "Brand im RZ").
2.  **Batch-Assessment für Prozesse**:
    *   Analoge Schnellerfassung für Geschäftsprozesse (nur für manuelle Risiken).
3.  **BSI-Katalog-Mapping**:
    *   Strikte Filterung der Maßnahmenvorschläge aus der Kreuztabelle basierend auf dem G-Code der Gefährdung.

---

## 🏗️ Phase 3: Risikoanalyse im ProcessHub
Die Prozessansicht wird zum GRC-Dashboard.

1.  **Direkte vs. Vererbte Risiken**:
    *   Anzeige von Risiken, die den Prozess direkt betreffen.
    *   Aggregation von Risiken der IT-Systeme, die in den Prozessschritten hinterlegt sind.
2.  **Maturity & Risk Overlay**:
    *   Der Prozess-Reifegrad wird um eine Risiko-Komponente erweitert (Heatmap-Score im Prozess-Header).

---

## 🏗️ Phase 4: VVT-Restrukturierung & TOM-Automatisierung
Datenschutz-Compliance als Abfallprodukt operativer Exzellenz.

1.  **Automatisierte TOM-Sicht**:
    *   Innerhalb eines VVT-Eintrags werden alle Maßnahmen (`isTom: true`) aufgelistet, die an den genutzten Ressourcen hängen.
2.  **Wirksamkeits-Monitoring**:
    *   Der Compliance-Status eines VVT ergibt sich aus dem `isEffective`-Flag der zugrunde liegenden Kontrollen im RiskHub.

---

## 🏗️ Phase 5: Reporting & Visual Governance
Finale Auswertung und Audit-Bereitschaft.

1.  **Erweiterte Heatmap**:
    *   Einbeziehung der Dimension "Prozess" in die Risiko-Statistiken.
2.  **Data Map 2.0**:
    *   Visualisierung der Kette von der Datenkategorie (VVT) über den Prozess bis hin zur technischen Kontrolle (Maßnahme).

---
*Status: Integrierter Plan erstellt. Umsetzung der Phasen folgt nach Freigabe.*
