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
import { Bell, BookOpen, ChevronDown, GraduationCap, LineChart, Menu, Settings, UserCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";

interface HeaderProps {
  toggleSidebar: () => void;
}

export default function Header({ toggleSidebar }: HeaderProps) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

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
    <header className="bg-white shadow-md sticky top-0 z-50">
      <div className="container-wide py-3 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-md bg-gradient-to-r from-primary to-secondary flex-center text-white text-lg font-bold">
            <GraduationCap className="h-6 w-6" />
          </div>
          <span className="text-xl font-bold gradient-text">IELTS Exam</span>
        </div>

        {/* Desktop navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          <Link href="/" className={`flex items-center space-x-2 font-medium hover:text-primary transition duration-300 ${location === "/" ? "text-primary" : ""}`}>
            <BookOpen className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>
          <Link href="/results" className={`flex items-center space-x-2 font-medium hover:text-primary transition duration-300 ${location === "/results" ? "text-primary" : ""}`}>
            <LineChart className="h-4 w-4" />
            <span>My Results</span>
          </Link>
          {user?.role === UserRole.ADMIN && (
            <Link href="/admin" className={`flex items-center space-x-2 font-medium hover:text-primary transition duration-300 ${location.startsWith("/admin") ? "text-primary" : ""}`}>
              <Settings className="h-4 w-4" />
              <span>Admin</span>
            </Link>
          )}
        </nav>

        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" className="relative text-neutral-dark hover:bg-neutral-bg transition-all" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-destructive animate-pulse"></span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 transition-all">
                <Avatar className="h-9 w-9 border-2 border-primary/20">
                  <AvatarImage src="" alt={user?.username} />
                  <AvatarFallback className="bg-gradient-to-r from-primary to-secondary text-white">
                    {user?.username ? getInitials(user.username) : "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium leading-none">{user?.username}</p>
                  <p className="text-xs text-muted-foreground mt-1">{user?.role || "Test Taker"}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-neutral-dark hidden md:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2">
              <div className="flex flex-col space-y-1 p-2 md:hidden">
                <p className="text-sm font-medium">{user?.username}</p>
                <p className="text-xs text-muted-foreground">{user?.role || "Test Taker"}</p>
              </div>
              <DropdownMenuItem asChild className="flex items-center gap-2 p-2 cursor-pointer">
                <Link href="/profile" className="w-full">
                  <UserCircle className="h-4 w-4 mr-2" />
                  Your Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="flex items-center gap-2 p-2 cursor-pointer">
                <Link href="/settings" className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive cursor-pointer p-2 hover:bg-destructive/10" onClick={handleLogout}>
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
