import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Vocabulary } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, ArrowLeft, ThumbsUp, ThumbsDown, HelpCircle, Book } from "lucide-react";

export default function VocabularyReview() {
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewCompleted, setReviewCompleted] = useState(false);
  
  // Fetch vocabulary items due for review
  const { 
    data: reviewItems = [], 
    isLoading, 
    isError 
  } = useQuery({
    queryKey: ["/api/vocabulary/review"],
    retry: 1,
  });
  
  // Reset state when new words are loaded
  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setReviewCompleted(false);
  }, [reviewItems]);
  
  // Update review status mutation
  const updateReviewStatusMutation = useMutation({
    mutationFn: async ({ id, knowledgeRating }: { id: number; knowledgeRating: number }) => {
      const response = await apiRequest("PATCH", `/api/vocabulary/${id}/review`, { knowledgeRating });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update review status");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vocabulary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vocabulary/review"] });
      
      // Move to next word or end review if done
      const nextIndex = currentIndex + 1;
      if (nextIndex >= reviewItems.length) {
        setReviewCompleted(true);
      } else {
        setCurrentIndex(nextIndex);
        setIsFlipped(false);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Get CEFR level badge color
  const getCefrLevelColor = (level: string) => {
    switch (level) {
      case "A1": return "bg-green-200 text-green-800";
      case "A2": return "bg-green-300 text-green-800";
      case "B1": return "bg-blue-200 text-blue-800";
      case "B2": return "bg-blue-300 text-blue-800";
      case "C1": return "bg-purple-200 text-purple-800";
      case "C2": return "bg-purple-300 text-purple-800";
      default: return "bg-gray-200 text-gray-800";
    }
  };
  
  // Handle knowledge rating submission
  const handleRating = (rating: number) => {
    if (reviewItems.length === 0 || currentIndex >= reviewItems.length) return;
    
    const currentWord = reviewItems[currentIndex];
    updateReviewStatusMutation.mutate({ id: currentWord.id, knowledgeRating: rating });
  };
  
  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto py-8 flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }
  
  if (isError) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Error</h2>
            <p className="text-destructive mb-4">Failed to load vocabulary review items.</p>
            <Button asChild>
              <Link href="/vocabulary">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Vocabulary
              </Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }
  
  if (reviewItems.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Vocabulary Review</h1>
            <Card className="max-w-md mx-auto">
              <CardHeader>
                <Book className="h-12 w-12 mx-auto text-primary" />
              </CardHeader>
              <CardContent>
                <h2 className="text-xl font-medium text-center mb-4">No words to review</h2>
                <p className="text-muted-foreground mb-4">
                  You don't have any vocabulary words due for review right now. Check back later or add more words.
                </p>
              </CardContent>
              <CardFooter className="flex justify-center">
                <Button asChild>
                  <Link href="/vocabulary">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Vocabulary
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }
  
  if (reviewCompleted) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Review Completed!</h1>
            <Card className="max-w-md mx-auto">
              <CardHeader>
                <ThumbsUp className="h-12 w-12 mx-auto text-primary" />
              </CardHeader>
              <CardContent>
                <h2 className="text-xl font-medium text-center mb-4">Great job!</h2>
                <p className="text-muted-foreground mb-4">
                  You've completed your vocabulary review session. Keep up the good work!
                </p>
                <div className="mb-4">
                  <p className="text-sm mb-2">Words reviewed: {reviewItems.length}</p>
                  <Progress value={100} className="h-2" />
                </div>
              </CardContent>
              <CardFooter className="flex justify-center space-x-3">
                <Button asChild variant="outline">
                  <Link href="/vocabulary">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Vocabulary
                  </Link>
                </Button>
                <Button onClick={() => window.location.reload()}>
                  Start New Session
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }
  
  const currentWord = reviewItems[currentIndex];
  
  return (
    <Layout>
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Vocabulary Review</h1>
          <Button variant="outline" size="sm" asChild>
            <Link href="/vocabulary">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Vocabulary
            </Link>
          </Button>
        </div>
        
        <div className="mb-4">
          <Progress value={(currentIndex / reviewItems.length) * 100} className="h-2" />
          <div className="flex justify-between text-sm text-muted-foreground mt-1">
            <span>Progress</span>
            <span>{currentIndex + 1} of {reviewItems.length}</span>
          </div>
        </div>
        
        <div className="max-w-2xl mx-auto">
          <Card className={`mb-6 transition-all duration-500 ${isFlipped ? 'bg-muted/20' : ''}`}>
            <CardHeader className="text-center">
              <div className="mb-2 flex justify-center space-x-2">
                <Badge className={getCefrLevelColor(currentWord.cefrLevel)}>
                  {currentWord.cefrLevel}
                </Badge>
              </div>
              <h2 className="text-3xl font-bold tracking-tight">{currentWord.word}</h2>
              {currentWord.wordFamily && (
                <p className="text-muted-foreground text-sm">
                  Word family: {currentWord.wordFamily}
                </p>
              )}
            </CardHeader>
            <CardContent className="text-center">
              {!isFlipped ? (
                <div className="flex flex-col items-center justify-center h-40">
                  <p className="text-lg">Do you know this word?</p>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsFlipped(true)}
                    className="mt-4"
                  >
                    <HelpCircle className="mr-2 h-4 w-4" />
                    Show Meaning
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Meaning:</h3>
                    <p className="text-lg">{currentWord.meaning}</p>
                  </div>
                  {currentWord.arabicMeaning && (
                    <div>
                      <h3 className="text-sm font-medium">Arabic:</h3>
                      <p className="text-lg">{currentWord.arabicMeaning}</p>
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-medium">Example:</h3>
                    <p className="italic">{currentWord.example}</p>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-center">
              {isFlipped && (
                <div className="space-x-2">
                  <p className="text-sm mb-3 text-center">How well did you know this word?</p>
                  <div className="flex justify-center space-x-2">
                    <Button 
                      variant="outline" 
                      className="border-red-400 text-red-500 hover:bg-red-100/50 hover:text-red-600"
                      onClick={() => handleRating(1)}
                      disabled={updateReviewStatusMutation.isPending}
                    >
                      <ThumbsDown className="mr-2 h-4 w-4" />
                      Didn't Know
                    </Button>
                    <Button 
                      variant="outline"
                      className="border-amber-400 text-amber-500 hover:bg-amber-100/50 hover:text-amber-600"
                      onClick={() => handleRating(3)}
                      disabled={updateReviewStatusMutation.isPending}
                    >
                      Partially Knew
                    </Button>
                    <Button 
                      variant="outline"
                      className="border-green-400 text-green-500 hover:bg-green-100/50 hover:text-green-600"
                      onClick={() => handleRating(5)}
                      disabled={updateReviewStatusMutation.isPending}
                    >
                      <ThumbsUp className="mr-2 h-4 w-4" />
                      Knew Well
                    </Button>
                  </div>
                </div>
              )}
              {updateReviewStatusMutation.isPending && (
                <div className="flex justify-center items-center mt-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </Layout>
  );
}