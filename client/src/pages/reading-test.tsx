import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Test, Passage, Question, QuestionType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTestSession } from "@/hooks/use-test-session";
import ExamTimer from "@/components/ExamTimer";
import ProgressIndicator from "@/components/ProgressIndicator";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Loader2, PauseCircle, PlayCircle } from "lucide-react";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

export default function ReadingTest() {
  const { id } = useParams<{ id: string }>();
  const testId = parseInt(id);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  // Component state
  const [activePassageIndex, setActivePassageIndex] = useState(1);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [testEnded, setTestEnded] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  
  // Test session hook for timed sessions
  const {
    session,
    isLoading: isLoadingSession,
    startSession,
    pauseSession,
    resumeSession,
    completeSession,
    saveAnswer,
    updateTimeRemaining,
    handleTimeEnd
  } = useTestSession(testId);
  
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
  
  // Fetch passages
  const { data: passages, isLoading: isLoadingPassages } = useQuery<Passage[]>({
    queryKey: ["/api/tests", testId, "passages"],
    queryFn: async () => {
      const res = await fetch(`/api/tests/${testId}/passages`);
      if (!res.ok) throw new Error("Failed to fetch passages");
      return res.json();
    },
    enabled: !!testId && !isNaN(testId),
  });
  
  // Fetch questions
  const { data: questions, isLoading: isLoadingQuestions } = useQuery<Question[]>({
    queryKey: ["/api/tests", testId, "questions"],
    queryFn: async () => {
      const res = await fetch(`/api/tests/${testId}/questions`);
      if (!res.ok) throw new Error("Failed to fetch questions");
      return res.json();
    },
    enabled: !!testId && !isNaN(testId),
  });
  
  // Initialize session if needed
  useEffect(() => {
    if (test && !session && !isLoadingSession) {
      startSession();
    }
  }, [test, session, isLoadingSession, startSession]);
  
  // Populate answers from session
  useEffect(() => {
    if (session?.answers && questions) {
      const answerMap = session.answers.reduce((acc: Record<number, string>, answer: any) => {
        acc[answer.questionId] = answer.answer;
        return acc;
      }, {});
      setAnswers(answerMap);
    }
  }, [session?.answers, questions]);
  
  // Handle answer change
  const handleAnswerChange = useCallback((questionId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    saveAnswer(questionId, value);
  }, [saveAnswer]);
  
  // Handle test end (time up or manual submission)
  const handleEndTest = useCallback(() => {
    setTestEnded(true);
    completeSession();
  }, [completeSession]);
  
  // Handle timer pause
  const handlePauseTimer = useCallback(() => {
    setShowPauseDialog(true);
    pauseSession();
  }, [pauseSession]);
  
  // Handle timer resume
  const handleResumeTimer = useCallback(() => {
    setShowPauseDialog(false);
    resumeSession();
  }, [resumeSession]);
  
  // Get questions for the current passage
  const filteredQuestions = questions?.filter(q => q.passageIndex === activePassageIndex) || [];
  
  // Calculate progress
  const answeredQuestions = Object.keys(answers).length;
  const totalQuestions = questions?.length || 0;
  const progress = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;
  
  // Organize passages and question counts for progress display
  const passageProgress = passages?.map(passage => {
    const questionsForPassage = questions?.filter(q => q.passageIndex === passage.index) || [];
    const answeredForPassage = questionsForPassage.filter(q => !!answers[q.id]).length;
    return {
      index: passage.index,
      answered: answeredForPassage,
      total: questionsForPassage.length,
    };
  }) || [];
  
  if (isLoadingTest || isLoadingPassages || isLoadingQuestions || isLoadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const currentPassage = passages?.find(p => p.index === activePassageIndex);
  
  return (
    <div className="min-h-screen flex flex-col bg-neutral-bg">
      {/* Pause Dialog */}
      <Dialog open={showPauseDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Test Paused</DialogTitle>
            <DialogDescription>
              Your test has been paused and the timer is stopped. You can return to the test when you're ready.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 p-4 bg-amber-50 border border-amber-100 rounded-md text-amber-700 text-sm">
            <p>Note: The test will remain paused until you resume it. You can close the browser and return later.</p>
          </div>
          <DialogFooter>
            <Button onClick={handleResumeTimer}>
              <PlayCircle className="h-4 w-4 mr-2" />
              Resume Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    
      <div className="bg-white shadow-sm p-4 mb-6">
        <div className="container mx-auto max-w-6xl flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-neutral-text">IELTS Reading Module</h1>
            <p className="text-neutral-dark text-sm md:text-base">
              {test?.title} · Duration: {test?.durationMinutes} minutes
            </p>
          </div>
          <div className="flex space-x-4 items-center">
            {session?.status === 'in_progress' && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handlePauseTimer}
                className="flex items-center"
              >
                <PauseCircle className="h-4 w-4 mr-2" />
                Pause Test
              </Button>
            )}
            {session?.status === 'paused' && (
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleResumeTimer}
                className="flex items-center"
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Resume Test
              </Button>
            )}
            <ExamTimer
              initialSeconds={session?.timeRemaining || 0}
              onTimeEnd={handleTimeEnd}
              allowPause={true}
              showProgress={true}
              onTimeUpdate={updateTimeRemaining}
            />
          </div>
        </div>
      </div>
      
      {session?.status === 'paused' && (
        <div className="container mx-auto max-w-6xl px-4 mb-6">
          <Alert variant="warning">
            <AlertTitle>Test paused</AlertTitle>
            <AlertDescription>
              Your test is currently paused. The timer has stopped. Click "Resume Test" to continue.
            </AlertDescription>
          </Alert>
        </div>
      )}
      
      <div className="container mx-auto max-w-6xl px-4 mb-6">
        <ProgressIndicator
          progress={progress}
          answered={answeredQuestions}
          total={totalQuestions}
          passageProgress={passageProgress}
        />
      </div>
      
      <div className="container mx-auto max-w-6xl px-4 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Passage Content */}
          <div className="lg:col-span-3 bg-white rounded-lg shadow-sm p-4 md:p-6">
            <Tabs
              value={String(activePassageIndex)}
              onValueChange={(value) => setActivePassageIndex(parseInt(value))}
              className="mb-4"
            >
              <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${passages?.length || 1}, 1fr)` }}>
                {passages?.map((passage) => (
                  <TabsTrigger key={passage.id} value={String(passage.index)}>
                    Passage {passage.index}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            
            <h2 className="font-bold text-lg mb-4">{currentPassage?.title}</h2>
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: currentPassage?.content || "" }} />
          </div>
          
          {/* Questions */}
          <div className="lg:col-span-2">
            {filteredQuestions.map((question, index) => (
              <Card key={question.id} className="mb-4">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-2">
                    <span className="inline-block bg-primary text-white text-xs px-2 py-1 rounded font-medium">
                      Question {index + 1}
                    </span>
                    <span className="text-xs text-neutral-dark">
                      {question.type === QuestionType.MULTIPLE_CHOICE
                        ? "Multiple Choice"
                        : question.type === QuestionType.TRUE_FALSE_NG
                        ? "True/False/Not Given"
                        : question.type === QuestionType.FILL_BLANK
                        ? "Fill in the Blank"
                        : question.type === QuestionType.MATCHING
                        ? "Matching"
                        : question.type === QuestionType.SHORT_ANSWER
                        ? "Short Answer"
                        : ""}
                    </span>
                  </div>
                  
                  <p className="text-neutral-text mb-3">{question.content}</p>
                  
                  {question.type === QuestionType.MULTIPLE_CHOICE && (
                    <RadioGroup
                      value={answers[question.id] || ""}
                      onValueChange={(value) => handleAnswerChange(question.id, value)}
                      className="space-y-2"
                    >
                      {Array.isArray(question.options) && 
                        question.options.map((option, i) => (
                          <div key={i} className="flex items-start p-2 rounded hover:bg-neutral-bg cursor-pointer">
                            <RadioGroupItem id={`q${question.id}-${i}`} value={option} className="mt-1 mr-3" />
                            <Label htmlFor={`q${question.id}-${i}`} className="cursor-pointer">{option}</Label>
                          </div>
                        ))}
                    </RadioGroup>
                  )}
                  
                  {question.type === QuestionType.TRUE_FALSE_NG && (
                    <div className="flex space-x-2">
                      {["True", "False", "Not Given"].map((option) => (
                        <Button
                          key={option}
                          variant={answers[question.id] === option ? "default" : "outline"}
                          onClick={() => handleAnswerChange(question.id, option)}
                          className="flex-1"
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  )}
                  
                  {(question.type === QuestionType.FILL_BLANK || question.type === QuestionType.SHORT_ANSWER) && (
                    <Input
                      type="text"
                      value={answers[question.id] || ""}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      placeholder="Enter your answer"
                      className="w-full"
                    />
                  )}
                  
                  {question.type === QuestionType.MATCHING && question.options && typeof question.options === 'object' && 
                   'items' in question.options && Array.isArray(question.options.items) && 
                   'matches' in question.options && Array.isArray(question.options.matches) && (
                    <div className="space-y-4">
                      {question.options.items.map((item: string, i: number) => (
                        <div key={i} className="space-y-2">
                          <p className="font-medium">{item}</p>
                          <select
                            className="w-full p-2 border border-neutral-300 rounded"
                            value={
                              answers[question.id] 
                                ? JSON.parse(answers[question.id])[item] || ""
                                : ""
                            }
                            onChange={(e) => {
                              const currentAnswers = answers[question.id] 
                                ? JSON.parse(answers[question.id]) 
                                : {};
                              const updatedAnswers = {
                                ...currentAnswers,
                                [item]: e.target.value
                              };
                              handleAnswerChange(question.id, JSON.stringify(updatedAnswers));
                            }}
                          >
                            <option value="">Select an option</option>
                            {question.options.matches.map((match: string, j: number) => (
                              <option key={j} value={match}>{match}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            
            {/* Navigation Buttons */}
            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  if (activePassageIndex > 1) {
                    setActivePassageIndex(activePassageIndex - 1);
                  }
                }}
                disabled={activePassageIndex === 1}
                className="flex items-center"
              >
                <ChevronLeft className="h-5 w-5 mr-1" />
                Previous
              </Button>
              
              {activePassageIndex < (passages?.length || 0) ? (
                <Button
                  onClick={() => setActivePassageIndex(activePassageIndex + 1)}
                  className="flex items-center"
                >
                  Next
                  <ChevronRight className="h-5 w-5 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleEndTest}
                  className="bg-primary text-white"
                  disabled={!session || session.status !== 'in_progress'}
                >
                  {!session || session.status !== 'in_progress' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                    </>
                  ) : (
                    "Submit Test"
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
