# AccessHub - Master Backlog & Strategisches Manifest (V2.4)

**Rolle**: Dieses Dokument ist das zentrale Steuerungs-Instrument. Es spiegelt den aktuellen Stand nach der GRC-Integration wider.

---

## 🎯 Die Vision: "Integrierte Resilienz"
AccessHub vernetzt alle Governance-Disziplinen. Ein Risiko ist kein einsamer Eintrag, sondern der Startpunkt einer Kette:
`Risiko -> Kontrolle (TOM) -> IT-System -> Geschäftsprozess -> DSGVO-Zweck`.

---

## ✅ Abgeschlossene Meilensteine (Audit-Safe)
*   **GRC-Kern-Vernetzung**: Vollständige Koppelung von Risiken, Maßnahmen, Prozessen und VVTs.
*   **Grafische Landkarte**: Die "Golden Chain" Visualisierung aller Abhängigkeiten.
*   **RBAC-Blueprint**: Stellenbeschreibungen sind direkt mit Standard-Berechtigungen verknüpft.
*   **KI-Audit & Advisor**: Automatisierte Prüfung von Identitäten und Risikoszenarien.
*   **BSI-Katalog-Integration**: Import und automatische Maßnahmen-Ableitung aus dem IT-Grundschutz.

---

## 🏗️ Nächste Ausbaustufen (Priorisierte Roadmap)

### Phase 1: Asset-Detailtiefe & Impact (Höchste Priorität)
*Zweck: IT-Systeme von einer Liste zu einem aktiven Governance-Objekt machen.*

*   **Aufgabe 1.1: Asset-Detailansicht (Deep Dive)**: Implementierung einer Detailseite für Ressourcen (analog zum ProcessHub).
*   **Aufgabe 1.2: Reverse-Lookup (Impact-Analyse)**: Automatische Anzeige in der Asset-Detailansicht: "Welche Prozesse und VVTs sind von diesem System abhängig?".
    *   *Audit-Notiz*: Kritisch für die BSI-Notfallplanung und DSGVO-Risikoabschätzung.
*   **Aufgabe 1.3: KI-CIA-Wizard 2.0**: Dedizierte KI-Logik zur Schutzbedarfsfeststellung basierend auf den verknüpften Datenobjekten (Features).

### Phase 2: Lifecycle & Synchronisation
*Zweck: Automatisierung der operativen Abläufe.*

*   **Aufgabe 2.1: Blueprint-Provisionierung**: Umsetzung der automatischen Zuweisungserstellung im Lifecycle-Hub basierend auf dem Stellenplan-Blueprint.
*   **Aufgabe 2.2: LDAP-Drift-Detection**: Warnung, wenn die Gruppenmitgliedschaften im AD nicht mehr mit den Blueprints im Hub übereinstimmen.
*   **Aufgabe 2.3: Dry-Run Preview**: Vorschau der Auswirkungen eines Sync-Laufs vor der tatsächlichen Änderung der Datenbank.

### Phase 3: Prozess-Resilienz & Monitoring
*Zweck: Echtzeit-Überwachung der Compliance-Gesundheit.*

*   **Aufgabe 3.1: Compliance-Health Dashboard**: Ein globales Widget, das zeigt: "Wie viel Prozent meiner TOMs sind aktuell effektiv?".
*   **Aufgabe 3.2: Automatisierte Rezertifizierungs-Trigger**: Automatisches Starten von Access-Reviews, wenn ein Mitarbeiter die Stelle (und damit den Blueprint) wechselt.
*   **Aufgabe 3.3: Global Health-Check Monitor**: Status-Monitor für API-Endpunkte (Jira, Ollama, LDAP).

---
*Stand: Februar 2024 - Nach Abschluss der GRC-Integration (Phase 5).*
