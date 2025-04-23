import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Test, Question, QuestionType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ExamTimer from "@/components/ExamTimer";
import TextEditor from "@/components/TextEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Brain, 
  BadgeCheck,
  Star,
  Info
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import TranslationToggle from "@/components/TranslationToggle";

export default function WritingTest() {
  const { id } = useParams<{ id: string }>();
  const testId = parseInt(id);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  // Get attempt ID from URL
  const searchParams = new URLSearchParams(window.location.search);
  const attemptId = parseInt(searchParams.get("attempt") || "0");
  
  // Component state
  const [activeTask, setActiveTask] = useState("1");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [wordCounts, setWordCounts] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [testEnded, setTestEnded] = useState(false);
  
  // Translation state
  const [translatedTask1, setTranslatedTask1] = useState<string | null>(null);
  const [translatedTask2, setTranslatedTask2] = useState<string | null>(null);
  
  // AI Scoring state
  const [showAIScoreDialog, setShowAIScoreDialog] = useState(false);
  const [scoringTaskId, setScoringTaskId] = useState<number | null>(null);
  const [aiScoreResult, setAiScoreResult] = useState<any>(null);
  
  // Fetch test details
  const { data: test, isLoading: isLoadingTest } = useQuery<Test>({
    queryKey: ["/api/tests", testId],
    queryFn: async () => {
      const res = await fetch(`/api/tests/${testId}`);
      if (!res.ok) throw new Error("Failed to fetch test");
      return res.json();
    },
    enabled: !!testId && !isNaN(testId),
  });
  
  // Fetch questions (writing tasks) with randomization
  const { data: questions, isLoading: isLoadingQuestions } = useQuery<Question[]>({
    queryKey: ["/api/tests", testId, "questions", "randomized"],
    queryFn: async () => {
      // Use randomization for new attempts to ensure different questions each time
      const shouldRandomize = !attemptId || attemptId <= 0;
      const url = `/api/tests/${testId}/questions${shouldRandomize ? '?randomize=true' : ''}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch questions");
      return res.json();
    },
    enabled: !!testId && !isNaN(testId),
    // Prevent refetching which would randomize again during the session
    staleTime: Infinity,
  });
  
  // Fetch existing answers (if returning to test)
  const { data: existingAnswers, isLoading: isLoadingAnswers } = useQuery({
    queryKey: ["/api/attempts", attemptId, "answers"],
    queryFn: async () => {
      const res = await fetch(`/api/attempts/${attemptId}/answers`);
      if (!res.ok) throw new Error("Failed to fetch answers");
      return res.json();
    },
    enabled: !!attemptId && !isNaN(attemptId),
  });
  
  // Initialize timer when test data is loaded
  useEffect(() => {
    if (test && !timeLeft) {
      setTimeLeft(test.durationMinutes * 60);
    }
  }, [test, timeLeft]);
  
  // Populate answers from existing data
  useEffect(() => {
    if (existingAnswers && questions) {
      const answerMap = existingAnswers.reduce((acc: Record<number, string>, answer: any) => {
        acc[answer.questionId] = answer.answer;
        return acc;
      }, {});
      setAnswers(answerMap);
      
      // Initialize word counts for existing answers
      const wordCountMap: Record<number, number> = {};
      Object.entries(answerMap).forEach(([questionId, text]) => {
        const count = text.trim().split(/\s+/).filter(Boolean).length;
        wordCountMap[Number(questionId)] = count;
      });
      setWordCounts(wordCountMap);
    }
  }, [existingAnswers, questions]);
  
  // Submit answer mutation
  const submitAnswerMutation = useMutation({
    mutationFn: async ({ questionId, answer }: { questionId: number; answer: string }) => {
      const res = await apiRequest("POST", `/api/attempts/${attemptId}/answers`, {
        questionId,
        answer,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attempts", attemptId, "answers"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to submit answer",
        variant: "destructive",
      });
    },
  });
  
  // Complete test mutation
  const completeTestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/attempts/${attemptId}`, {
        status: "completed",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Test Completed",
        description: "Your essays have been submitted",
      });
      navigate("/results");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to complete test",
        variant: "destructive",
      });
    },
  });
  
  // AI Scoring mutation
  const aiScoreMutation = useMutation({
    mutationFn: async ({ 
      prompt, 
      response, 
      answerId 
    }: { 
      prompt: string; 
      response: string; 
      answerId: number;
    }) => {
      const res = await apiRequest("POST", "/api/writing/score", {
        prompt,
        response,
        answerId
      });
      return res.json();
    },
    onSuccess: (data) => {
      setAiScoreResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/attempts", attemptId, "answers"] });
    },
    onError: (error) => {
      toast({
        title: "AI Scoring Failed",
        description: "Could not generate AI feedback for your essay",
        variant: "destructive",
      });
      setShowAIScoreDialog(false);
    },
  });
  
  // Handle answer change
  const handleAnswerChange = (questionId: number, text: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: text }));
    submitAnswerMutation.mutate({ questionId, answer: text });
  };
  
  // Handle word count change
  const handleWordCountChange = (questionId: number, count: number) => {
    setWordCounts((prev) => ({ ...prev, [questionId]: count }));
  };
  
  // Handle test end (time up or manual submission)
  const handleEndTest = () => {
    // Check if all required tasks have content
    if (questions) {
      const incompleteTasks = questions.filter(
        q => !answers[q.id] || (wordCounts[q.id] || 0) < 150
      );
      
      if (incompleteTasks.length > 0) {
        if (confirm("Some of your essays may be incomplete. Are you sure you want to submit your test?")) {
          setTestEnded(true);
          completeTestMutation.mutate();
        }
      } else {
        setTestEnded(true);
        completeTestMutation.mutate();
      }
    }
  };
  
  // Handle AI score request
  const handleRequestAIScore = (questionId: number) => {
    const question = questions?.find(q => q.id === questionId);
    const answerText = answers[questionId];
    
    if (question && answerText) {
      // Check if answer meets minimum word count
      const minWords = question.passageIndex === 1 ? 150 : 250;
      const wordCount = wordCounts[questionId] || 0;
      
      if (wordCount < minWords) {
        toast({
          title: "Word Count Too Low",
          description: `Your essay should be at least ${minWords} words to receive AI scoring.`,
          variant: "destructive",
        });
        return;
      }
      
      // Get the answer ID from existing answers
      const answerId = existingAnswers?.find(a => a.questionId === questionId)?.id;
      
      if (!answerId) {
        toast({
          title: "Error",
          description: "Please save your essay first before requesting AI feedback.",
          variant: "destructive",
        });
        return;
      }
      
      setScoringTaskId(questionId);
      setShowAIScoreDialog(true);
      setAiScoreResult(null);
      
      // Trigger AI scoring
      aiScoreMutation.mutate({
        prompt: question.content,
        response: answerText,
        answerId
      });
    }
  };
  
  if (isLoadingTest || isLoadingQuestions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Get questions for task 1 and task 2
  const task1Question = questions?.find(q => q.passageIndex === 1);
  const task2Question = questions?.find(q => q.passageIndex === 2);
  
  // Get minimum word count based on task
  const getMinWords = (taskNum: string) => {
    return taskNum === "1" ? 150 : 250;
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-neutral-bg">
      <div className="bg-white shadow-sm p-4 mb-6">
        <div className="container mx-auto max-w-6xl flex justify-between items-center">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-neutral-text">IELTS Writing Module</h1>
            <p className="text-neutral-dark text-sm md:text-base">
              {test?.title} · Duration: {test?.durationMinutes} minutes
            </p>
          </div>
          <ExamTimer
            initialSeconds={timeLeft || 0}
            onTimeEnd={handleEndTest}
          />
        </div>
      </div>
      
      <div className="container mx-auto max-w-6xl px-4 flex-1">
        <Tabs
          value={activeTask}
          onValueChange={setActiveTask}
          className="mb-6"
        >
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="1">Task 1</TabsTrigger>
            <TabsTrigger value="2">Task 2</TabsTrigger>
          </TabsList>
          
          {/* Task 1 */}
          <TabsContent value="1">
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-lg">Task 1</h2>
                {task1Question && (
                  <TranslationToggle
                    text={task1Question.content}
                    onTranslated={setTranslatedTask1}
                    compact={true}
                  />
                )}
              </div>
              <div className="mb-6">
                <p className="mb-4">You should spend about 20 minutes on this task.</p>
                <p className="font-medium mb-4">Write about the following topic:</p>
                <div className="p-4 bg-neutral-bg rounded-lg mb-4">
                  <p className="text-neutral-text">
                    {translatedTask1 || task1Question?.content}
                  </p>
                </div>
                <p className="mb-2">Write at least 150 words.</p>
              </div>
              
              <div className="p-3 bg-neutral-bg rounded-lg flex items-start">
                <AlertCircle className="h-5 w-5 text-neutral-dark mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-sm text-neutral-dark">Remember to:</p>
                  <ul className="text-sm text-neutral-dark list-disc list-inside mt-1">
                    <li>Include an introduction, body paragraphs, and conclusion</li>
                    <li>Use appropriate academic language</li>
                    <li>Support your points with examples</li>
                    <li>Aim for at least 150 words in your response</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {task1Question && (
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <div>
                  <TextEditor
                    initialContent={answers[task1Question.id] || ""}
                    placeholder="Write your response to Task 1 here..."
                    minWords={getMinWords("1")}
                    onChange={(text) => handleAnswerChange(task1Question.id, text)}
                    onWordCountChange={(count) => handleWordCountChange(task1Question.id, count)}
                  />
                  <div className="flex justify-end mt-4">
                    <Button
                      variant="outline"
                      className="flex items-center"
                      onClick={() => handleRequestAIScore(task1Question.id)}
                      disabled={!answers[task1Question.id] || (wordCounts[task1Question.id] || 0) < getMinWords("1")}
                    >
                      <Brain className="h-4 w-4 mr-2" />
                      Get AI Feedback
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
          
          {/* Task 2 */}
          <TabsContent value="2">
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-lg">Task 2</h2>
                {task2Question && (
                  <TranslationToggle
                    text={task2Question.content}
                    onTranslated={setTranslatedTask2}
                    compact={true}
                  />
                )}
              </div>
              <div className="mb-6">
                <p className="mb-4">You should spend about 40 minutes on this task.</p>
                <p className="font-medium mb-4">Write about the following topic:</p>
                <div className="p-4 bg-neutral-bg rounded-lg mb-4">
                  <p className="text-neutral-text">
                    {translatedTask2 || task2Question?.content}
                  </p>
                </div>
                <p className="mb-2">Write at least 250 words.</p>
              </div>
              
              <div className="p-3 bg-neutral-bg rounded-lg flex items-start">
                <AlertCircle className="h-5 w-5 text-neutral-dark mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-sm text-neutral-dark">Remember to:</p>
                  <ul className="text-sm text-neutral-dark list-disc list-inside mt-1">
                    <li>Plan your response before you start writing</li>
                    <li>Include an introduction, body paragraphs, and conclusion</li>
                    <li>Use specific examples to support your arguments</li>
                    <li>Aim for at least 250 words in your response</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {task2Question && (
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <div>
                  <TextEditor
                    initialContent={answers[task2Question.id] || ""}
                    placeholder="Write your response to Task 2 here..."
                    minWords={getMinWords("2")}
                    onChange={(text) => handleAnswerChange(task2Question.id, text)}
                    onWordCountChange={(count) => handleWordCountChange(task2Question.id, count)}
                  />
                  <div className="flex justify-end mt-4">
                    <Button
                      variant="outline"
                      className="flex items-center"
                      onClick={() => handleRequestAIScore(task2Question.id)}
                      disabled={!answers[task2Question.id] || (wordCounts[task2Question.id] || 0) < getMinWords("2")}
                    >
                      <Brain className="h-4 w-4 mr-2" />
                      Get AI Feedback
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6 mb-12">
          <Button
            variant="outline"
            onClick={() => setActiveTask(activeTask === "2" ? "1" : "2")}
            className="flex items-center"
          >
            {activeTask === "2" ? (
              <>
                <ChevronLeft className="h-5 w-5 mr-1" />
                Task 1
              </>
            ) : (
              <>
                Task 2
                <ChevronRight className="h-5 w-5 ml-1" />
              </>
            )}
          </Button>
          
          <Button
            onClick={handleEndTest}
            className="bg-primary text-white"
            disabled={completeTestMutation.isPending}
          >
            {completeTestMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
              </>
            ) : (
              "Submit Test"
            )}
          </Button>
        </div>
      </div>
      
      {/* AI Score Dialog */}
      <Dialog open={showAIScoreDialog} onOpenChange={setShowAIScoreDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Brain className="h-5 w-5 mr-2 text-primary" />
              AI Writing Assessment
            </DialogTitle>
            <DialogDescription>
              Your essay is being analyzed by artificial intelligence to provide detailed feedback and scoring.
            </DialogDescription>
          </DialogHeader>
          
          {aiScoreMutation.isPending && !aiScoreResult && (
            <div className="py-8 flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-center text-neutral-text">
                Analyzing your writing...
              </p>
              <Progress value={50} className="w-full max-w-md mt-4" />
              <p className="text-sm text-neutral-muted mt-2">
                This may take up to 30 seconds
              </p>
            </div>
          )}
          
          {aiScoreResult && (
            <div className="py-4">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <BadgeCheck className="h-6 w-6 text-primary mr-2" />
                  <h3 className="text-lg font-semibold">Overall Band Score</h3>
                </div>
                <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">
                    {aiScoreResult.overallScore}
                  </span>
                </div>
              </div>
              
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-2">Scoring Breakdown</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(aiScoreResult.criteriaScores || {}).map(([criteria, score]) => (
                    <div key={criteria} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm">{criteria}</span>
                      <div className="flex items-center">
                        <Star className="h-4 w-4 text-amber-500 mr-1" />
                        <span className="font-medium">{score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center">
                  <Info className="h-4 w-4 mr-1 text-neutral-dark" />
                  Detailed Feedback
                </h4>
                <div className="p-4 bg-muted/30 rounded-lg text-sm">
                  <p className="whitespace-pre-line">{aiScoreResult.feedback}</p>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
