"use client";

import { AppSidebar } from '@/components/layout/app-sidebar';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsProvider } from '@/context/settings-context';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SettingsProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 border-b bg-card flex items-center justify-between px-8 sticky top-0 z-30">
            <div className="flex-1 flex items-center">
              {/* Leerer Platzhalter für die linke Seite des Headers */}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="text-muted-foreground h-9 w-9">
                  <Bell className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <div className="bg-primary/10 text-primary px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider">
                  Acme Corp
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 p-8 max-w-[1600px] mx-auto w-full">
            {children}
          </main>
        </div>
      </div>
    </SettingsProvider>
  );
}
