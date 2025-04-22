import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Search,
  BookOpen,
  Headphones,
  Pen,
  Mic,
  Calendar,
  User,
  Loader2,
  Check,
  XCircle,
  Filter,
} from "lucide-react";
import { TestModule, QuestionType } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Attempt {
  id: number;
  userId: number;
  testId: number;
  startTime: string;
  endTime: string | null;
  status: string;
  score: number | null;
  createdAt: string;
  user?: {
    id: number;
    username: string;
    email: string;
  };
  test?: {
    id: number;
    title: string;
    module: string;
    durationMinutes: number;
  };
}

interface Answer {
  id: number;
  attemptId: number;
  questionId: number;
  answer: string;
  isCorrect: boolean | null;
  score: number | null;
  audioPath: string | null;
  gradedBy: number | null;
  feedback: string | null;
  createdAt: string;
  question?: {
    id: number;
    content: string;
    type: string;
    correctAnswer: string | null;
  };
}

export default function AdminResults() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<Attempt | null>(null);
  const [isGradingDialogOpen, setIsGradingDialogOpen] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState<Answer | null>(null);
  const [gradingScore, setGradingScore] = useState<number>(0);
  const [gradingFeedback, setGradingFeedback] = useState<string>("");
  const [isCorrect, setIsCorrect] = useState<boolean>(false);

  // Fetch all test attempts
  const { data: attempts, isLoading: isLoadingAttempts } = useQuery<Attempt[]>({
    queryKey: ["/api/admin/attempts"],
    queryFn: async () => {
      // Since we don't have a specific admin/attempts endpoint in our API,
      // we'll fetch all tests and then for each test, fetch its attempts
      const testsResponse = await fetch("/api/tests");
      if (!testsResponse.ok) throw new Error("Failed to fetch tests");
      const tests = await testsResponse.json();

      // For each test, fetch attempts
      let allAttempts: Attempt[] = [];
      for (const test of tests) {
        const attemptsResponse = await fetch(`/api/tests/${test.id}/attempts`);
        if (attemptsResponse.ok) {
          const testAttempts = await attemptsResponse.json();
          // Add test data to each attempt
          const attemptsWithTest = testAttempts.map((attempt: Attempt) => ({
            ...attempt,
            test: test,
          }));
          allAttempts = [...allAttempts, ...attemptsWithTest];
        }
      }

      // For each attempt, fetch user data
      const attemptsWithUserData = await Promise.all(
        allAttempts.map(async (attempt: Attempt) => {
          // In a real app, we would fetch user data, but for now we'll simulate it
          // since we don't have a specific endpoint for this
          const user = {
            id: attempt.userId,
            username: `user${attempt.userId}`,
            email: `user${attempt.userId}@example.com`,
          };
          return { ...attempt, user };
        })
      );

      return attemptsWithUserData;
    },
  });

  // Fetch answers for a specific attempt
  const { data: answers, isLoading: isLoadingAnswers } = useQuery<Answer[]>({
    queryKey: ["/api/attempts", selectedAttempt?.id, "answers"],
    queryFn: async () => {
      if (!selectedAttempt) return [];
      const res = await fetch(`/api/attempts/${selectedAttempt.id}/answers`);
      if (!res.ok) throw new Error("Failed to fetch answers");
      
      const answersData = await res.json();
      
      // Fetch question details for each answer
      const answersWithQuestions = await Promise.all(
        answersData.map(async (answer: Answer) => {
          const questionRes = await fetch(`/api/tests/${selectedAttempt.testId}/questions`);
          if (questionRes.ok) {
            const questions = await questionRes.json();
            const question = questions.find((q: any) => q.id === answer.questionId);
            return { ...answer, question };
          }
          return answer;
        })
      );
      
      return answersWithQuestions;
    },
    enabled: !!selectedAttempt,
  });

  // Grade answer mutation
  const gradeMutation = useMutation({
    mutationFn: async ({ 
      answerId, 
      isCorrect, 
      score, 
      feedback 
    }: { 
      answerId: number; 
      isCorrect: boolean; 
      score: number; 
      feedback: string; 
    }) => {
      const res = await apiRequest("PATCH", `/api/answers/${answerId}`, {
        isCorrect,
        score,
        feedback,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Answer graded",
        description: "The answer has been successfully graded.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/attempts", selectedAttempt?.id, "answers"] });
      setIsGradingDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Grading failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle opening grading dialog
  const openGradingDialog = (answer: Answer) => {
    setCurrentAnswer(answer);
    setGradingScore(answer.score || 0);
    setGradingFeedback(answer.feedback || "");
    setIsCorrect(answer.isCorrect || false);
    setIsGradingDialogOpen(true);
  };

  // Handle submitting grade
  const handleGradeSubmit = () => {
    if (!currentAnswer) return;
    
    gradeMutation.mutate({
      answerId: currentAnswer.id,
      isCorrect,
      score: gradingScore,
      feedback: gradingFeedback,
    });
  };

  // Filter attempts based on search term and filters
  const filteredAttempts = attempts?.filter(attempt => {
    // Search by username, test title, or attempt id
    const searchMatch = !searchTerm || 
      attempt.user?.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      attempt.test?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      attempt.id.toString().includes(searchTerm);
    
    // Filter by status
    const statusMatch = !statusFilter || attempt.status === statusFilter;
    
    // Filter by module
    const moduleMatch = !moduleFilter || attempt.test?.module === moduleFilter;
    
    return searchMatch && statusMatch && moduleMatch;
  });

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
      case TestModule.READING:
        return <BookOpen className="h-5 w-5 text-primary" />;
      case TestModule.LISTENING:
        return <Headphones className="h-5 w-5 text-primary" />;
      case TestModule.WRITING:
        return <Pen className="h-5 w-5 text-primary" />;
      case TestModule.SPEAKING:
        return <Mic className="h-5 w-5 text-primary" />;
      default:
        return <BookOpen className="h-5 w-5 text-primary" />;
    }
  };

  // Determine if an answer needs manual grading
  const needsManualGrading = (answer: Answer) => {
    if (!answer.question) return false;
    return (
      answer.question.type === QuestionType.ESSAY ||
      answer.question.type === QuestionType.SPEAKING ||
      answer.question.type === QuestionType.SHORT_ANSWER
    );
  };

  // Check if an attempt has been fully graded
  const isAttemptFullyGraded = (attemptId: number) => {
    if (!answers) return false;
    
    const attemptAnswers = answers.filter(a => a.attemptId === attemptId);
    if (attemptAnswers.length === 0) return false;
    
    // Check if all answers that need manual grading have been graded
    const answersNeedingGrading = attemptAnswers.filter(answer => 
      needsManualGrading(answer) && (answer.score === null || answer.feedback === null)
    );
    
    return answersNeedingGrading.length === 0;
  };

  return (
    <div className="min-h-screen flex flex-col bg-neutral-bg">
      <Header toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className="flex flex-1">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <h1 className="text-2xl font-bold">Test Results</h1>
            </div>
            
            {!selectedAttempt ? (
              // Attempts list view
              <>
                {/* Search and filters */}
                <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by user or test..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    
                    <Select
                      value={statusFilter || ""}
                      onValueChange={(value) => setStatusFilter(value || null)}
                    >
                      <SelectTrigger>
                        <div className="flex items-center">
                          <Filter className="mr-2 h-4 w-4" />
                          <span>{statusFilter || "Status filter"}</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All statuses</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="abandoned">Abandoned</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select
                      value={moduleFilter || ""}
                      onValueChange={(value) => setModuleFilter(value || null)}
                    >
                      <SelectTrigger>
                        <div className="flex items-center">
                          <Filter className="mr-2 h-4 w-4" />
                          <span>{moduleFilter || "Module filter"}</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All modules</SelectItem>
                        <SelectItem value={TestModule.READING}>Reading</SelectItem>
                        <SelectItem value={TestModule.LISTENING}>Listening</SelectItem>
                        <SelectItem value={TestModule.WRITING}>Writing</SelectItem>
                        <SelectItem value={TestModule.SPEAKING}>Speaking</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Attempts table */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>Test Attempts</CardTitle>
                    <CardDescription>
                      View and grade test attempts from all users
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingAttempts ? (
                      <div className="flex items-center justify-center h-60">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : !filteredAttempts?.length ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">No test attempts found matching your criteria.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>User</TableHead>
                              <TableHead>Test</TableHead>
                              <TableHead>Module</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Score</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredAttempts.map((attempt) => (
                              <TableRow key={attempt.id}>
                                <TableCell>{attempt.id}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <span>{attempt.user?.username}</span>
                                  </div>
                                </TableCell>
                                <TableCell>{attempt.test?.title}</TableCell>
                                <TableCell>
                                  <div className="flex items-center">
                                    {getModuleIcon(attempt.test?.module || "")}
                                    <span className="ml-2 capitalize">{attempt.test?.module}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <span>{formatDate(attempt.startTime)}</span>
                                  </div>
                                </TableCell>
                                <TableCell>{getStatusBadge(attempt.status)}</TableCell>
                                <TableCell>
                                  {attempt.score !== null ? (
                                    <span>{attempt.score}</span>
                                  ) : attempt.status === "completed" ? (
                                    <Badge variant="outline">Needs grading</Badge>
                                  ) : (
                                    "-"
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedAttempt(attempt)}
                                  >
                                    View & Grade
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              // Detailed attempt view
              <>
                <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold flex items-center">
                      {getModuleIcon(selectedAttempt.test?.module || "")}
                      <span className="ml-2">{selectedAttempt.test?.title}</span>
                    </h2>
                    <div className="flex items-center mt-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4 mr-1" />
                      <span className="mr-4">{selectedAttempt.user?.username}</span>
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>{formatDate(selectedAttempt.startTime)}</span>
                    </div>
                  </div>
                  <div className="mt-4 md:mt-0">
                    <Button 
                      variant="outline" 
                      onClick={() => setSelectedAttempt(null)}
                    >
                      Back to All Attempts
                    </Button>
                  </div>
                </div>

                {/* Summary card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold">
                        {getStatusBadge(selectedAttempt.status)}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold">
                        {selectedAttempt.score !== null ? (
                          selectedAttempt.score
                        ) : isAttemptFullyGraded(selectedAttempt.id) ? (
                          "Calculating..."
                        ) : (
                          "Not fully graded"
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Completion Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold">
                        {selectedAttempt.endTime ? (
                          `${Math.round((new Date(selectedAttempt.endTime).getTime() - new Date(selectedAttempt.startTime).getTime()) / 60000)} minutes`
                        ) : (
                          "Not completed"
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Answers table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Student Answers</CardTitle>
                    <CardDescription>
                      Review and grade the student's answers for this test attempt
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingAnswers ? (
                      <div className="flex items-center justify-center h-60">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : !answers?.length ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">No answers found for this attempt.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Question</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Answer</TableHead>
                              <TableHead>Correct</TableHead>
                              <TableHead>Score</TableHead>
                              <TableHead>Feedback</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {answers.map((answer) => (
                              <TableRow key={answer.id}>
                                <TableCell className="max-w-[200px] truncate">
                                  {answer.question?.content || `Question ${answer.questionId}`}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {answer.question?.type || "Unknown"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate">
                                  {answer.answer === "AUDIO_RESPONSE" ? (
                                    <div className="flex items-center">
                                      <Mic className="h-4 w-4 mr-1 text-primary" />
                                      <span>Audio recording</span>
                                    </div>
                                  ) : (
                                    answer.answer
                                  )}
                                </TableCell>
                                <TableCell>
                                  {answer.isCorrect === null ? (
                                    <Badge variant="outline">Not graded</Badge>
                                  ) : answer.isCorrect ? (
                                    <Check className="h-5 w-5 text-green-500" />
                                  ) : (
                                    <XCircle className="h-5 w-5 text-red-500" />
                                  )}
                                </TableCell>
                                <TableCell>
                                  {answer.score !== null ? answer.score : "-"}
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate">
                                  {answer.feedback || "-"}
                                </TableCell>
                                <TableCell className="text-right">
                                  {needsManualGrading(answer) ? (
                                    <Button
                                      size="sm"
                                      onClick={() => openGradingDialog(answer)}
                                    >
                                      Grade
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openGradingDialog(answer)}
                                    >
                                      Review
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Grading Dialog */}
      <Dialog open={isGradingDialogOpen} onOpenChange={setIsGradingDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Grade Answer</DialogTitle>
            <DialogDescription>
              Review the student's response and provide a grade and feedback.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Question:</h3>
              <div className="p-3 bg-muted rounded-md">
                {currentAnswer?.question?.content || `Question ${currentAnswer?.questionId}`}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Student's Answer:</h3>
              <div className="p-3 bg-muted rounded-md">
                {currentAnswer?.answer === "AUDIO_RESPONSE" ? (
                  <div className="flex items-center">
                    <Mic className="h-5 w-5 mr-2 text-primary" />
                    <span>Audio response</span>
                    {currentAnswer?.audioPath && (
                      <audio 
                        controls 
                        src={currentAnswer.audioPath} 
                        className="ml-2 w-full"
                      />
                    )}
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">
                    {currentAnswer?.answer}
                  </div>
                )}
              </div>
            </div>

            {currentAnswer?.question?.correctAnswer && (
              <div>
                <h3 className="text-sm font-medium mb-2">Correct Answer:</h3>
                <div className="p-3 bg-muted rounded-md">
                  {currentAnswer.question.correctAnswer}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Is this answer correct?</h3>
                <div className="flex space-x-2">
                  <Button
                    variant={isCorrect ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsCorrect(true)}
                    className="flex-1"
                  >
                    <Check className="h-4 w-4 mr-1" /> Correct
                  </Button>
                  <Button
                    variant={!isCorrect ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsCorrect(false)}
                    className="flex-1"
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Incorrect
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Score (0-9):</h3>
                <Select
                  value={gradingScore.toString()}
                  onValueChange={(value) => setGradingScore(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select score" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Feedback:</h3>
              <Textarea
                value={gradingFeedback}
                onChange={(e) => setGradingFeedback(e.target.value)}
                placeholder="Provide feedback on the student's answer..."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGradingDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGradeSubmit} disabled={gradeMutation.isPending}>
              {gradeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                "Save Grade"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
