import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  GraduationCap,
  Headphones,
  HelpCircle,
  LineChart,
  Mic,
  Pen,
  Settings,
  Shield,
  User,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  
  // If on mobile, close sidebar when navigating
  const handleLinkClick = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      onClose();
    }
  };

  const isActiveLink = (href: string) => {
    if (href === "/") {
      return location === "/" || location === "/?module=reading";
    }
    return location === href;
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 w-72 bg-white shadow-lg z-40 transition-all duration-300 ease-in-out md:translate-x-0 border-r border-border overflow-hidden flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header with logo */}
        <div className="p-4 flex-between border-b border-border md:hidden">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-gradient-to-r from-primary to-secondary flex-center text-white text-sm font-bold">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold gradient-text">IELTS Exam</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="md:hidden">
            <XCircle className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>

        {/* Categories header */}
        <div className="p-4 pb-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Test Modules</h2>
        </div>
        
        {/* Scrollable navigation */}
        <ScrollArea className="flex-1 custom-scrollbar">
          <nav className="pb-4">
            {/* Test modules section */}
            <div className="space-y-1 px-2">
              <Link 
                href="/"
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium text-neutral-dark hover:bg-muted transition-colors group relative",
                  isActiveLink("/") && "bg-primary/10 text-primary font-semibold"
                )}
                onClick={handleLinkClick}
              >
                <BookOpen className="h-5 w-5 mr-3 flex-shrink-0" />
                <span>Reading Test</span>
                {isActiveLink("/") && <ChevronRight className="h-4 w-4 ml-auto" />}
              </Link>
              
              <Link 
                href="/?module=listening"
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium text-neutral-dark hover:bg-muted transition-colors group relative",
                  location === "/?module=listening" && "bg-primary/10 text-primary font-semibold"
                )}
                onClick={handleLinkClick}
              >
                <Headphones className="h-5 w-5 mr-3 flex-shrink-0" />
                <span>Listening Test</span>
                {location === "/?module=listening" && <ChevronRight className="h-4 w-4 ml-auto" />}
              </Link>
              
              <Link 
                href="/?module=writing"
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium text-neutral-dark hover:bg-muted transition-colors group relative",
                  location === "/?module=writing" && "bg-primary/10 text-primary font-semibold"
                )}
                onClick={handleLinkClick}
              >
                <Pen className="h-5 w-5 mr-3 flex-shrink-0" />
                <span>Writing Test</span>
                {location === "/?module=writing" && <ChevronRight className="h-4 w-4 ml-auto" />}
              </Link>
              
              <Link 
                href="/?module=speaking"
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium text-neutral-dark hover:bg-muted transition-colors group relative",
                  location === "/?module=speaking" && "bg-primary/10 text-primary font-semibold"
                )}
                onClick={handleLinkClick}
              >
                <Mic className="h-5 w-5 mr-3 flex-shrink-0" />
                <span>Speaking Test</span>
                {location === "/?module=speaking" && <ChevronRight className="h-4 w-4 ml-auto" />}
              </Link>
            </div>
            
            {/* User section */}
            <div className="mt-6 px-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">My Account</h2>
            </div>
            
            <div className="space-y-1 px-2">
              <Link 
                href="/results"
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium text-neutral-dark hover:bg-muted transition-colors group relative",
                  isActiveLink("/results") && "bg-primary/10 text-primary font-semibold"
                )}
                onClick={handleLinkClick}
              >
                <LineChart className="h-5 w-5 mr-3 flex-shrink-0" />
                <span>My Results</span>
                {isActiveLink("/results") && <ChevronRight className="h-4 w-4 ml-auto" />}
              </Link>
              
              <Link 
                href="/profile"
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium text-neutral-dark hover:bg-muted transition-colors group relative",
                  isActiveLink("/profile") && "bg-primary/10 text-primary font-semibold"
                )}
                onClick={handleLinkClick}
              >
                <User className="h-5 w-5 mr-3 flex-shrink-0" />
                <span>My Profile</span>
                {isActiveLink("/profile") && <ChevronRight className="h-4 w-4 ml-auto" />}
              </Link>
            </div>

            {/* Admin section */}
            {user?.role === UserRole.ADMIN && (
              <>
                <div className="mt-6 px-4">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    <div className="flex items-center">
                      <Shield className="h-4 w-4 mr-2" />
                      <span>Admin Panel</span>
                    </div>
                  </h2>
                </div>
                
                <div className="space-y-1 px-2">
                  <Link 
                    href="/admin"
                    className={cn(
                      "flex items-center rounded-md px-3 py-2 text-sm font-medium text-neutral-dark hover:bg-muted transition-colors group relative",
                      isActiveLink("/admin") && "bg-primary/10 text-primary font-semibold"
                    )}
                    onClick={handleLinkClick}
                  >
                    <BarChart3 className="h-5 w-5 mr-3 flex-shrink-0" />
                    <span>Dashboard</span>
                    {isActiveLink("/admin") && <ChevronRight className="h-4 w-4 ml-auto" />}
                  </Link>
                  
                  <Link 
                    href="/admin/results"
                    className={cn(
                      "flex items-center rounded-md px-3 py-2 text-sm font-medium text-neutral-dark hover:bg-muted transition-colors group relative",
                      isActiveLink("/admin/results") && "bg-primary/10 text-primary font-semibold"
                    )}
                    onClick={handleLinkClick}
                  >
                    <LineChart className="h-5 w-5 mr-3 flex-shrink-0" />
                    <span>Test Results</span>
                    {isActiveLink("/admin/results") && <ChevronRight className="h-4 w-4 ml-auto" />}
                  </Link>
                </div>
              </>
            )}

            {/* Settings section */}
            <div className="mt-6 px-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Preferences</h2>
            </div>
            
            <div className="space-y-1 px-2">
              <Link 
                href="/settings"
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium text-neutral-dark hover:bg-muted transition-colors group relative",
                  isActiveLink("/settings") && "bg-primary/10 text-primary font-semibold"
                )}
                onClick={handleLinkClick}
              >
                <Settings className="h-5 w-5 mr-3 flex-shrink-0" />
                <span>Settings</span>
                {isActiveLink("/settings") && <ChevronRight className="h-4 w-4 ml-auto" />}
              </Link>
              
              <Link 
                href="/help"
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium text-neutral-dark hover:bg-muted transition-colors group relative",
                  isActiveLink("/help") && "bg-primary/10 text-primary font-semibold"
                )}
                onClick={handleLinkClick}
              >
                <HelpCircle className="h-5 w-5 mr-3 flex-shrink-0" />
                <span>Help & Support</span>
                {isActiveLink("/help") && <ChevronRight className="h-4 w-4 ml-auto" />}
              </Link>
            </div>
          </nav>
        </ScrollArea>
        
        {/* Footer with version */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground">IELTS Exam Simulator v1.0</p>
        </div>
      </aside>
    </>
  );
}
