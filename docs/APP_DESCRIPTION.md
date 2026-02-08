
# AccessHub - Master Backlog & Strategisches Manifest (V2.8)

**Rolle**: Dieses Dokument ist das zentrale Steuerungs-Instrument. Es spiegelt den aktuellen Stand nach der GRC-Integration wider.

---

## 🎯 Die Vision: "Integrierte Resilienz"
AccessHub vernetzt alle Governance-Disziplinen. Ein Risiko ist kein einsamer Eintrag, sondern der Startpunkt einer Kette:
`Risiko -> Maßnahme -> Kontrolle (TOM) -> IT-System -> Geschäftsprozess -> DSGVO-Zweck`.
Die Sensibilität eines IT-Systems leitet sich dabei zwingend aus den darauf gespeicherten Daten (Features) ab.

---

## ✅ Abgeschlossene Meilensteine (Audit-Safe)
*   **GRC-Kern-Vernetzung**: Vollständige Koppelung von Risiken, Maßnahmen, Prozessen und VVTs.
*   **RBAC-Blueprint**: Stellenbeschreibungen sind direkt mit Standard-Berechtigungen verknüpft.
*   **Asset-Detailtiefe**: Detailseiten für Ressourcen inklusive Impact-Analyse (Reverse-Lookup).
*   **Daten-basierte Kritikalitäts-Vererbung**: Automatisierte CIA-Einstufung von IT-Systemen basierend auf der Datenlast (Features).
*   **Blueprint-Provisionierung & Jira-Gateway**: Automatisierte Ticketerstellung inklusive detaillierter Rollen-Auflistung.
*   **LDAP-Drift-Detection**: Warnung, wenn die Gruppenmitgliedschaften im AD nicht mehr mit den Blueprints übereinstimmen.
*   **Compliance-Health Dashboard**: Globaler Resilience Score basierend auf Kontroll-Wirksamkeit.
*   **Separation of Concerns (Risk)**: Trennung von Maßnahmen (Pläne) und Kontrollen (operative Prüfungen).

---

## 🏗️ Nächste Ausbaustufen (Priorisierte Roadmap)

### Phase 1: Lifecycle & Intelligence
*Zweck: Automatisierung der operativen Abläufe und proaktive Qualitätskontrolle.*

*   **Aufgabe 1.2: KI-Compliance-Validator**: KI-Check, ob die manuell gesetzten Schutzbedarfe der Ressource mit der tatsächlichen Datenlast und der Unternehmensbeschreibung korrelieren.
*   **Aufgabe 1.3: Dry-Run Preview**: Vorschau der Auswirkungen eines Sync-Laufs vor der tatsächlichen Änderung der Datenbank.

### Phase 2: Monitoring & Resilience
*Zweck: Echtzeit-Überwachung der Compliance-Gesundheit.*

*   **Aufgabe 2.2: Automatisierte Rezertifizierungs-Trigger**: Automatisches Starten von Access-Reviews, wenn ein Mitarbeiter die Stelle (und damit den Blueprint) wechselt.

---
*Stand: Februar 2024 - Fokus auf operative Automatisierung.*
