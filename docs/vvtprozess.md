# Masterplan: VVT-Restrukturierung & Hub-Synchronisation

Dieses Dokument beschreibt den Ausführungspfad für die strikte funktionale Trennung der Module (Policy, Workflow, Access, Risk) gemäß dem Referenz-Prinzip ("Single Source of Truth").

## 🧠 Kernprinzip der Aufteilung
- **Policy Hub (VVT):** Rechtlich-fachliches "Was & Warum" (Art. 30 DSGVO).
- **Workflow Hub (Prozesse):** Operativ-technisches "Wie" (Systeme, Datenflüsse).
- **Access Hub (IAM):** Autorisierung "Wer darf was" (Rollen, Berechtigungen).
- **Risk Hub (Gefahren):** Prävention "Was kann schiefgehen" (Risiken, Kontrollen).

---

## 🏗️ Phase 1: Datenbank-Schema & Model-Alignment
Bevor die UI angepasst wird, muss das Backend die neuen Relationen unterstützen.

1. **Update `processingActivities` (VVT):**
   - **Neu:** `jointController` (Boolean/Text), `dataProcessorId` (Referenz), `receiverCategories` (Text), `thirdCountryTransfer` (Boolean), `targetCountry` (Text), `transferMechanism` (Enum: SCC, BCR, etc.).
   - **Entfernen:** Direkte System-IDs (diese werden künftig über den Workflow Hub vererbt).
   - **Seite:** `/settings/dsgvo` (Basisdaten) und `/gdpr` (Dialog).

2. **Update `processes` (Workflow):**
   - **Neu:** `vvtId` (Referenz auf VVT-Eintrag), `automationLevel` (Enum), `dataVolume` (Enum), `processingFrequency` (Enum).
   - **Verknüpfung:** Jeder operative Prozess wird einem VVT-Zweck zugeordnet.
   - **Seite:** `/processhub` (Übersicht) und `/processhub/[id]` (Stammdaten-Tab).

3. **Update `entitlements` (Access):**
   - **Neu:** `vvtId` (Optionaler Link für direkte Art-30-Relevanz einer Rolle).
   - **Seite:** `/roles` (Bearbeitungsdialog).

4. **Update `risks` (Risk):**
   - **Neu:** `vvtId` (Direkte Kopplung für Datenschutz-Folgenabschätzung/DSFA).
   - **Seite:** `/risks` (Risiko-Dialog).

---

## 🛠️ Phase 2: Policy Hub Refactoring (VVT-Kern)
Fokus auf rechtliche Steuerung und Art. 30 Dokumentation.

- **UI-Anpassung:** Überarbeitung des VVT-Dialogs (`/gdpr`). Alle Felder für IT-Systeme werden entfernt. Stattdessen wird angezeigt: "Zugeordnete Prozesse (Workflow Hub)".
- **Pflege:** Nur noch Zweck, Rechtsgrundlage, Betroffenenkategorien und Drittland-Details.
- **Reporting:** Der Art. 30 Export (PDF/Excel) wird so angepasst, dass er die im Workflow Hub verknüpften Systeme automatisch als "Verarbeitende Systeme" auflistet (Referenz-Lookup).

---

## ⚙️ Phase 3: Workflow Hub Erweiterung (Die technische Realität)
Der Workflow Hub wird zum technischen Lieferanten für das VVT.

- **Pflege:** Die Zuordnung von IT-Ressourcen zu Tätigkeiten erfolgt ausschließlich über Prozesse.
- **Logik:** Wenn ein Prozess mit der VVT-ID "Kundenverwaltung" verknüpft ist, gelten alle im Prozess genutzten IT-Ressourcen (Ressourcenkatalog) als technische Basis für dieses VVT.
- **Metadaten:** Hinzufügen von Feldern für Automatisierungsgrad und Datenvolumen im Prozess-Stammblatt (`/processhub/[id]`).

---

## 🔐 Phase 4: Access Hub Operationalisierung
Hier wird sichtbar, wer die Daten aus dem VVT tatsächlich "berühren" darf.

- **Rollen-Mapping:** In `/roles` kann eine Berechtigung direkt einer VVT-Tätigkeit zugeordnet werden.
- **Compliance-View:** Implementierung eines Filters im Benutzerverzeichnis (`/users`), der anzeigt: "Zeige alle User, die Zugriff auf Daten aus VVT 'Personalabrechnung' haben".
- **Auflösung:** Kette: *User -> Rolle -> Zuweisung -> VVT*.

---

## ⚠️ Phase 5: Risk Hub Automatisierung
Dynamische Risiko-Steuerung basierend auf VVT-Attributen.

- **Trigger-Logik:** Wenn im Policy Hub (VVT) "Besondere Kategorien" (Art. 9) oder "Drittlandübermittlung" aktiviert wird, erstellt das System automatisch eine Aufgabe im Risk Hub zur Prüfung der DSFA-Pflicht.
- **Kontroll-Mapping:** Verknüpfung von TOMs (Maßnahmen) in `/risks/measures` direkt mit VVT-Einträgen zur Nachweisführung der Angemessenheit nach Art. 32 DSGVO.

---

## 🗺️ Phase 6: Visual Governance (Data Map)
Die Daten-Landkarte (`/settings/data-map`) wird zum Steuerungs-Instrument.

- **Graph-Update:** Visualisierung der Hierarchie:
  `VVT (Zweck) --> Prozess (Ablauf) --> Ressource (System) --> Rolle (Zugriff) --> User`.
- **Impact-Analyse:** "Was passiert rechtlich (VVT), wenn dieses technische System (Ressource) ausfällt oder kompromittiert wird?"

---
*Status: Strategische Planung abgeschlossen. Nächster Schritt: Schema-Migration (Phase 1).*
