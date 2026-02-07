
"use client";

import { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Bell, ChevronDown, Globe, Building2, Loader2, Moon, Sun, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/context/settings-context';
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
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

function HeaderContent({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { activeTenantId, setActiveTenantId, theme, setTheme } = useSettings();
  const { data: tenants, isLoading } = usePluggableCollection<Tenant>('tenants');
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setMounted(true);
  }, []);

  const getTenantLabel = () => {
    if (activeTenantId === 'all') return 'Alle Firmen';
    const current = tenants?.find(t => t.id === activeTenantId);
    return current ? current.name : 'Unbekannter Mandant';
  };

  if (!mounted) {
    return (
      <header className="h-16 border-b bg-card flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
        <div className="flex-1" />
      </header>
    );
  }

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        {isMobile && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <AppSidebar />
            </SheetContent>
          </Sheet>
        )}
        <div className="hidden md:flex flex-1 items-center" />
      </div>
      
      <div className="flex items-center gap-2 md:gap-4">
        <div className="flex items-center gap-1 md:gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-muted-foreground h-9 w-9"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground h-9 w-9 hidden sm:flex">
            <Bell className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-1 hidden sm:block" />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2 rounded-none border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 min-w-[100px] md:min-w-[140px] justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  {activeTenantId === 'all' ? <Globe className="w-3.5 h-3.5 shrink-0" /> : <Building2 className="w-3.5 h-3.5 shrink-0" />}
                  <span className="text-[10px] font-bold uppercase tracking-wider truncate max-w-[60px] md:max-w-none">
                    {getTenantLabel()}
                  </span>
                </div>
                <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
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
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen bg-background overflow-hidden">
      {!isMobile && <AppSidebar />}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <HeaderContent />
        <main className="flex-1 p-4 md:p-8 max-w-[1600px] mx-auto w-full overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
