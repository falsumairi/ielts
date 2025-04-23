import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Test, Question, QuestionType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ExamTimer from "@/components/ExamTimer";
import AudioRecorder from "@/components/AudioRecorder";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Brain, 
  BadgeCheck, 
  Star, 
  Info,
  Sparkles
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
import TranslationToggle from "@/components/TranslationToggle";

export default function SpeakingTest() {
  const { id } = useParams<{ id: string }>();
  const testId = parseInt(id);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  // Get attempt ID from URL
  const searchParams = new URLSearchParams(window.location.search);
  const attemptId = parseInt(searchParams.get("attempt") || "0");
  
  // Component state
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<{[key: number]: {blob: Blob, url: string}}>({});
  const [preparationNotes, setPreparationNotes] = useState("");
  const [isPreparing, setIsPreparing] = useState(true);
  const [preparationTimeLeft, setPreparationTimeLeft] = useState<number | null>(null);
  const [responseTimeLeft, setResponseTimeLeft] = useState<number | null>(null);
  const [testEnded, setTestEnded] = useState(false);

  // Translation state
  const [translatedPrompt, setTranslatedPrompt] = useState<string | null>(null);
  
  // AI Scoring state
  const [showAIScoreDialog, setShowAIScoreDialog] = useState(false);
  const [scoringQuestionId, setScoringQuestionId] = useState<number | null>(null);
  const [transcription, setTranscription] = useState<string>("");
  const [aiScoreResult, setAiScoreResult] = useState<any>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
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
  
  // Fetch questions (speaking tasks) with randomization
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
  
  // Set preparation time and response time
  useEffect(() => {
    if (!preparationTimeLeft && currentPartIndex === 0) {
      setPreparationTimeLeft(60); // 1 minute prep for part 1
    } else if (!preparationTimeLeft && currentPartIndex === 1) {
      setPreparationTimeLeft(60); // 1 minute prep for part 2
    } else if (!preparationTimeLeft && currentPartIndex === 2) {
      setPreparationTimeLeft(30); // 30 seconds prep for part 3
    }
    
    if (!responseTimeLeft && currentPartIndex === 0) {
      setResponseTimeLeft(120); // 2 minutes for part 1
    } else if (!responseTimeLeft && currentPartIndex === 1) {
      setResponseTimeLeft(120); // 2 minutes for part 2
    } else if (!responseTimeLeft && currentPartIndex === 2) {
      setResponseTimeLeft(120); // 2 minutes for part 3
    }
  }, [currentPartIndex, preparationTimeLeft, responseTimeLeft]);
  
  // Submit answer (audio) mutation
  const submitAnswerMutation = useMutation({
    mutationFn: async ({ questionId, answer, audioUrl }: { questionId: number; answer: string; audioUrl: string }) => {
      const res = await apiRequest("POST", `/api/attempts/${attemptId}/answers`, {
        questionId,
        answer,
        audioPath: audioUrl,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attempts", attemptId, "answers"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to submit recording",
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
        description: "Your speaking recordings have been submitted",
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
  
  // Transcribe audio mutation
  const transcribeAudioMutation = useMutation({
    mutationFn: async (audioUrl: string) => {
      setIsTranscribing(true);
      
      // Convert audio URL to blob
      const response = await fetch(audioUrl);
      const audioBlob = await response.blob();
      
      // Create FormData and append the audio blob
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      
      // Send to backend for transcription
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error('Failed to transcribe audio');
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      setTranscription(data.transcription);
      setIsTranscribing(false);
      
      // After successful transcription, proceed to AI scoring if we have a valid question ID
      if (scoringQuestionId !== null && currentQuestion) {
        aiScoreMutation.mutate({
          questionId: scoringQuestionId,
          transcription: data.transcription,
          prompt: currentQuestion.content
        });
      }
    },
    onError: (error) => {
      setIsTranscribing(false);
      toast({
        title: "Transcription Error",
        description: "Could not transcribe your audio. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // AI Score mutation
  const aiScoreMutation = useMutation({
    mutationFn: async ({ 
      questionId, 
      transcription, 
      prompt 
    }: { 
      questionId: number; 
      transcription: string; 
      prompt: string; 
    }) => {
      const res = await apiRequest("POST", "/api/speaking/score", {
        questionId,
        transcription,
        prompt
      });
      
      if (!res.ok) {
        throw new Error("Failed to generate AI score");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      setAiScoreResult(data);
      
      // Update the answer with AI feedback
      if (scoringQuestionId && data) {
        apiRequest("PATCH", `/api/attempts/${attemptId}/answers/${scoringQuestionId}`, {
          score: data.overallScore,
          feedback: data.feedback,
          isCorrect: true
        });
      }
    },
    onError: (error) => {
      toast({
        title: "AI Scoring Error",
        description: "Could not generate AI score. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Handle preparation end
  const handlePreparationEnd = () => {
    setIsPreparing(false);
  };
  
  // Handle recording complete
  const handleRecordingComplete = (blob: Blob, url: string) => {
    if (!questions || questions.length === 0 || currentPartIndex >= questions.length) return;
    
    const question = questions[currentPartIndex];
    if (!question) return;
    
    setRecordedAudio(prev => ({
      ...prev,
      [question.id]: { blob, url }
    }));
    
    // Answer text will be "AUDIO_RESPONSE" to indicate audio response
    submitAnswerMutation.mutate({ 
      questionId: question.id, 
      answer: "AUDIO_RESPONSE", 
      audioUrl: url 
    });
  };
  
  // Handle move to next part
  const handleNextPart = () => {
    if (currentPartIndex < (questions?.length || 0) - 1) {
      setCurrentPartIndex(currentPartIndex + 1);
      setIsPreparing(true);
      setPreparationTimeLeft(null);
      setResponseTimeLeft(null);
      setPreparationNotes("");
    } else {
      // Submit the test if all parts are completed
      handleEndTest();
    }
  };
  
  // Handle test end
  const handleEndTest = () => {
    setTestEnded(true);
    completeTestMutation.mutate();
  };
  
  // Handle request for AI feedback
  const handleRequestAIFeedback = (questionId: number) => {
    // Reset state
    setAiScoreResult(null);
    setTranscription("");
    setScoringQuestionId(questionId);
    setShowAIScoreDialog(true);
    
    // Get the audio recording
    const audio = recordedAudio[questionId];
    if (audio && audio.url) {
      // Start transcription
      transcribeAudioMutation.mutate(audio.url);
    } else {
      toast({
        title: "Error",
        description: "No recording found for this task",
        variant: "destructive",
      });
      setShowAIScoreDialog(false);
    }
  };
  
  if (isLoadingTest || isLoadingQuestions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Get current question (task)
  const currentQuestion = questions?.[currentPartIndex];
  
  // Determine part title
  const getPartTitle = () => {
    switch (currentPartIndex) {
      case 0: return "Part 1: Introduction and Interview";
      case 1: return "Part 2: Individual Long Turn";
      case 2: return "Part 3: Two-Way Discussion";
      default: return "IELTS Speaking";
    }
  };
  
  // Determine max duration based on part
  const getMaxDuration = () => {
    switch (currentPartIndex) {
      case 0: return 120; // 2 minutes
      case 1: return 120; // 2 minutes
      case 2: return 120; // 2 minutes
      default: return 120;
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-neutral-bg">
      <div className="bg-white shadow-sm p-4 mb-6">
        <div className="container mx-auto max-w-6xl flex justify-between items-center">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-neutral-text">IELTS Speaking Module</h1>
            <p className="text-neutral-dark text-sm md:text-base">
              {test?.title} · {getPartTitle()}
            </p>
          </div>
          <ExamTimer
            initialSeconds={isPreparing ? (preparationTimeLeft || 60) : (responseTimeLeft || 120)}
            onTimeEnd={isPreparing ? handlePreparationEnd : handleNextPart}
          />
        </div>
      </div>
      
      <div className="container mx-auto max-w-6xl px-4 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Task Card */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">Task Card</h2>
              {currentQuestion && (
                <TranslationToggle
                  text={currentQuestion.content}
                  onTranslated={setTranslatedPrompt}
                  compact={true}
                />
              )}
            </div>
            <div className="border border-amber-200 p-4 rounded-lg bg-amber-50">
              <p className="font-medium mb-3">{translatedPrompt || currentQuestion?.content}</p>
              
              {currentPartIndex === 1 && (
                <div className="mb-2">
                  <p className="mb-2">You should say:</p>
                  <ul className="list-disc list-inside space-y-2 mb-4 text-neutral-dark">
                    {currentQuestion?.content.includes("Where") && <li>Where the place is</li>}
                    {currentQuestion?.content.includes("When") && <li>When you visited this place</li>}
                    {currentQuestion?.content.includes("What") && <li>What you did there</li>}
                    {currentQuestion?.content.includes("why") && <li>And explain why you found this place interesting</li>}
                  </ul>
                </div>
              )}
              
              <p className="text-sm text-neutral-dark">
                {isPreparing 
                  ? `You have ${Math.ceil((preparationTimeLeft || 0) / 60)} minute${(preparationTimeLeft || 0) > 60 ? 's' : ''} to prepare` 
                  : `You have ${Math.ceil((responseTimeLeft || 0) / 60)} minute${(responseTimeLeft || 0) > 60 ? 's' : ''} to speak`}
              </p>
            </div>
            
            {/* Preparation Notes */}
            <div className="mt-6">
              <h3 className="font-medium mb-2">
                Preparation Notes {isPreparing ? `(${Math.ceil((preparationTimeLeft || 0) / 60)} minute${(preparationTimeLeft || 0) > 60 ? 's' : ''})` : ""}
              </h3>
              <Textarea
                className="w-full h-40 p-3 border border-neutral-300 rounded-md"
                placeholder="Take notes to prepare your response..."
                value={preparationNotes}
                onChange={(e) => setPreparationNotes(e.target.value)}
                disabled={!isPreparing}
              />
            </div>
            
            {isPreparing && (
              <Button 
                className="w-full mt-4"
                onClick={handlePreparationEnd}
              >
                I'm ready to start speaking
              </Button>
            )}
          </div>
          
          {/* Recording Interface */}
          <div className={`transition-opacity duration-300 ${isPreparing ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            <AudioRecorder
              onRecordingComplete={handleRecordingComplete}
              maxDuration={getMaxDuration()}
            />
            
            {!isPreparing && recordedAudio[currentQuestion?.id || 0] && (
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  className="flex items-center"
                  onClick={() => currentQuestion && handleRequestAIFeedback(currentQuestion.id)}
                >
                  <Brain className="h-4 w-4 mr-2" />
                  Get AI Feedback
                </Button>
              </div>
            )}
          </div>
        </div>
        
        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6 mb-12">
          <Button
            variant="outline"
            onClick={() => {
              if (currentPartIndex > 0) {
                setCurrentPartIndex(currentPartIndex - 1);
                setIsPreparing(true);
                setPreparationTimeLeft(null);
                setResponseTimeLeft(null);
                setPreparationNotes("");
              }
            }}
            disabled={currentPartIndex === 0 || isPreparing}
            className="flex items-center"
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Previous Task
          </Button>
          
          <Button
            onClick={handleNextPart}
            className="bg-primary text-white flex items-center"
            disabled={isPreparing || !recordedAudio[currentQuestion?.id || 0]}
          >
            {currentPartIndex < (questions?.length || 0) - 1 ? (
              <>
                Next Task
                <ChevronRight className="h-5 w-5 ml-1" />
              </>
            ) : (
              completeTestMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                </>
              ) : (
                "Submit All Recordings"
              )
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
              AI Speaking Assessment
            </DialogTitle>
            <DialogDescription>
              Your speaking response is being analyzed by artificial intelligence to provide detailed feedback and scoring.
            </DialogDescription>
          </DialogHeader>
          
          {/* Processing State */}
          {(isTranscribing || aiScoreMutation.isPending) && !aiScoreResult && (
            <div className="py-8 flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-center text-neutral-text">
                {isTranscribing ? "Transcribing your speech..." : "Analyzing your speaking skills..."}
              </p>
              <Progress value={isTranscribing ? 30 : 70} className="w-full max-w-md mt-4" />
              <p className="text-sm text-neutral-muted mt-2">
                This may take up to 30 seconds
              </p>
            </div>
          )}
          
          {/* Transcription Result */}
          {transcription && !aiScoreResult && (
            <div className="py-4">
              <h3 className="text-sm font-medium mb-2 flex items-center">
                <Sparkles className="h-4 w-4 mr-1 text-amber-500" />
                Transcribed Speech
              </h3>
              <div className="p-4 bg-muted/30 rounded-lg text-sm mb-4">
                <p className="italic">{transcription}</p>
              </div>
            </div>
          )}
          
          {/* AI Score Result */}
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
