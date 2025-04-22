import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Test, TestModule } from "@shared/schema";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Headphones, Mic, Pen, Clock, ChevronRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [, navigate] = useLocation();
  const [, params] = useRoute("/:any*");
  
  // Extract module from URL params if present
  const searchParams = new URLSearchParams(window.location.search);
  const moduleFromUrl = searchParams.get("module") as TestModule | null;
  const [activeTab, setActiveTab] = useState<TestModule>(moduleFromUrl || TestModule.READING);

  // Update URL when tab changes
  useEffect(() => {
    if (activeTab && moduleFromUrl !== activeTab) {
      navigate(activeTab === TestModule.READING ? "/" : `/?module=${activeTab}`, { replace: true });
    }
  }, [activeTab, navigate, moduleFromUrl]);

  // Fetch tests based on selected module
  const { data: tests, isLoading } = useQuery<Test[]>({
    queryKey: ["/api/tests/module", activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/tests/module/${activeTab}`);
      if (!res.ok) throw new Error("Failed to fetch tests");
      return res.json();
    }
  });

  // Start a test attempt
  const startTest = async (testId: number) => {
    try {
      const res = await apiRequest("POST", `/api/tests/${testId}/attempts`, {});
      const attempt = await res.json();
      
      // Navigate to the appropriate test page based on module
      switch (activeTab) {
        case TestModule.READING:
          navigate(`/tests/reading/${testId}?attempt=${attempt.id}`);
          break;
        case TestModule.LISTENING:
          navigate(`/tests/listening/${testId}?attempt=${attempt.id}`);
          break;
        case TestModule.WRITING:
          navigate(`/tests/writing/${testId}?attempt=${attempt.id}`);
          break;
        case TestModule.SPEAKING:
          navigate(`/tests/speaking/${testId}?attempt=${attempt.id}`);
          break;
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start test",
        variant: "destructive",
      });
    }
  };

  const getModuleIcon = (module: TestModule) => {
    switch (module) {
      case TestModule.READING:
        return <BookOpen className="h-5 w-5" />;
      case TestModule.LISTENING:
        return <Headphones className="h-5 w-5" />;
      case TestModule.WRITING:
        return <Pen className="h-5 w-5" />;
      case TestModule.SPEAKING:
        return <Mic className="h-5 w-5" />;
      default:
        return <BookOpen className="h-5 w-5" />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-neutral-bg">
      <Header toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className="flex flex-1">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Welcome, {user?.username}!</h1>
            
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TestModule)} className="mb-6">
              <TabsList className="grid grid-cols-4 mb-4">
                <TabsTrigger value={TestModule.READING} className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Reading
                </TabsTrigger>
                <TabsTrigger value={TestModule.LISTENING} className="flex items-center gap-2">
                  <Headphones className="h-4 w-4" /> Listening
                </TabsTrigger>
                <TabsTrigger value={TestModule.WRITING} className="flex items-center gap-2">
                  <Pen className="h-4 w-4" /> Writing
                </TabsTrigger>
                <TabsTrigger value={TestModule.SPEAKING} className="flex items-center gap-2">
                  <Mic className="h-4 w-4" /> Speaking
                </TabsTrigger>
              </TabsList>
              
              {Object.values(TestModule).map((module) => (
                <TabsContent key={module} value={module} className="space-y-4">
                  <h2 className="text-xl font-semibold">Available {module.charAt(0).toUpperCase() + module.slice(1)} Tests</h2>
                  
                  {isLoading ? (
                    <div className="flex items-center justify-center h-40">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : tests?.length === 0 ? (
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground">No tests available for this module</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {tests?.map((test) => (
                        <Card key={test.id} className="h-full flex flex-col">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              {getModuleIcon(test.module as TestModule)}
                              {test.title}
                            </CardTitle>
                            <CardDescription>{test.description}</CardDescription>
                          </CardHeader>
                          <CardContent className="flex-1">
                            <div className="flex items-center text-sm text-muted-foreground mb-2">
                              <Clock className="h-4 w-4 mr-1" />
                              <span>{test.durationMinutes} minutes</span>
                            </div>
                          </CardContent>
                          <CardFooter>
                            <Button className="w-full" onClick={() => startTest(test.id)}>
                              Start Test <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </main>
      </div>
      
      <MobileNav />
    </div>
  );
}
