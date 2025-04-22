import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  BookOpen,
  Headphones,
  Mic,
  Pen,
  Settings,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";

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

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 w-64 bg-white shadow-md z-40 transition-transform duration-300 ease-in-out md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6">
          <h2 className="text-xl font-semibold text-neutral-text">Test Modules</h2>
        </div>
        <nav className="pt-2">
          <Link 
            href="/"
            className={cn(
              "flex items-center px-6 py-3 text-neutral-dark hover:text-primary transition",
              location === "/" && "sidebar-menu-item active"
            )}
            onClick={handleLinkClick}
          >
            <BookOpen className="h-5 w-5 mr-3" />
            Reading
          </Link>
          <Link 
            href="/?module=listening"
            className={cn(
              "flex items-center px-6 py-3 text-neutral-dark hover:text-primary transition",
              location === "/?module=listening" && "sidebar-menu-item active"
            )}
            onClick={handleLinkClick}
          >
            <Headphones className="h-5 w-5 mr-3" />
            Listening
          </Link>
          <Link 
            href="/?module=writing"
            className={cn(
              "flex items-center px-6 py-3 text-neutral-dark hover:text-primary transition",
              location === "/?module=writing" && "sidebar-menu-item active"
            )}
            onClick={handleLinkClick}
          >
            <Pen className="h-5 w-5 mr-3" />
            Writing
          </Link>
          <Link 
            href="/?module=speaking"
            className={cn(
              "flex items-center px-6 py-3 text-neutral-dark hover:text-primary transition",
              location === "/?module=speaking" && "sidebar-menu-item active"
            )}
            onClick={handleLinkClick}
          >
            <Mic className="h-5 w-5 mr-3" />
            Speaking
          </Link>
          <div className="border-t border-gray-100 my-4"></div>
          <Link href="/results">
            <a
              className={cn(
                "flex items-center px-6 py-3 text-neutral-dark hover:text-primary transition",
                location === "/results" && "sidebar-menu-item active"
              )}
              onClick={handleLinkClick}
            >
              <BarChart3 className="h-5 w-5 mr-3" />
              My Results
            </a>
          </Link>

          {user?.role === UserRole.ADMIN && (
            <>
              <div className="border-t border-gray-100 my-4"></div>
              <div className="px-6 mb-2 text-xs font-semibold text-neutral-dark uppercase tracking-wider">
                Admin
              </div>
              <Link href="/admin">
                <a
                  className={cn(
                    "flex items-center px-6 py-3 text-neutral-dark hover:text-primary transition",
                    location === "/admin" && "sidebar-menu-item active"
                  )}
                  onClick={handleLinkClick}
                >
                  <BarChart3 className="h-5 w-5 mr-3" />
                  Dashboard
                </a>
              </Link>
              <Link href="/admin/results">
                <a
                  className={cn(
                    "flex items-center px-6 py-3 text-neutral-dark hover:text-primary transition",
                    location === "/admin/results" && "sidebar-menu-item active"
                  )}
                  onClick={handleLinkClick}
                >
                  <BarChart3 className="h-5 w-5 mr-3" />
                  Results
                </a>
              </Link>
            </>
          )}

          <Link href="/settings">
            <a
              className={cn(
                "flex items-center px-6 py-3 text-neutral-dark hover:text-primary transition",
                location === "/settings" && "sidebar-menu-item active"
              )}
              onClick={handleLinkClick}
            >
              <Settings className="h-5 w-5 mr-3" />
              Settings
            </a>
          </Link>
          <Link href="/help">
            <a
              className={cn(
                "flex items-center px-6 py-3 text-neutral-dark hover:text-primary transition",
                location === "/help" && "sidebar-menu-item active"
              )}
              onClick={handleLinkClick}
            >
              <HelpCircle className="h-5 w-5 mr-3" />
              Help & Support
            </a>
          </Link>
        </nav>
      </aside>
    </>
  );
}
