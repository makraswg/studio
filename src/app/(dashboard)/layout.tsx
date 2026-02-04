
"use client";

import { AppSidebar } from '@/components/layout/app-sidebar';
import { Bell, ChevronDown, Globe, Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsProvider, useSettings } from '@/context/settings-context';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { Tenant } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

function HeaderContent() {
  const { activeTenantId, setActiveTenantId } = useSettings();
  const { data: tenants, isLoading } = usePluggableCollection<Tenant>('tenants');

  const getTenantLabel = () => {
    if (activeTenantId === 'all') return 'Alle Firmen';
    const current = tenants?.find(t => t.id === activeTenantId);
    return current ? current.name : 'Unbekannter Mandant';
  };

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-8 sticky top-0 z-30">
      <div className="flex-1 flex items-center">
        {/* Leerer Platzhalter */}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-muted-foreground h-9 w-9">
            <Bell className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2 rounded-none border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 min-w-[140px] justify-between">
                <div className="flex items-center gap-2">
                  {activeTenantId === 'all' ? <Globe className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
                  <span className="text-[10px] font-bold uppercase tracking-wider">{getTenantLabel()}</span>
                </div>
                <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-none">
              <DropdownMenuLabel className="text-[9px] font-bold uppercase text-muted-foreground">Mandant auswählen</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setActiveTenantId('all')} className="gap-2 text-xs font-bold uppercase">
                <Globe className="w-3.5 h-3.5" /> Alle Firmen (Global)
              </DropdownMenuItem>
              
              {isLoading ? (
                <div className="p-2 flex justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                tenants?.map((tenant) => (
                  <DropdownMenuItem 
                    key={tenant.id} 
                    onSelect={() => setActiveTenantId(tenant.id)} 
                    className="gap-2 text-xs font-bold uppercase"
                  >
                    <Building2 className="w-3.5 h-3.5" /> {tenant.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

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
          <HeaderContent />
          <main className="flex-1 p-8 max-w-[1600px] mx-auto w-full">
            {children}
          </main>
        </div>
      </div>
    </SettingsProvider>
  );
}
