import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, Clock, BookOpen, Headphones, Pen, Mic, BarChart2, ArrowRight, Loader2, ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import { WRITING_CRITERIA, SPEAKING_CRITERIA } from "@/hooks/use-score-calculation";

interface Attempt {
  id: number;
  userId: number;
  testId: number;
  startTime: string;
  endTime: string | null;
  status: string;
  score: number | null;
  bandScore?: number | null;
  criteriaScores?: Record<string, number> | null;
  createdAt: string;
  test?: {
    title: string;
    module: string;
    durationMinutes: number;
  };
}

export default function Results() {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Fetch user's test attempts
  const { data: attempts, isLoading } = useQuery<Attempt[]>({
    queryKey: ["/api/attempts/user"],
    queryFn: async () => {
      const res = await fetch("/api/attempts/user");
      if (!res.ok) throw new Error("Failed to fetch attempts");
      return res.json();
    },
    // Use staleTime to prevent frequent refetching
    staleTime: 60 * 1000, // 1 minute
    // Don't refetch on window focus to prevent repeated API calls
    refetchOnWindowFocus: false
  });

  // Fetch test details for each attempt
  const { data: tests } = useQuery({
    queryKey: ["/api/tests"],
    queryFn: async () => {
      const res = await fetch("/api/tests");
      if (!res.ok) throw new Error("Failed to fetch tests");
      return res.json();
    },
    enabled: !!attempts,
    staleTime: 5 * 60 * 1000, // 5 minutes 
    refetchOnWindowFocus: false
  });

  // Combine test data with attempts (only if both are loaded)
  const attemptsWithTestDetails = React.useMemo(() => {
    if (!attempts || !tests) return [];
    
    return attempts.map(attempt => {
      const test = tests.find(test => test.id === attempt.testId);
      return {
        ...attempt,
        test
      };
    });
  }, [attempts, tests]);

  // Sort attempts by most recent first
  const sortedAttempts = React.useMemo(() => {
    return [...attemptsWithTestDetails].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }, [attemptsWithTestDetails]);

  // Filter attempts by module
  const readingAttempts = React.useMemo(() => 
    sortedAttempts.filter(a => a.test?.module === "reading"),
    [sortedAttempts]
  );
  
  const listeningAttempts = React.useMemo(() => 
    sortedAttempts.filter(a => a.test?.module === "listening"),
    [sortedAttempts]
  );
  
  const writingAttempts = React.useMemo(() => 
    sortedAttempts.filter(a => a.test?.module === "writing"),
    [sortedAttempts]
  );
  
  const speakingAttempts = React.useMemo(() => 
    sortedAttempts.filter(a => a.test?.module === "speaking"),
    [sortedAttempts]
  );

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Format time
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate duration in minutes
  const calculateDuration = (startTime: string, endTime: string | null) => {
    if (!endTime) return "In progress";
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const durationMinutes = Math.round((end - start) / (1000 * 60));
    return `${durationMinutes} minutes`;
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "in_progress":
        return <Badge variant="outline" className="text-amber-500 border-amber-500">In Progress</Badge>;
      case "abandoned":
        return <Badge variant="destructive">Abandoned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get module icon
  const getModuleIcon = (module: string) => {
    switch (module) {
      case "reading":
        return <BookOpen className="h-5 w-5" />;
      case "listening":
        return <Headphones className="h-5 w-5" />;
      case "writing":
        return <Pen className="h-5 w-5" />;
      case "speaking":
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
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <h1 className="text-2xl font-bold">My Results</h1>
              <Button asChild>
                <Link href="/" className="mt-2 md:mt-0">
                  Take New Test <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center h-60">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : attempts && attempts.length > 0 ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center">
                        <BookOpen className="mr-2 h-4 w-4 text-primary" />
                        Reading
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {readingAttempts.length > 0 && readingAttempts[0].score !== null
                          ? readingAttempts[0].score
                          : "-"}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Latest Score
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center">
                        <Headphones className="mr-2 h-4 w-4 text-primary" />
                        Listening
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {listeningAttempts.length > 0 && listeningAttempts[0].score !== null
                          ? listeningAttempts[0].score
                          : "-"}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Latest Score
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center">
                        <Pen className="mr-2 h-4 w-4 text-primary" />
                        Writing
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {writingAttempts.length > 0 && writingAttempts[0].score !== null
                          ? writingAttempts[0].score
                          : "-"}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Latest Score
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center">
                        <Mic className="mr-2 h-4 w-4 text-primary" />
                        Speaking
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {speakingAttempts.length > 0 && speakingAttempts[0].score !== null
                          ? speakingAttempts[0].score
                          : "-"}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Latest Score
                      </p>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Test History */}
                <Tabs defaultValue="all">
                  <TabsList className="mb-4">
                    <TabsTrigger value="all">All Tests</TabsTrigger>
                    <TabsTrigger value="reading">Reading</TabsTrigger>
                    <TabsTrigger value="listening">Listening</TabsTrigger>
                    <TabsTrigger value="writing">Writing</TabsTrigger>
                    <TabsTrigger value="speaking">Speaking</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="all">
                    <TestHistoryTable attempts={sortedAttempts} />
                  </TabsContent>
                  
                  <TabsContent value="reading">
                    <TestHistoryTable attempts={readingAttempts} />
                  </TabsContent>
                  
                  <TabsContent value="listening">
                    <TestHistoryTable attempts={listeningAttempts} />
                  </TabsContent>
                  
                  <TabsContent value="writing">
                    <TestHistoryTable attempts={writingAttempts} />
                  </TabsContent>
                  
                  <TabsContent value="speaking">
                    <TestHistoryTable attempts={speakingAttempts} />
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <div className="p-8 text-center bg-white rounded-lg shadow-sm">
                <p className="text-lg text-neutral-dark mb-4">No test attempts found.</p>
                <Button asChild>
                  <Link href="/">
                    Take Your First Test <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
      
      <MobileNav />
    </div>
  );
}

interface TestHistoryTableProps {
  attempts: Attempt[];
}

function TestHistoryTable({ attempts }: TestHistoryTableProps) {
  const [selectedAttempt, setSelectedAttempt] = useState<Attempt | null>(null);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  
  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  
  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "in_progress":
        return <Badge variant="outline" className="text-amber-500 border-amber-500">In Progress</Badge>;
      case "abandoned":
        return <Badge variant="destructive">Abandoned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  // Get module icon
  const getModuleIcon = (module: string) => {
    switch (module) {
      case "reading":
        return <BookOpen className="h-5 w-5 text-primary" />;
      case "listening":
        return <Headphones className="h-5 w-5 text-primary" />;
      case "writing":
        return <Pen className="h-5 w-5 text-primary" />;
      case "speaking":
        return <Mic className="h-5 w-5 text-primary" />;
      default:
        return <BookOpen className="h-5 w-5 text-primary" />;
    }
  };
  
  // View score details
  const viewScoreDetails = (attempt: Attempt) => {
    setSelectedAttempt(attempt);
    setShowScoreDetails(true);
  };
  
  // Render score based on module type
  const renderScore = (attempt: Attempt) => {
    if (attempt.score === null) {
      return attempt.status === "completed" ? "Pending" : "-";
    }
    
    // Return band score if available
    if (attempt.bandScore) {
      return (
        <div className="flex flex-col">
          <span className="font-bold text-primary">{attempt.bandScore}</span>
          <span className="text-xs text-muted-foreground">Band Score</span>
        </div>
      );
    }
    
    return attempt.score;
  };
  
  // Check if attempts exists and has items
  if (!attempts || attempts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-8 text-center">
          <p className="text-lg text-neutral-dark mb-4">No test attempts found.</p>
          <Button asChild>
            <Link href="/">
              Take Your First Test <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <>
      {/* Score Details Dialog */}
      <Dialog open={showScoreDetails} onOpenChange={setShowScoreDetails}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Score Details</DialogTitle>
            <DialogDescription>
              {selectedAttempt && (
                <span>
                  {selectedAttempt.test?.title} ({formatDate(selectedAttempt.startTime)})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedAttempt && (
            <div className="py-4">
              <div className="flex items-center mb-6">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <BarChart2 className="h-7 w-7 text-primary" />
                </div>
                <div className="ml-4">
                  <div className="text-3xl font-bold">
                    {selectedAttempt.bandScore || (selectedAttempt.score !== null ? selectedAttempt.score : "-")}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedAttempt.bandScore ? "IELTS Band Score" : "Raw Score"}
                  </p>
                </div>
              </div>
              
              {selectedAttempt.criteriaScores && (
                <div className="space-y-4">
                  <h4 className="font-medium text-sm mb-2">Scoring Criteria</h4>
                  
                  {/* Get the appropriate criteria based on module type */}
                  {(selectedAttempt.test?.module === "writing" ? WRITING_CRITERIA : 
                    selectedAttempt.test?.module === "speaking" ? SPEAKING_CRITERIA : []).map((criterion) => {
                    const criterionScore = selectedAttempt.criteriaScores?.[criterion.name] || 0;
                    
                    return (
                      <div key={criterion.name} className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">{criterion.name}</span>
                          <span className="text-sm font-medium">{criterionScore}</span>
                        </div>
                        <Progress value={criterionScore * 10} className="h-2" />
                        <p className="text-xs text-muted-foreground">{criterion.description}</p>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {(selectedAttempt.test?.module === "reading" || selectedAttempt.test?.module === "listening") && selectedAttempt.score !== null && (
                <div className="pt-4">
                  <h4 className="font-medium text-sm mb-4">Score Distribution</h4>
                  <div className="bg-neutral-50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Raw Score</span>
                      <span className="text-sm font-medium">{selectedAttempt.score}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Band Score</span>
                      <span className="text-sm font-medium">{selectedAttempt.bandScore}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Maximum Possible</span>
                      <span className="text-sm font-medium">9.0</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.map((attempt) => (
                <TableRow key={attempt.id}>
                  <TableCell className="font-medium">{attempt.test?.title || 'Unknown Test'}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      {getModuleIcon(attempt.test?.module || '')}
                      <span className="ml-2 capitalize">{attempt.test?.module}</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(attempt.startTime)}</TableCell>
                  <TableCell>{getStatusBadge(attempt.status)}</TableCell>
                  <TableCell>
                    {renderScore(attempt)}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {attempt.status === "in_progress" ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        asChild
                      >
                        <Link href={`/tests/${attempt.test?.module}/${attempt.testId}?attempt=${attempt.id}`}>
                          Continue
                        </Link>
                      </Button>
                    ) : (
                      <>
                        {attempt.score !== null && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => viewScoreDetails(attempt)}
                          >
                            Details
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          asChild
                        >
                          <Link href={`/tests/${attempt.test?.module}/${attempt.testId}?attempt=${attempt.id}&view=true`}>
                            View
                          </Link>
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
