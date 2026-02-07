"use client";

import { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Bell, ChevronDown, Globe, Building2, Loader2, Moon, Sun, Menu, UserCircle } from 'lucide-react';
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
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { usePlatformAuth } from '@/context/auth-context';

function HeaderContent() {
  const { activeTenantId, setActiveTenantId, theme, setTheme } = useSettings();
  const { user } = usePlatformAuth();
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

  if (!mounted) return <header className="h-16 border-b bg-card shrink-0" />;

  return (
    <header className="glass-header h-16 flex items-center justify-between px-4 md:px-8">
      <div className="flex items-center gap-4">
        {isMobile && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                <Menu className="w-6 h-6 text-primary" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 border-r-primary/20">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation Menü</SheetTitle>
              </SheetHeader>
              <AppSidebar />
            </SheetContent>
          </Sheet>
        )}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2 hover:bg-primary/5 text-primary font-bold uppercase text-[10px] tracking-wider transition-all">
              {activeTenantId === 'all' ? <Globe className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
              <span className="hidden sm:inline truncate max-w-[120px]">{getTenantLabel()}</span>
              <ChevronDown className="w-3 h-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 rounded-xl shadow-xl border-primary/10">
            <DropdownMenuLabel className="text-[9px] font-bold uppercase text-muted-foreground px-3 py-2">Organisation wechseln</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setActiveTenantId('all')} className="gap-2 py-2.5 cursor-pointer">
              <Globe className="w-4 h-4 text-primary" /> 
              <span className="font-bold text-xs uppercase">Alle Firmen (Global)</span>
            </DropdownMenuItem>
            {tenants?.map((tenant) => (
              <DropdownMenuItem 
                key={tenant.id} 
                onSelect={() => setActiveTenantId(tenant.id)} 
                className="gap-2 py-2.5 cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium">{tenant.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </Button>
        
        <div className="w-px h-6 bg-border mx-1" />
        
        <Avatar className="h-8 w-8 border-2 border-primary/10 shadow-sm">
          <AvatarFallback className="bg-primary text-white text-[10px] font-black uppercase">
            {user?.displayName?.charAt(0) || 'A'}
          </AvatarFallback>
        </Avatar>
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
    <div className="flex min-h-screen bg-background selection:bg-primary/20 selection:text-primary">
      {!isMobile && (
        <aside className="w-64 shrink-0 border-r bg-card/50 backdrop-blur-sm hidden md:block sticky top-0 h-screen">
          <AppSidebar />
        </aside>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <HeaderContent />
        <main className="flex-1 overflow-x-hidden">
          <div className="p-4 md:p-8 lg:p-10 max-w-[1600px] mx-auto animate-in fade-in duration-700 slide-in-from-bottom-2">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
