import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeProvider";
import { GraduationCap, Menu, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import NotificationBell from "@/components/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

interface HeaderProps {
  showAuthButtons?: boolean;
}

export default function Header({ showAuthButtons = true }: HeaderProps) {
  const { user, logoutMutation } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const navigation = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Results", href: "/results" },
    { name: "Vocabulary", href: "/vocabulary" },
    { name: "Achievements", href: "/achievements" },
  ];

  const adminNavigation = [
    { name: "Admin Dashboard", href: "/admin/dashboard" },
    { name: "Tests", href: "/admin/tests" },
    { name: "Results", href: "/admin/results" },
  ];

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center">
          <Link href="/" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-r from-primary to-secondary flex-center text-white text-xl font-bold">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold gradient-text hidden sm:inline-block">IELTS Exam Pro</span>
          </Link>

          {/* Desktop navigation */}
          {user && (
            <nav className="ml-8 hidden md:flex space-x-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                >
                  {item.name}
                </Link>
              ))}
              
              {user.role === "admin" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      Admin
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Admin Controls</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {adminNavigation.map((item) => (
                      <DropdownMenuItem key={item.name} asChild>
                        <Link href={item.href}>{item.name}</Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Theme toggle button */}
          <ThemeToggle />
          
          {/* Notification Bell - only show for authenticated users */}
          {user && <NotificationBell />}
          
          {/* Auth buttons for non-authenticated users */}
          {!user && showAuthButtons && (
            <div className="hidden md:flex items-center space-x-2">
              <Link href="/auth">
                <Button variant="outline" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/auth?tab=register">
                <Button size="sm">Register</Button>
              </Link>
            </div>
          )}

          {/* User menu */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <span className="hidden sm:inline-block">{user.username}</span>
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/results">My Results</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-center p-4">
                  <div className="flex items-center space-x-2">
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-r from-primary to-secondary flex-center text-white text-xl font-bold">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <span className="text-xl font-bold gradient-text">IELTS Exam Pro</span>
                  </div>
                </div>
                
                <nav className="flex flex-col space-y-2 p-4">
                  {!user && showAuthButtons && (
                    <>
                      <SheetClose asChild>
                        <Link href="/auth">
                          <Button variant="outline" className="w-full justify-start">
                            Sign In
                          </Button>
                        </Link>
                      </SheetClose>
                      <SheetClose asChild>
                        <Link href="/auth?tab=register">
                          <Button className="w-full justify-start">
                            Register
                          </Button>
                        </Link>
                      </SheetClose>
                    </>
                  )}
                  
                  {user && (
                    <>
                      <div className="flex items-center space-x-2 mb-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{user.username}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                      
                      {navigation.map((item) => (
                        <SheetClose key={item.name} asChild>
                          <Link
                            href={item.href}
                            className="flex items-center gap-2 px-3 py-2 text-sm"
                          >
                            {item.name}
                          </Link>
                        </SheetClose>
                      ))}
                      
                      {user.role === "admin" && (
                        <>
                          <div className="text-xs uppercase font-semibold text-muted-foreground pt-4 pb-2">
                            Admin
                          </div>
                          {adminNavigation.map((item) => (
                            <SheetClose key={item.name} asChild>
                              <Link
                                href={item.href}
                                className="flex items-center gap-2 px-3 py-2 text-sm"
                              >
                                {item.name}
                              </Link>
                            </SheetClose>
                          ))}
                        </>
                      )}
                      
                      <Button
                        variant="ghost"
                        className="justify-start mt-auto"
                        onClick={handleLogout}
                      >
                        Logout
                      </Button>
                    </>
                  )}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}