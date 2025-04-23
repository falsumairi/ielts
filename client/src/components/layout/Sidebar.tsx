import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import {
  Users,
  BarChart4,
  FileText,
  Settings,
  ListTodo,
  LogOut,
  X,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type NavItem = {
  title: string;
  icon: React.ReactNode;
  href: string;
};

const adminNavItems: NavItem[] = [
  {
    title: "Dashboard",
    icon: <BarChart4 className="h-5 w-5" />,
    href: "/admin/dashboard",
  },
  {
    title: "Users",
    icon: <Users className="h-5 w-5" />,
    href: "/admin/users",
  },
  {
    title: "Test Management",
    icon: <FileText className="h-5 w-5" />,
    href: "/admin/tests",
  },
  {
    title: "Results",
    icon: <ListTodo className="h-5 w-5" />,
    href: "/admin/results",
  },
  {
    title: "Settings",
    icon: <Settings className="h-5 w-5" />,
    href: "/admin/settings",
  },
];

const userNavItems: NavItem[] = [
  {
    title: "Dashboard",
    icon: <BarChart4 className="h-5 w-5" />,
    href: "/dashboard",
  },
  {
    title: "My Tests",
    icon: <FileText className="h-5 w-5" />,
    href: "/tests",
  },
  {
    title: "Results",
    icon: <ListTodo className="h-5 w-5" />,
    href: "/results",
  },
  {
    title: "Settings",
    icon: <Settings className="h-5 w-5" />,
    href: "/settings",
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const navItems = user?.role === "admin" ? adminNavItems : userNavItems;

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 transform bg-white shadow-lg transition-transform duration-200 md:translate-x-0 md:relative md:z-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4 md:px-6">
          <Link href="/" className="flex items-center space-x-2">
            <img
              src="/logo.svg"
              alt="IELTS Exam"
              className="h-8 w-8"
            />
            <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
              IELTS Exam
            </span>
          </Link>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="md:hidden"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-4rem)] md:h-[calc(100vh-6rem)]">
          <div className="px-4 py-6 md:px-6">
            <nav className="flex flex-col space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                >
                  <a
                    className={cn(
                      "flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      location === item.href
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {item.icon}
                    <span className="ml-3 flex-1">{item.title}</span>
                    {location === item.href && (
                      <ChevronRight className="h-4 w-4 ml-2" />
                    )}
                  </a>
                </Link>
              ))}

              <Button
                variant="ghost"
                className="w-full justify-start px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5 mr-3" />
                Sign Out
              </Button>
            </nav>
          </div>
        </ScrollArea>
      </div>
    </>
  );
}