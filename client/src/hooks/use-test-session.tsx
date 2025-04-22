import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from './use-toast';
import { useLocation } from 'wouter';

export type TestSession = {
  id: number;
  testId: number;
  status: 'not_started' | 'in_progress' | 'paused' | 'completed' | 'timed_out';
  timeRemaining: number;
  answers: any[]; // Will be replaced with proper type
  currentQuestionIndex: number;
  testStartTime?: Date;
  testEndTime?: Date;
};

export function useTestSession(testId: number) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<TestSession | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch active test session or create new one
  const { data: sessionData, isLoading, error } = useQuery({
    queryKey: ['/api/attempts/active', testId],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', `/api/attempts/active?testId=${testId}`);
        return await res.json();
      } catch (error) {
        // If no active session, return null
        return null;
      }
    },
    refetchOnWindowFocus: false,
    staleTime: 30000, // 30 seconds
  });

  // Create a new session
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/attempts', {
        testId,
        userId: user?.id,
        status: 'in_progress',
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setSession({
        id: data.id,
        testId,
        status: data.status,
        timeRemaining: data.testDuration * 60, // Convert minutes to seconds
        answers: [],
        currentQuestionIndex: 0,
        testStartTime: new Date(),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/attempts/active', testId] });
      toast({
        title: 'Test session started',
        description: 'Your test session has been started.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to start test',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update session status (in_progress, paused, completed, timed_out)
  const updateSessionStatusMutation = useMutation({
    mutationFn: async ({ status, endTime }: { status: string; endTime?: Date }) => {
      if (!session) throw new Error('No active session');
      
      const res = await apiRequest('PATCH', `/api/attempts/${session.id}/status`, {
        status,
        endTime: endTime?.toISOString(),
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setSession(prev => prev ? { ...prev, status: data.status, testEndTime: data.endTime } : null);
      queryClient.invalidateQueries({ queryKey: ['/api/attempts/active', testId] });
      
      if (data.status === 'completed' || data.status === 'timed_out') {
        setLocation('/results');
        toast({
          title: data.status === 'completed' ? 'Test completed' : 'Time\'s up!',
          description: data.status === 'completed' 
            ? 'Your test has been submitted successfully.' 
            : 'Your test time has expired and answers have been submitted.',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update test status',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Save current answer
  const saveAnswerMutation = useMutation({
    mutationFn: async ({ questionId, answer, audioPath }: { questionId: number; answer: string; audioPath?: string }) => {
      if (!session) throw new Error('No active session');
      
      const res = await apiRequest('POST', '/api/answers', {
        attemptId: session.id,
        questionId,
        answer,
        audioPath,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setSession(prev => {
        if (!prev) return null;
        
        // Find if we already have an answer for this question
        const existingAnswerIndex = prev.answers.findIndex(
          a => a.questionId === data.questionId
        );
        
        let updatedAnswers;
        if (existingAnswerIndex >= 0) {
          // Update existing answer
          updatedAnswers = [...prev.answers];
          updatedAnswers[existingAnswerIndex] = data;
        } else {
          // Add new answer
          updatedAnswers = [...prev.answers, data];
        }
        
        return {
          ...prev,
          answers: updatedAnswers,
        };
      });
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to save answer',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Auto-save answers periodically if there are changes
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (hasChanges && session?.status === 'in_progress') {
        // Implement auto-save logic here
        // This would use the saveAnswerMutation with the current unsaved answers
        setHasChanges(false);
      }
    }, 30000); // Auto-save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [hasChanges, session]);

  // Update session from fetched data
  useEffect(() => {
    if (sessionData) {
      setSession({
        id: sessionData.id,
        testId: sessionData.testId,
        status: sessionData.status,
        timeRemaining: sessionData.timeRemaining || (sessionData.testDuration * 60),
        answers: sessionData.answers || [],
        currentQuestionIndex: sessionData.currentQuestionIndex || 0,
        testStartTime: sessionData.startTime ? new Date(sessionData.startTime) : undefined,
        testEndTime: sessionData.endTime ? new Date(sessionData.endTime) : undefined,
      });
    }
  }, [sessionData]);

  // Start a new test session
  const startSession = useCallback(() => {
    createSessionMutation.mutate();
  }, [createSessionMutation]);

  // Update remaining time
  const updateTimeRemaining = useCallback((seconds: number) => {
    setSession(prev => prev ? { ...prev, timeRemaining: seconds } : null);
  }, []);

  // Handle timer end
  const handleTimeEnd = useCallback(() => {
    if (session?.status !== 'in_progress') return;
    
    updateSessionStatusMutation.mutate({
      status: 'timed_out',
      endTime: new Date(),
    });
  }, [session, updateSessionStatusMutation]);

  // Pause the session
  const pauseSession = useCallback(() => {
    if (session?.status !== 'in_progress') return;
    
    updateSessionStatusMutation.mutate({
      status: 'paused',
    });
  }, [session, updateSessionStatusMutation]);

  // Resume the session
  const resumeSession = useCallback(() => {
    if (session?.status !== 'paused') return;
    
    updateSessionStatusMutation.mutate({
      status: 'in_progress',
    });
  }, [session, updateSessionStatusMutation]);

  // Complete the session (submit the test)
  const completeSession = useCallback(() => {
    if (!session || session.status === 'completed') return;
    
    updateSessionStatusMutation.mutate({
      status: 'completed',
      endTime: new Date(),
    });
  }, [session, updateSessionStatusMutation]);

  // Save an answer
  const saveAnswer = useCallback((questionId: number, answer: string, audioPath?: string) => {
    saveAnswerMutation.mutate({ questionId, answer, audioPath });
    setHasChanges(true);
  }, [saveAnswerMutation]);

  // Navigate to next question
  const goToNextQuestion = useCallback(() => {
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        currentQuestionIndex: Math.min(prev.currentQuestionIndex + 1, prev.answers.length),
      };
    });
  }, []);

  // Navigate to previous question
  const goToPreviousQuestion = useCallback(() => {
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        currentQuestionIndex: Math.max(prev.currentQuestionIndex - 1, 0),
      };
    });
  }, []);

  // Navigate to specific question
  const goToQuestion = useCallback((index: number) => {
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        currentQuestionIndex: Math.max(0, Math.min(index, prev.answers.length)),
      };
    });
  }, []);

  return {
    session,
    isLoading,
    error,
    startSession,
    pauseSession,
    resumeSession,
    completeSession,
    saveAnswer,
    updateTimeRemaining,
    handleTimeEnd,
    goToNextQuestion,
    goToPreviousQuestion,
    goToQuestion,
  };
}