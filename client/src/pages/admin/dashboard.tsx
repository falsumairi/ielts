import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  Users, 
  BookOpen, 
  Headphones, 
  Pen, 
  Mic, 
  ArrowRight,
  Loader2,
  BarChart4
} from "lucide-react";
import { TestModule } from "@shared/schema";

interface AdminStats {
  testCount: number;
  userCount: number;
  moduleStats: {
    reading: {
      testCount: number;
      attemptCount: number;
    };
    listening: {
      testCount: number;
      attemptCount: number;
    };
    writing: {
      testCount: number;
      attemptCount: number;
    };
    speaking: {
      testCount: number;
      attemptCount: number;
    };
  };
}

export default function AdminDashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Fetch admin stats
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed to fetch admin stats");
      return res.json();
    },
  });

  // Fetch all tests
  const { data: tests, isLoading: isLoadingTests } = useQuery({
    queryKey: ["/api/tests"],
    queryFn: async () => {
      const res = await fetch("/api/tests");
      if (!res.ok) throw new Error("Failed to fetch tests");
      return res.json();
    },
  });

  // Get module color
  const getModuleColor = (module: string) => {
    switch (module) {
      case TestModule.READING:
        return "bg-blue-100 text-blue-700";
      case TestModule.LISTENING:
        return "bg-amber-100 text-amber-700";
      case TestModule.WRITING:
        return "bg-green-100 text-green-700";
      case TestModule.SPEAKING:
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // Get module icon
  const getModuleIcon = (module: string) => {
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
        
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <div className="mt-2 md:mt-0 space-x-2">
                <Button asChild variant="outline">
                  <Link href="/admin/results">
                    View All Results <BarChart4 className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center h-60">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Tests</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{stats?.testCount || 0}</div>
                      <p className="text-sm text-muted-foreground">Total tests available</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Users</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{stats?.userCount || 0}</div>
                      <p className="text-sm text-muted-foreground">Registered users</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Test Attempts</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {stats ? (
                          stats.moduleStats.reading.attemptCount +
                          stats.moduleStats.listening.attemptCount +
                          stats.moduleStats.writing.attemptCount +
                          stats.moduleStats.speaking.attemptCount
                        ) : 0}
                      </div>
                      <p className="text-sm text-muted-foreground">Total attempts</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Module Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                          <span className="text-xs">{stats?.moduleStats.reading.testCount || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                          <span className="text-xs">{stats?.moduleStats.listening.testCount || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          <span className="text-xs">{stats?.moduleStats.writing.testCount || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                          <span className="text-xs">{stats?.moduleStats.speaking.testCount || 0}</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">Tests by module</p>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Module Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-lg flex items-center">
                        <BookOpen className="mr-2 h-4 w-4 text-blue-500" />
                        Reading
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats?.moduleStats.reading.attemptCount || 0}</div>
                      <p className="text-sm text-muted-foreground">Attempts</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {stats?.moduleStats.reading.testCount || 0} tests available
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-lg flex items-center">
                        <Headphones className="mr-2 h-4 w-4 text-amber-500" />
                        Listening
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats?.moduleStats.listening.attemptCount || 0}</div>
                      <p className="text-sm text-muted-foreground">Attempts</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {stats?.moduleStats.listening.testCount || 0} tests available
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-lg flex items-center">
                        <Pen className="mr-2 h-4 w-4 text-green-500" />
                        Writing
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats?.moduleStats.writing.attemptCount || 0}</div>
                      <p className="text-sm text-muted-foreground">Attempts</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {stats?.moduleStats.writing.testCount || 0} tests available
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-lg flex items-center">
                        <Mic className="mr-2 h-4 w-4 text-purple-500" />
                        Speaking
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats?.moduleStats.speaking.attemptCount || 0}</div>
                      <p className="text-sm text-muted-foreground">Attempts</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {stats?.moduleStats.speaking.testCount || 0} tests available
                      </p>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Test List */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold">Available Tests</h2>
                  </div>
                  
                  {isLoadingTests ? (
                    <div className="flex items-center justify-center h-40">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Test Title</TableHead>
                            <TableHead>Module</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tests?.map((test) => (
                            <TableRow key={test.id}>
                              <TableCell>{test.id}</TableCell>
                              <TableCell className="font-medium">{test.title}</TableCell>
                              <TableCell>
                                <div className="flex items-center">
                                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getModuleColor(test.module)}`}>
                                    {getModuleIcon(test.module)}
                                    <span className="ml-1 capitalize">{test.module}</span>
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>{test.durationMinutes} minutes</TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${test.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {test.active ? 'Active' : 'Inactive'}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="outline" asChild>
                                  <Link href={`/admin/tests/${test.id}`}>
                                    <span className="flex items-center">
                                      View <ArrowRight className="ml-1 h-4 w-4" />
                                    </span>
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
