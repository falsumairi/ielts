import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import Layout from "@/components/layout/Layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Vocabulary } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Plus, Search, X, Book, Languages, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";

// Form schema for adding/editing vocabulary
const vocabularyFormSchema = z.object({
  word: z.string().min(1, { message: "Word is required" }),
  cefrLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"], {
    required_error: "Please select a CEFR level",
  }),
  wordFamily: z.string().optional(),
  meaning: z.string().min(1, { message: "Meaning is required" }),
  example: z.string().min(1, { message: "Example is required" }),
  arabicMeaning: z.string().optional(),
});

type VocabularyFormValues = z.infer<typeof vocabularyFormSchema>;

export default function VocabularyPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showArabic, setShowArabic] = useState(false);
  const [selectedVocabulary, setSelectedVocabulary] = useState<Vocabulary | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [wordToAnalyze, setWordToAnalyze] = useState("");
  
  // Fetch vocabulary items
  const {
    data: vocabularies = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["/api/vocabulary"],
    retry: 1,
  });

  // Form for adding new vocabulary
  const form = useForm<VocabularyFormValues>({
    resolver: zodResolver(vocabularyFormSchema),
    defaultValues: {
      word: "",
      cefrLevel: "B1",
      wordFamily: "",
      meaning: "",
      example: "",
      arabicMeaning: "",
    },
  });

  // Form for editing vocabulary
  const editForm = useForm<VocabularyFormValues>({
    resolver: zodResolver(vocabularyFormSchema),
    defaultValues: {
      word: "",
      cefrLevel: "B1",
      wordFamily: "",
      meaning: "",
      example: "",
      arabicMeaning: "",
    },
  });

  // Add vocabulary mutation
  const addVocabularyMutation = useMutation({
    mutationFn: async (values: VocabularyFormValues) => {
      const response = await apiRequest("POST", "/api/vocabulary", values);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add vocabulary");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vocabulary"] });
      setIsAddDialogOpen(false);
      form.reset();
      toast({
        title: "Vocabulary Added",
        description: "New vocabulary item added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Edit vocabulary mutation
  const editVocabularyMutation = useMutation({
    mutationFn: async (values: VocabularyFormValues & { id: number }) => {
      const { id, ...data } = values;
      const response = await apiRequest("PUT", `/api/vocabulary/${id}`, data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to edit vocabulary");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vocabulary"] });
      setIsEditDialogOpen(false);
      editForm.reset();
      setSelectedVocabulary(null);
      toast({
        title: "Vocabulary Updated",
        description: "Vocabulary item updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete vocabulary mutation
  const deleteVocabularyMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/vocabulary/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete vocabulary");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vocabulary"] });
      setIsDeleteDialogOpen(false);
      setSelectedVocabulary(null);
      toast({
        title: "Vocabulary Deleted",
        description: "Vocabulary item deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Analyze word with OpenAI mutation
  const analyzeWordMutation = useMutation({
    mutationFn: async (word: string) => {
      const response = await apiRequest("POST", "/api/vocabulary/analyze", { word });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze word");
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Fill the form with the analyzed data
      form.reset({
        word: wordToAnalyze,
        cefrLevel: data.cefrLevel,
        wordFamily: data.wordFamily || "",
        meaning: data.meaning,
        example: data.example,
        arabicMeaning: data.arabicMeaning || "",
      });
      
      setWordToAnalyze("");
      
      toast({
        title: "Word Analyzed",
        description: "Word analyzed successfully with AI.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission for adding vocabulary
  const onSubmit = (values: VocabularyFormValues) => {
    addVocabularyMutation.mutate(values);
  };

  // Handle form submission for editing vocabulary
  const onEditSubmit = (values: VocabularyFormValues) => {
    if (selectedVocabulary) {
      editVocabularyMutation.mutate({ ...values, id: selectedVocabulary.id });
    }
  };

  // Handle opening edit dialog
  const handleEditClick = (vocabulary: Vocabulary) => {
    setSelectedVocabulary(vocabulary);
    editForm.reset({
      word: vocabulary.word,
      cefrLevel: vocabulary.cefrLevel as any,
      wordFamily: vocabulary.wordFamily || "",
      meaning: vocabulary.meaning,
      example: vocabulary.example,
      arabicMeaning: vocabulary.arabicMeaning || "",
    });
    setIsEditDialogOpen(true);
  };

  // Handle opening delete dialog
  const handleDeleteClick = (vocabulary: Vocabulary) => {
    setSelectedVocabulary(vocabulary);
    setIsDeleteDialogOpen(true);
  };

  // Filter vocabularies based on search term
  const filteredVocabularies = vocabularies.filter((vocab: Vocabulary) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      vocab.word.toLowerCase().includes(searchLower) ||
      vocab.meaning.toLowerCase().includes(searchLower) ||
      (vocab.wordFamily && vocab.wordFamily.toLowerCase().includes(searchLower))
    );
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

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Vocabulary</h1>
            <p className="text-muted-foreground mt-1">
              Manage your vocabulary words and practice with spaced repetition
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/vocabulary/review">
                <Book className="mr-2 h-4 w-4" />
                Review Vocabulary
              </Link>
            </Button>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Word
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search words, meanings, or related words..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-arabic"
                  checked={showArabic}
                  onCheckedChange={setShowArabic}
                />
                <label
                  htmlFor="show-arabic"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Show Arabic
                </label>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : isError ? (
              <div className="flex justify-center items-center h-40 text-destructive">
                <p>Failed to load vocabulary. Please try again.</p>
              </div>
            ) : filteredVocabularies.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-40 border rounded-lg p-4">
                <p className="text-muted-foreground">No vocabulary items found.</p>
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add your first word
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredVocabularies.map((vocabulary: Vocabulary) => (
                  <Card key={vocabulary.id}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-xl flex items-center">
                            {vocabulary.word}
                            <Badge className={`ml-2 ${getCefrLevelColor(vocabulary.cefrLevel)}`}>
                              {vocabulary.cefrLevel}
                            </Badge>
                          </CardTitle>
                          {vocabulary.wordFamily && (
                            <CardDescription>
                              Related words: {vocabulary.wordFamily}
                            </CardDescription>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditClick(vocabulary)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteClick(vocabulary)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <h4 className="text-sm font-medium">Meaning:</h4>
                          <p>{vocabulary.meaning}</p>
                          {showArabic && vocabulary.arabicMeaning && (
                            <p className="text-muted-foreground mt-1 flex items-center">
                              <Languages className="h-3 w-3 mr-1" />
                              {vocabulary.arabicMeaning}
                            </p>
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-medium">Example:</h4>
                          <p className="italic">{vocabulary.example}</p>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="text-xs text-muted-foreground pt-0">
                      Added on {new Date(vocabulary.createdAt).toLocaleDateString()}
                      {vocabulary.lastReviewed && (
                        <span className="ml-2">
                          • Last reviewed: {new Date(vocabulary.lastReviewed).toLocaleDateString()}
                        </span>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Vocabulary Stats</CardTitle>
                <CardDescription>Track your learning progress</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-1">Words by CEFR Level</p>
                    <div className="space-y-2">
                      {["A1", "A2", "B1", "B2", "C1", "C2"].map((level) => {
                        const count = vocabularies.filter(
                          (v: Vocabulary) => v.cefrLevel === level
                        ).length;
                        return (
                          <div key={level} className="flex items-center">
                            <Badge className={`w-8 ${getCefrLevelColor(level)}`}>{level}</Badge>
                            <div className="relative ml-2 h-2 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className={`absolute h-full ${
                                  level.startsWith("A")
                                    ? "bg-green-500"
                                    : level.startsWith("B")
                                    ? "bg-blue-500"
                                    : "bg-purple-500"
                                }`}
                                style={{
                                  width: `${
                                    vocabularies.length > 0
                                      ? (count / vocabularies.length) * 100
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>
                            <span className="ml-2 text-xs w-6 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2">
                    <p className="text-sm font-medium mb-2">Review Progress</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold">
                          {vocabularies.filter((v: Vocabulary) => v.reviewStage === 0).length}
                        </p>
                        <p className="text-xs text-muted-foreground">New Words</p>
                      </div>
                      <div className="border rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold">
                          {vocabularies.filter((v: Vocabulary) => v.reviewStage && v.reviewStage >= 4).length}
                        </p>
                        <p className="text-xs text-muted-foreground">Mastered</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button variant="outline" className="w-full" asChild>
                      <Link href="/vocabulary/review">
                        Start Review Session
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Vocabulary Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Add New Vocabulary</DialogTitle>
            <DialogDescription>
              Add a new word to your vocabulary collection
            </DialogDescription>
          </DialogHeader>
          
          {/* AI Analysis Input */}
          <div className="flex items-end space-x-2 mb-4 pb-2 border-b">
            <div className="flex-1">
              <FormLabel className="text-sm font-medium mb-1.5 block">Analyze with AI</FormLabel>
              <Input
                placeholder="Enter a word to analyze"
                value={wordToAnalyze}
                onChange={(e) => setWordToAnalyze(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => analyzeWordMutation.mutate(wordToAnalyze)}
              disabled={analyzeWordMutation.isPending || !wordToAnalyze.trim()}
            >
              {analyzeWordMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Languages className="mr-2 h-4 w-4" />
              )}
              Analyze
            </Button>
          </div>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="word"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Word</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter word" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cefrLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEFR Level</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="A1">A1 (Beginner)</SelectItem>
                          <SelectItem value="A2">A2 (Elementary)</SelectItem>
                          <SelectItem value="B1">B1 (Intermediate)</SelectItem>
                          <SelectItem value="B2">B2 (Upper Intermediate)</SelectItem>
                          <SelectItem value="C1">C1 (Advanced)</SelectItem>
                          <SelectItem value="C2">C2 (Proficient)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="wordFamily"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Word Family (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Related words, forms"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="meaning"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meaning</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter the definition"
                        {...field}
                        rows={2}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="example"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Example</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter an example sentence"
                        {...field}
                        rows={2}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="arabicMeaning"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Arabic Translation (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Arabic meaning" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={addVocabularyMutation.isPending}>
                  {addVocabularyMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add Word
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Vocabulary Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Edit Vocabulary</DialogTitle>
            <DialogDescription>
              Update your vocabulary word
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="word"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Word</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter word" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="cefrLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEFR Level</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="A1">A1 (Beginner)</SelectItem>
                          <SelectItem value="A2">A2 (Elementary)</SelectItem>
                          <SelectItem value="B1">B1 (Intermediate)</SelectItem>
                          <SelectItem value="B2">B2 (Upper Intermediate)</SelectItem>
                          <SelectItem value="C1">C1 (Advanced)</SelectItem>
                          <SelectItem value="C2">C2 (Proficient)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="wordFamily"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Word Family (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Related words, forms"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="meaning"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meaning</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter the definition"
                        {...field}
                        rows={2}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="example"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Example</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter an example sentence"
                        {...field}
                        rows={2}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="arabicMeaning"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Arabic Translation (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Arabic meaning" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={editVocabularyMutation.isPending}>
                  {editVocabularyMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedVocabulary?.word}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedVocabulary && deleteVocabularyMutation.mutate(selectedVocabulary.id)}
              disabled={deleteVocabularyMutation.isPending}
            >
              {deleteVocabularyMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}