
'use client';

import { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { 
  Bell, 
  ChevronDown, 
  Globe, 
  Building2, 
  Moon, 
  Sun, 
  Menu, 
  HelpCircle,
  Search,
  Zap,
  Loader2
} from 'lucide-react';
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
import { usePathname, useRouter } from 'next/navigation';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { CommandMenu } from '@/components/layout/command-menu';
import { checkSystemStatusAction } from '@/app/actions/migration-actions';

function HeaderContent() {
  const { activeTenantId, setActiveTenantId, theme, setTheme } = useSettings();
  const { user } = usePlatformAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');
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

  if (!mounted) return <header className="h-14 border-b bg-card shrink-0" />;

  return (
    <header className="glass-header h-14 flex items-center justify-between px-4 md:px-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
      <div className="flex items-center gap-3">
        {isMobile && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="w-5 h-5 text-primary" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation Menü</SheetTitle>
              </SheetHeader>
              <AppSidebar />
            </SheetContent>
          </Sheet>
        )}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 gap-2 px-2 hover:bg-slate-100 text-slate-700 font-bold text-[11px] transition-all rounded-md border border-slate-200">
              {activeTenantId === 'all' ? <Globe className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline truncate max-w-[120px]">{getTenantLabel()}</span>
              <ChevronDown className="w-3 h-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 rounded-lg shadow-xl border-slate-200 p-1">
            <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 px-2 py-1.5">Organisation</DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem onSelect={() => setActiveTenantId('all')} className="gap-2 py-2 cursor-pointer rounded-md text-[11px] font-bold">
              <Globe className="w-3.5 h-3.5 text-primary" /> Alle Firmen (Global)
            </DropdownMenuItem>
            {tenants?.map((tenant) => (
              <DropdownMenuItem 
                key={tenant.id} 
                onSelect={() => setActiveTenantId(tenant.id)} 
                className="gap-2 py-2 cursor-pointer rounded-md text-[11px] font-bold"
              >
                <Building2 className="w-3.5 h-3.5 text-slate-400" /> {tenant.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="flex items-center gap-2 md:gap-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                className="h-8 px-3 gap-2 border-slate-200 text-slate-400 hover:text-primary transition-all rounded-md hidden md:flex"
                onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              >
                <Search className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold">Suche</span>
                <kbd className="h-4 px-1 bg-slate-50 rounded flex items-center justify-center font-mono text-[10px] border border-slate-200">⌘K</kbd>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px] font-bold">Suche</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-slate-400 hover:text-primary rounded-md"
          onClick={() => router.push('/help')}
        >
          <HelpCircle className="w-4 h-4" />
        </Button>

        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-slate-400 hover:text-primary rounded-md"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </Button>
        
        <div className="w-px h-5 bg-slate-200 mx-1 hidden sm:block" />
        
        <Avatar className="h-8 w-8 border shadow-sm">
          <AvatarFallback className="bg-primary text-white text-[10px] font-bold">
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
  const { user, isUserLoading } = usePlatformAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isSystemInitialized, setIsSystemInitialized] = useState<boolean | null>(null);

  useEffect(() => {
    setMounted(true);
    // Check initialization status on mount
    checkSystemStatusAction().then(res => setIsSystemInitialized(res.initialized));
  }, []);

  // Route Protection logic
  useEffect(() => {
    if (mounted && !isUserLoading && isSystemInitialized !== null) {
      if (!user) {
        // User is not logged in
        if (pathname === '/setup') {
          // If already initialized, don't allow unauthenticated access to /setup
          if (isSystemInitialized) {
            router.push('/');
          }
        } else {
          // Redirect to login if system is initialized, otherwise to setup
          if (isSystemInitialized) {
            router.push('/');
          } else {
            router.push('/setup');
          }
        }
      }
    }
  }, [user, isUserLoading, isSystemInitialized, router, mounted, pathname]);

  // Prevent flash of internal content while checking session or initialization
  if (!mounted || isUserLoading || isSystemInitialized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 animate-pulse">Sitzung wird geprüft...</p>
        </div>
      </div>
    );
  }

  // Simplified layout for unauthenticated setup (only if not initialized)
  if (!user && pathname === '/setup' && !isSystemInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-12 overflow-auto">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </div>
    );
  }

  // Final check to avoid rendering dashboard content if not authorized
  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-background selection:bg-primary/20 transition-colors duration-500 overflow-hidden">
      <CommandMenu />
      {!isMobile && (
        <aside className="w-60 shrink-0 border-r bg-white dark:bg-slate-900/20 hidden md:block sticky top-0 h-screen z-50">
          <AppSidebar />
        </aside>
      )}
      <div className="flex-1 flex flex-col min-w-0 relative h-screen overflow-hidden">
        <HeaderContent />
        <main className="flex-1 overflow-auto relative">
          {children}
        </main>
      </div>
    </div>
  );
}
