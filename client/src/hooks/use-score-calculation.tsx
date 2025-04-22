import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from './use-toast';
import { QuestionType } from '@shared/schema';

// Scoring bands for IELTS
const IELTS_SCORE_BANDS = [
  { min: 39, max: 40, band: 9.0 },   // 39-40 correct answers: Band 9
  { min: 37, max: 38, band: 8.5 },   // 37-38 correct answers: Band 8.5
  { min: 35, max: 36, band: 8.0 },   // 35-36 correct answers: Band 8
  { min: 33, max: 34, band: 7.5 },   // 33-34 correct answers: Band 7.5
  { min: 30, max: 32, band: 7.0 },   // 30-32 correct answers: Band 7
  { min: 27, max: 29, band: 6.5 },   // 27-29 correct answers: Band 6.5
  { min: 23, max: 26, band: 6.0 },   // 23-26 correct answers: Band 6
  { min: 20, max: 22, band: 5.5 },   // 20-22 correct answers: Band 5.5
  { min: 16, max: 19, band: 5.0 },   // 16-19 correct answers: Band 5
  { min: 13, max: 15, band: 4.5 },   // 13-15 correct answers: Band 4.5
  { min: 10, max: 12, band: 4.0 },   // 10-12 correct answers: Band 4
  { min: 8, max: 9, band: 3.5 },     // 8-9 correct answers: Band 3.5
  { min: 6, max: 7, band: 3.0 },     // 6-7 correct answers: Band 3
  { min: 4, max: 5, band: 2.5 },     // 4-5 correct answers: Band 2.5
  { min: 2, max: 3, band: 2.0 },     // 2-3 correct answers: Band 2
  { min: 1, max: 1, band: 1.0 },     // 1 correct answer: Band 1
  { min: 0, max: 0, band: 0.0 }      // 0 correct answers: Band 0
];

// Writing/Speaking assessment criteria
export const WRITING_CRITERIA = [
  { name: 'Task Achievement', description: 'How well the task requirements are addressed' },
  { name: 'Coherence and Cohesion', description: 'How well organized and logical the response is' },
  { name: 'Lexical Resource', description: 'Range and accuracy of vocabulary use' },
  { name: 'Grammatical Range and Accuracy', description: 'Range and accuracy of grammar' }
];

export const SPEAKING_CRITERIA = [
  { name: 'Fluency and Coherence', description: 'Speaking at a natural pace with good organization of ideas' },
  { name: 'Lexical Resource', description: 'Range and accuracy of vocabulary use' },
  { name: 'Grammatical Range and Accuracy', description: 'Range and accuracy of grammar' },
  { name: 'Pronunciation', description: 'Clear articulation and natural intonation' }
];

interface ScoreCalculationProps {
  attemptId: number;
  moduleType: 'reading' | 'listening' | 'writing' | 'speaking';
}

