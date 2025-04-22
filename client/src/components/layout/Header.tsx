import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, ChevronDown, Menu } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";

interface HeaderProps {
  toggleSidebar: () => void;
}

export default function Header({ toggleSidebar }: HeaderProps) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center text-white text-lg font-bold">
            IE
          </div>
          <span className="text-xl font-bold text-primary">IELTS Exam</span>
        </div>

        {/* Desktop navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          <Link href="/" className={`font-medium hover:text-primary transition ${location === "/" ? "text-primary" : ""}`}>
            Dashboard
          </Link>
          <Link href="/results" className={`font-medium hover:text-primary transition ${location === "/results" ? "text-primary" : ""}`}>
            My Results
          </Link>
          {user?.role === UserRole.ADMIN && (
            <Link href="/admin" className={`font-medium hover:text-primary transition ${location.startsWith("/admin") ? "text-primary" : ""}`}>
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" className="relative text-neutral-dark hover:bg-neutral-bg" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-destructive"></span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 focus:outline-none">
                <Avatar className="h-9 w-9">
                  <AvatarImage src="" alt={user?.username} />
                  <AvatarFallback className="bg-primary text-white">
                    {user?.username ? getInitials(user.username) : "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:block text-sm font-medium">{user?.username}</span>
                <ChevronDown className="h-5 w-5 text-neutral-dark hidden md:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/profile" className="w-full cursor-pointer">
                  Your Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="w-full cursor-pointer">
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/help" className="w-full cursor-pointer">
                  Help Center
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive cursor-pointer" onClick={handleLogout}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={toggleSidebar}
        >
          <Menu className="h-6 w-6" />
        </Button>
      </div>
    </header>
  );
}
