# Masterplan: VVT-Restrukturierung & Hub-Synchronisation

Dieses Dokument beschreibt den Ausführungspfad für die strikte funktionale Trennung der Module (Policy, Workflow, Access, Risk) gemäß dem Referenz-Prinzip ("Single Source of Truth") und der automatisierten TOM-Ableitung.

## 🧠 Kernprinzip der Aufteilung
- **Policy Hub (VVT):** Rechtlich-fachliches "Was & Warum" (Art. 30 DSGVO).
- **Workflow Hub (Prozesse):** Operativ-technisches "Wie" (Systeme, Datenflüsse).
- **Access Hub (IAM):** Autorisierung "Wer darf was" (Rollen, Berechtigungen).
- **Risk Hub (Gefahren):** Prävention "Was kann schiefgehen" (Risiken, Kontrollen).

### 🔑 Spezial-Konzept: TOM-Automatisierung
Technisch-organisatorische Maßnahmen (TOM) nach Art. 32 DSGVO werden **nicht separat gepflegt**, sondern sind eine **Sicht auf implementierte BSI-Maßnahmen**.
- **Logik:** Risiko → BSI-Maßnahme → Ressource → Prozess/VVT → TOM-Sicht.

---

## 🏗️ Phase 1: Datenbank-Schema & Model-Alignment
Bevor die UI angepasst wird, muss das Backend die neuen Relationen unterstützen.

1.  **Update `processingActivities` (VVT):**
    - **Neu:** `jointController` (Boolean/Text), `dataProcessorId` (Referenz), `receiverCategories` (Text), `thirdCountryTransfer` (Boolean), `targetCountry` (Text), `transferMechanism` (Enum: SCC, BCR, etc.).
    - **Entfernen:** Direkte System-IDs (diese werden künftig über den Workflow Hub vererbt).

2.  **Update `processes` (Workflow):**
    - **Neu:** `vvtId` (Referenz auf VVT-Eintrag), `automationLevel` (Enum), `dataVolume` (Enum), `processingFrequency` (Enum).

3.  **Update `riskMeasures` (Risk/TOM):**
    - **Neu:** `isTom` (Boolean), `art32Mapping` (Array/JSON: Vertraulichkeit, Integrität, Verfügbarkeit, Belastbarkeit, Wiederherstellbarkeit, Evaluierung), `gdprProtectionGoals` (JSON: Schutzziel-Zuordnung).
    - **Zweck:** Markierung, welche BSI-Maßnahme als TOM für den Datenschutz zählt.

---

## 🛠️ Phase 2: Policy Hub Refactoring (VVT-Kern)
Fokus auf rechtliche Steuerung und Art. 30 Dokumentation.

- **UI-Anpassung:** Überarbeitung des VVT-Dialogs (`/gdpr`). Keine manuelle Eingabe von IT-Systemen mehr.
- **Anzeige:** "Zugeordnete Ressourcen & Prozesse" (automatisch aggregiert).
- **TOM-Sektion:** Dynamische Liste aller BSI-Maßnahmen, die an den verknüpften Ressourcen hängen und als `isTom: true` markiert sind.

---

## ⚙️ Phase 3: Workflow Hub Erweiterung (Die technische Realität)
Der Workflow Hub wird zum technischen Lieferanten für das VVT.

- **Pflege:** IT-Ressourcen werden Prozessen zugeordnet.
- **Verknüpfung:** Prozesse referenzieren VVT-Zwecke. Dadurch "erben" VVTs alle Ressourcen, die in den zugehörigen operativen Prozessen genutzt werden.

---

## 🔐 Phase 4: Access Hub Operationalisierung
Sichtbarkeit der tatsächlichen Datenzugriffe.

- **Rollen-Mapping:** Berechtigungen werden VVT-Tätigkeiten zugeordnet.
- **Compliance-Check:** "Wer hat Zugriff auf Daten aus VVT X?" wird über die Kette *User -> Rolle -> Ressource -> Prozess -> VVT* aufgelöst.

---

## ⚠️ Phase 5: Risk Hub & TOM-Steuerung
Dynamische Risiko-Steuerung und Nachweis der Angemessenheit.

- **TOM-Pflege:** In `/risks/measures` werden Maßnahmen einmalig mit Art. 32 Attributen angereichert.
- **Wirksamkeit:** Der Status der TOMs im VVT ergibt sich direkt aus dem `isEffective` Flag der Maßnahme im Risk Hub.
- **Audit-Ready:** Ein Klick auf eine TOM im VVT führt direkt zum Prüfnachweis (Evidence) im Risk Hub.

---

## 🗺️ Phase 6: Visual Governance (Data Map)
Die Daten-Landkarte (`/settings/data-map`) zeigt die volle Kette:
`VVT (Zweck) --> Prozess (Ablauf) --> Ressource (System) --> Maßnahme (TOM) --> Risiko`.

---

## 📊 Phase 7: Compliance-Reporting (Art. 32 Check)
Neues Modul oder Tab im Policy Hub:
- **Soll-Ist-Abgleich:** Erfordern die verarbeiteten Daten (z.B. Gesundheitsdaten) höhere TOMs?
- **Gap-Analyse:** Zeige Verarbeitungstätigkeiten ohne ausreichende Maßnahmen für "Wiederherstellbarkeit" oder "Belastbarkeit".

---
*Status: Strategische Planung inklusive TOM-Integration abgeschlossen. Nächster Schritt: Schema-Migration (Phase 1).*
