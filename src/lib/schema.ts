
// src/lib/schema.ts

/**
 * Definiert die Struktur einer einzelnen Tabelle für die Migrations-Logik.
 */
export interface TableDefinition {
  /**
   * Eine Map von Spaltennamen zu ihren SQL-Typ-Definitionen.
   * z.B. { id: 'VARCHAR(255) PRIMARY KEY', name: 'VARCHAR(255) NOT NULL' }
   */
  columns: {
    [columnName: string]: string;
  };
  /**
   * Zukünftige Erweiterungen könnten hier definiert werden, z.B. Indizes oder Foreign Keys.
   * indexes?: { [indexName: string]: string[] };
   */
}

/**
 * Definiert das gesamte Datenbankschema der Anwendung als eine Sammlung von Tabellen.
 * Dies ist die "Single Source of Truth" für die Datenbankstruktur.
 * Jede Änderung an der Datenbankstruktur (neue Tabelle, neue Spalte) wird hier deklariert.
 */
export interface AppSchema {
  [tableName: string]: TableDefinition;
}

// Die konkrete Implementierung des Schemas für unsere Anwendung.
export const appSchema: AppSchema = {
  users: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      name: 'VARCHAR(255) NOT NULL',
      email: 'VARCHAR(255) UNIQUE NOT NULL',
    },
  },
  groups: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      name: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
    },
  },
  resources: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      name: 'VARCHAR(255) NOT NULL',
      type: 'VARCHAR(100)',
    },
  },
  entitlements: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      name: 'VARCHAR(255) NOT NULL',
      resourceId: 'VARCHAR(255) NOT NULL',
      // Ein Foreign Key könnte hier als zusätzliche Eigenschaft definiert werden,
      // aber für die grundlegende Migration halten wir es einfach.
    },
  },
  assignments: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      principalType: 'VARCHAR(50) NOT NULL', // 'user' oder 'group'
      principalId: 'VARCHAR(255) NOT NULL',
      entitlementId: 'VARCHAR(255) NOT NULL',
    },
  },
};