export function useScoreCalculation({ attemptId, moduleType }: ScoreCalculationProps) {
  const { toast } = useToast();
  const [score, setScore] = useState<number | null>(null);
  const [band, setBand] = useState<number | null>(null);
  const [criteriaScores, setCriteriaScores] = useState<Record<string, number>>({});
  const [isCalculating, setIsCalculating] = useState(false);

  // Fetch attempt answers
  const { data: answers, isLoading: isLoadingAnswers } = useQuery({
    queryKey: ['/api/attempts', attemptId, 'answers'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/attempts/${attemptId}/answers`);
      return await res.json();
    },
    enabled: !!attemptId,
  });

  // Fetch questions for this attempt
  const { data: questions, isLoading: isLoadingQuestions } = useQuery({
    queryKey: ['/api/attempts', attemptId, 'questions'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/attempts/${attemptId}/questions`);
      return await res.json();
    },
    enabled: !!attemptId,
  });

  // Determine the band score based on raw score
  const getBandScore = useCallback((rawScore: number, totalQuestions: number) => {
    // Convert to score out of 40 (standard IELTS)
    const scoreOutOf40 = Math.round((rawScore / totalQuestions) * 40);
    
    // Find the band
    const matchingBand = IELTS_SCORE_BANDS.find(
      band => scoreOutOf40 >= band.min && scoreOutOf40 <= band.max
    );
    
    return matchingBand ? matchingBand.band : 0;
  }, []);

  // Calculate score for automatically-graded modules (reading/listening)
  const calculateAutomaticScore = useCallback(() => {
    if (!answers || !questions) return;
    
    setIsCalculating(true);
    
    try {
      // Count correct answers
      const correctAnswers = answers.filter((answer: any) => answer.isCorrect === true);
      const rawScore = correctAnswers.length;
      const totalQuestions = questions.length;
      
      // Calculate band score
      const bandScore = getBandScore(rawScore, totalQuestions);
      
      setScore(rawScore);
      setBand(bandScore);
      
      setIsCalculating(false);
    } catch (error) {
      console.error('Error calculating score:', error);
      setIsCalculating(false);
      
      toast({
        title: 'Score Calculation Error',
        description: 'There was an error calculating your score.',
        variant: 'destructive',
      });
    }
  }, [answers, questions, getBandScore, toast]);

  // Submit manual score for writing/speaking
  const submitManualScoreMutation = useMutation({
    mutationFn: async (criteriaScores: Record<string, number>) => {
      const res = await apiRequest('POST', `/api/attempts/${attemptId}/score`, {
        moduleType,
        criteriaScores,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setScore(data.totalScore);
      setBand(data.bandScore);
      
      toast({
        title: 'Score Submitted',
        description: 'The evaluation has been submitted successfully.',
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/attempts', attemptId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Score Submission Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update a criteria score (for manual grading)
  const updateCriteriaScore = useCallback((criterionName: string, value: number) => {
    setCriteriaScores(prev => ({ ...prev, [criterionName]: value }));
  }, []);

  // Submit the manual grades for writing/speaking
  const submitManualScore = useCallback(() => {
    const criteria = moduleType === 'writing' ? WRITING_CRITERIA : SPEAKING_CRITERIA;
    
    // Validate that all criteria have been scored
    const isComplete = criteria.every(c => criteriaScores[c.name] !== undefined);
    
    if (!isComplete) {
      toast({
        title: 'Incomplete Evaluation',
        description: 'Please provide a score for all criteria before submitting.',
        variant: 'destructive',
      });
      return;
    }
    
    submitManualScoreMutation.mutate(criteriaScores);
  }, [criteriaScores, moduleType, submitManualScoreMutation, toast]);

  // Get the appropriate criteria for the module type
  const getCriteria = useCallback(() => {
    return moduleType === 'writing' ? WRITING_CRITERIA : SPEAKING_CRITERIA;
  }, [moduleType]);

  // Calculate total score from criteria (for writing/speaking)
  const calculateTotalFromCriteria = useCallback(() => {
    const criteria = getCriteria();
    let total = 0;
    let count = 0;
    
    criteria.forEach(c => {
      const score = criteriaScores[c.name];
      if (score !== undefined) {
        total += score;
        count++;
      }
    });
    
    return count > 0 ? total / count : 0;
  }, [criteriaScores, getCriteria]);

  // Calculate score when data is available
  useEffect(() => {
    if (
      !isLoadingAnswers && 
      !isLoadingQuestions && 
      answers && 
      questions && 
      (moduleType === 'reading' || moduleType === 'listening')
    ) {
      calculateAutomaticScore();
    }
  }, [isLoadingAnswers, isLoadingQuestions, answers, questions, moduleType, calculateAutomaticScore]);

  return {
    score,
    band,
    criteriaScores,
    isCalculating,
    isLoading: isLoadingAnswers || isLoadingQuestions,
    updateCriteriaScore,
    submitManualScore,
    calculateTotalFromCriteria,
    getCriteria,
    isSubmitting: submitManualScoreMutation.isPending,
  };
}