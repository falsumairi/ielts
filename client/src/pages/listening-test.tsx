import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Test, Question, QuestionType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ExamTimer from "@/components/ExamTimer";
import ProgressIndicator from "@/components/ProgressIndicator";
import AudioPlayer from "@/components/AudioPlayer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle } from "lucide-react";

export default function ListeningTest() {
  const { id } = useParams<{ id: string }>();
  const testId = parseInt(id);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Get attempt ID from URL
  const searchParams = new URLSearchParams(window.location.search);
  const attemptId = parseInt(searchParams.get("attempt") || "0");

  // Component state
  const [currentSection, setCurrentSection] = useState(1);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [audioFinished, setAudioFinished] = useState(false);
  const [testEnded, setTestEnded] = useState(false);

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
        description: "Your answers have been submitted",
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

  // Handle answer change
  const handleAnswerChange = (questionId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    submitAnswerMutation.mutate({ questionId, answer: value });
  };

  // Handle test end (time up or manual submission)
  const handleEndTest = () => {
    setTestEnded(true);
    completeTestMutation.mutate();
  };

  // Handle audio completion
  const handleAudioComplete = () => {
    setAudioFinished(true);
    toast({
      title: "Audio completed",
      description: "You can now answer all questions for this section.",
    });
  };

  // Get questions for the current section
  const filteredQuestions = questions?.filter(q => q.passageIndex === currentSection) || [];

  // Calculate progress
  const answeredQuestions = Object.keys(answers).length;
  const totalQuestions = questions?.length || 0;
  const progress = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;

  // Organize sections and question counts for progress display
  const sectionProgress = Array.from({ length: 4 }, (_, i) => i + 1).map(section => {
    const questionsForSection = questions?.filter(q => q.passageIndex === section) || [];
    const answeredForSection = questionsForSection.filter(q => !!answers[q.id]).length;
    return {
      index: section,
      answered: answeredForSection,
      total: questionsForSection.length,
    };
  });

  if (isLoadingTest || isLoadingQuestions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Find the audio file for the current section
  const audioQuestion = filteredQuestions.find(q => q.audioPath);
  const audioPath = audioQuestion?.audioPath;

  return (
    <div className="min-h-screen flex flex-col bg-neutral-bg">
      <div className="bg-white shadow-sm p-4 mb-6">
        <div className="container mx-auto max-w-6xl flex justify-between items-center">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-neutral-text">IELTS Listening Module</h1>
            <p className="text-neutral-dark text-sm md:text-base">
              {test?.title} · Section {currentSection} · Duration: {test?.durationMinutes} minutes
            </p>
          </div>
          <ExamTimer
            initialSeconds={timeLeft || 0}
            onTimeEnd={handleEndTest}
          />
        </div>
      </div>
      
      <div className="container mx-auto max-w-6xl px-4 mb-6">
        <ProgressIndicator
          progress={progress}
          answered={answeredQuestions}
          total={totalQuestions}
          passageProgress={sectionProgress}
        />
      </div>
      
      <div className="container mx-auto max-w-6xl px-4 flex-1">
        {/* Audio Player */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <h2 className="font-bold text-lg mb-3">Section {currentSection}: Listening Activity</h2>
          
          {audioPath ? (
            <div className="mb-4">
              <AudioPlayer 
                audioUrl={audioPath} 
                allowReplay={false} 
                onComplete={handleAudioComplete}
              />
              
              <div className="mt-4 p-3 bg-amber-50 rounded-lg flex items-start border border-amber-200">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-sm text-neutral-dark">
                  Listen carefully as you can only play this audio once. Take notes below to help you answer the questions.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-neutral-bg p-4 rounded-md mb-4 text-center">
              <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto mb-2" />
              <p>Audio file not available for this section.</p>
            </div>
          )}
          
          {/* Note Taking Area */}
          <div className="mt-6">
            <h3 className="font-medium text-base mb-3">Notes</h3>
            <Textarea
              className="w-full h-24 p-3 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              placeholder="Take notes while listening to help answer questions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        
        {/* Questions */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <h2 className="font-bold text-lg mb-4">Section {currentSection} Questions</h2>
          
          {!audioFinished && (
            <div className="bg-neutral-bg p-4 rounded-md mb-4">
              <p className="text-center">Please listen to the audio first to access all questions.</p>
            </div>
          )}
          
          <div className={`space-y-8 ${!audioFinished ? 'opacity-60 pointer-events-none' : ''}`}>
            {filteredQuestions.map((question, index) => (
              <div key={question.id}>
                <div className="mb-2">
                  <span className="inline-block bg-primary text-white text-xs px-2 py-1 rounded font-medium mr-2">
                    Question {index + 1}
                  </span>
                  <span className="text-xs text-neutral-dark">
                    {question.type === QuestionType.FILL_BLANK ? "Fill in the Blank" : 
                     question.type === QuestionType.MULTIPLE_CHOICE ? "Multiple Choice" : 
                     "Answer Question"}
                  </span>
                </div>
                
                <p className="text-neutral-text mb-3">{question.content}</p>
                
                {question.type === QuestionType.MULTIPLE_CHOICE && Array.isArray(question.options) && (
                  <div className="space-y-2">
                    {question.options.map((option, i) => (
                      <div key={i} className="flex items-start p-2 rounded hover:bg-neutral-bg cursor-pointer">
                        <input
                          type="radio"
                          id={`q${question.id}-${i}`}
                          name={`q${question.id}`}
                          className="mt-1 mr-3"
                          checked={answers[question.id] === option}
                          onChange={() => handleAnswerChange(question.id, option)}
                        />
                        <Label htmlFor={`q${question.id}-${i}`} className="cursor-pointer">
                          {option}
                        </Label>
                      </div>
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
              </div>
            ))}
          </div>
        </div>
        
        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6 mb-12">
          <Button
            variant="outline"
            onClick={() => {
              if (currentSection > 1) {
                setCurrentSection(currentSection - 1);
                setAudioFinished(false); // Reset for new section
              }
            }}
            disabled={currentSection === 1}
            className="flex items-center"
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Previous Section
          </Button>
          
          {currentSection < 4 ? (
            <Button
              onClick={() => {
                setCurrentSection(currentSection + 1);
                setAudioFinished(false); // Reset for new section
              }}
              className="flex items-center"
            >
              Next Section
              <ChevronRight className="h-5 w-5 ml-1" />
            </Button>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
