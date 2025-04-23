import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, QueryClient } from "@tanstack/react-query";
import { TestModule } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle
} from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { 
  Table, 
  TableHeader, 
  TableRow, 
  TableHead, 
  TableBody, 
  TableCell, 
  TableCaption
} from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectLabel, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AlertCircle, CheckCircle2, ChevronDown, Download, FileUp, HelpCircle, ListFilter, PlusCircle, RefreshCw, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TestData {
  id: number;
  title: string;
  description: string | null;
  module: TestModule;
  durationMinutes: number;
  active: boolean;
  createdAt: string;
}

interface FileUploadResponse {
  success: boolean;
  path: string;
  filename: string;
  size: number;
}

interface QuestionUploadResponse {
  success: boolean;
  count: number;
  questions: any[];
}

export default function AdminTests() {
  const { toast } = useToast();
  const [isCreatingTest, setIsCreatingTest] = useState(false);
  const [newTest, setNewTest] = useState({
    title: "",
    description: "",
    module: TestModule.READING,
    durationMinutes: 60,
    active: true
  });
  const [selectedTest, setSelectedTest] = useState<TestData | null>(null);
  const [activeTab, setActiveTab] = useState("list");
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [questionsFile, setQuestionsFile] = useState<File | null>(null);
  const [uploadResults, setUploadResults] = useState<{
    audio: FileUploadResponse | null;
    image: FileUploadResponse | null;
    questions: QuestionUploadResponse | null;
  }>({
    audio: null,
    image: null,
    questions: null
  });
  const [isUploading, setIsUploading] = useState({
    audio: false,
    image: false,
    questions: false
  });

  // Fetch all tests
  const { data: tests, isLoading, error, refetch } = useQuery<TestData[]>({
    queryKey: ['/api/tests'],
    retry: 1
  });

  // Filter tests by module
  const filteredTests = selectedModule
    ? tests?.filter(test => test.module === selectedModule)
    : tests;

  // Create new test
  const createTestMutation = useMutation({
    mutationFn: async (data: typeof newTest) => {
      const response = await apiRequest("POST", "/api/tests", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Test created",
        description: "New test has been created successfully.",
      });
      setIsCreatingTest(false);
      setNewTest({
        title: "",
        description: "",
        module: TestModule.READING,
        durationMinutes: 60,
        active: true
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tests'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create test",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update test
  const updateTestMutation = useMutation({
    mutationFn: async (data: { id: number, active: boolean }) => {
      const response = await apiRequest("PATCH", `/api/tests/${data.id}`, { active: data.active });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Test updated",
        description: "Test status has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tests'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update test",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // File upload mutations
  const uploadAudioMutation = useMutation({
    mutationFn: async ({ testId, file }: { testId: number, file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`/api/admin/tests/${testId}/audio/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to upload audio: ${response.statusText}`);
      }
      
      return await response.json() as FileUploadResponse;
    },
    onSuccess: (data) => {
      setUploadResults(prev => ({
        ...prev,
        audio: data
      }));
      toast({
        title: "Audio uploaded",
        description: "Audio file has been uploaded successfully.",
      });
      setIsUploading(prev => ({ ...prev, audio: false }));
      setAudioFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to upload audio",
        description: error.message,
        variant: "destructive",
      });
      setIsUploading(prev => ({ ...prev, audio: false }));
    }
  });

  const uploadImageMutation = useMutation({
    mutationFn: async ({ testId, file }: { testId: number, file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`/api/admin/tests/${testId}/images/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to upload image: ${response.statusText}`);
      }
      
      return await response.json() as FileUploadResponse;
    },
    onSuccess: (data) => {
      setUploadResults(prev => ({
        ...prev,
        image: data
      }));
      toast({
        title: "Image uploaded",
        description: "Image file has been uploaded successfully.",
      });
      setIsUploading(prev => ({ ...prev, image: false }));
      setImageFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to upload image",
        description: error.message,
        variant: "destructive",
      });
      setIsUploading(prev => ({ ...prev, image: false }));
    }
  });

  const uploadQuestionsMutation = useMutation({
    mutationFn: async ({ testId, file }: { testId: number, file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`/api/admin/tests/${testId}/questions/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to upload questions: ${response.statusText}`);
      }
      
      return await response.json() as QuestionUploadResponse;
    },
    onSuccess: (data) => {
      setUploadResults(prev => ({
        ...prev,
        questions: data
      }));
      toast({
        title: "Questions uploaded",
        description: `Successfully uploaded ${data.count} questions.`,
      });
      setIsUploading(prev => ({ ...prev, questions: false }));
      setQuestionsFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to upload questions",
        description: error.message,
        variant: "destructive",
      });
      setIsUploading(prev => ({ ...prev, questions: false }));
    }
  });

  // Handle file uploads
  const handleAudioUpload = () => {
    if (!audioFile || !selectedTest) return;
    
    setIsUploading(prev => ({ ...prev, audio: true }));
    uploadAudioMutation.mutate({ 
      testId: selectedTest.id, 
      file: audioFile 
    });
  };

  const handleImageUpload = () => {
    if (!imageFile || !selectedTest) return;
    
    setIsUploading(prev => ({ ...prev, image: true }));
    uploadImageMutation.mutate({ 
      testId: selectedTest.id, 
      file: imageFile 
    });
  };

  const handleQuestionsUpload = () => {
    if (!questionsFile || !selectedTest) return;
    
    setIsUploading(prev => ({ ...prev, questions: true }));
    uploadQuestionsMutation.mutate({ 
      testId: selectedTest.id, 
      file: questionsFile 
    });
  };

  // Handle form submissions
  const handleCreateTest = (e: React.FormEvent) => {
    e.preventDefault();
    createTestMutation.mutate(newTest);
  };

  const handleTestActiveToggle = (test: TestData) => {
    updateTestMutation.mutate({
      id: test.id,
      active: !test.active
    });
  };

  // Reset upload results when selecting a different test
  useEffect(() => {
    setUploadResults({
      audio: null,
      image: null,
      questions: null
    });
    setAudioFile(null);
    setImageFile(null);
    setQuestionsFile(null);
  }, [selectedTest]);

  const getModuleBadgeColor = (module: TestModule) => {
    switch (module) {
      case TestModule.READING:
        return "bg-blue-500";
      case TestModule.LISTENING:
        return "bg-green-500";
      case TestModule.WRITING:
        return "bg-purple-500";
      case TestModule.SPEAKING:
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Test Management</h1>
          <p className="text-muted-foreground">Manage IELTS tests and upload resources</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} className="flex items-center gap-2">
            <RefreshCw size={16} />
            Refresh
          </Button>
          <Dialog open={isCreatingTest} onOpenChange={setIsCreatingTest}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <PlusCircle size={16} />
                Create Test
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Test</DialogTitle>
                <DialogDescription>
                  Create a new IELTS test for students to practice.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateTest}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="title" className="text-right">Title</Label>
                    <Input
                      id="title"
                      value={newTest.title}
                      onChange={(e) => setNewTest({ ...newTest, title: e.target.value })}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">Description</Label>
                    <Textarea
                      id="description"
                      value={newTest.description}
                      onChange={(e) => setNewTest({ ...newTest, description: e.target.value })}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="module" className="text-right">Module</Label>
                    <Select 
                      value={newTest.module} 
                      onValueChange={(value) => setNewTest({ ...newTest, module: value as TestModule })}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select module" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Test Modules</SelectLabel>
                          <SelectItem value={TestModule.READING}>Reading</SelectItem>
                          <SelectItem value={TestModule.LISTENING}>Listening</SelectItem>
                          <SelectItem value={TestModule.WRITING}>Writing</SelectItem>
                          <SelectItem value={TestModule.SPEAKING}>Speaking</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="duration" className="text-right">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      min={1}
                      value={newTest.durationMinutes}
                      onChange={(e) => setNewTest({ ...newTest, durationMinutes: parseInt(e.target.value) })}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="active" className="text-right">Active</Label>
                    <div className="flex items-center space-x-2 col-span-3">
                      <Switch
                        id="active"
                        checked={newTest.active}
                        onCheckedChange={(checked) => setNewTest({ ...newTest, active: checked })}
                      />
                      <Label htmlFor="active">{newTest.active ? "Yes" : "No"}</Label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreatingTest(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createTestMutation.isPending}>
                    {createTestMutation.isPending ? "Creating..." : "Create Test"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="list">Test List</TabsTrigger>
          <TabsTrigger value="upload" disabled={!selectedTest}>Resource Upload</TabsTrigger>
        </TabsList>
        
        <TabsContent value="list">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Available Tests</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <ListFilter size={16} />
                      Filter Module
                      <ChevronDown size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Test Modules</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setSelectedModule(null)}>
                      All Modules
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedModule(TestModule.READING)}>
                      Reading
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedModule(TestModule.LISTENING)}>
                      Listening
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedModule(TestModule.WRITING)}>
                      Writing
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedModule(TestModule.SPEAKING)}>
                      Speaking
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <CardDescription>
                {selectedModule ? `Showing ${selectedModule} tests` : "Showing all tests"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">Loading tests...</div>
              ) : error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    Failed to load tests. Please try again.
                  </AlertDescription>
                </Alert>
              ) : filteredTests && filteredTests.length > 0 ? (
                <Table>
                  <TableCaption>List of available IELTS tests</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTests.map((test) => (
                      <TableRow 
                        key={test.id} 
                        className={selectedTest?.id === test.id ? "bg-muted" : ""}
                      >
                        <TableCell className="font-medium">{test.title}</TableCell>
                        <TableCell>
                          <Badge className={getModuleBadgeColor(test.module)}>
                            {test.module}
                          </Badge>
                        </TableCell>
                        <TableCell>{test.durationMinutes} mins</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${test.active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            {test.active ? 'Active' : 'Inactive'}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleTestActiveToggle(test)}
                            >
                              {test.active ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedTest(test);
                                setActiveTab("upload");
                              }}
                            >
                              Upload Resources
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-4">
                  {selectedModule 
                    ? `No ${selectedModule} tests found.` 
                    : "No tests found. Create a new test to get started."}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="upload">
          {selectedTest && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Upload Audio File</CardTitle>
                  <CardDescription>
                    Upload MP3 or WAV files for listening tests
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Label htmlFor="audioFile">Audio File (MP3/WAV)</Label>
                    <Input 
                      id="audioFile" 
                      type="file" 
                      accept=".mp3,.wav"
                      onChange={(e) => setAudioFile(e.target.files ? e.target.files[0] : null)}
                      className="mt-2"
                    />
                  </div>
                  {uploadResults.audio && (
                    <Alert className="mb-4">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Upload Successful</AlertTitle>
                      <AlertDescription>
                        <p>Filename: {uploadResults.audio.filename}</p>
                        <p>Size: {Math.round(uploadResults.audio.size / 1024)} KB</p>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={handleAudioUpload} 
                    disabled={!audioFile || isUploading.audio}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <FileUp size={16} />
                    {isUploading.audio ? "Uploading..." : "Upload Audio"}
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Upload Image File</CardTitle>
                  <CardDescription>
                    Upload JPG or PNG files for test content
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Label htmlFor="imageFile">Image File (JPG/PNG)</Label>
                    <Input 
                      id="imageFile" 
                      type="file" 
                      accept=".jpg,.jpeg,.png"
                      onChange={(e) => setImageFile(e.target.files ? e.target.files[0] : null)}
                      className="mt-2"
                    />
                  </div>
                  {uploadResults.image && (
                    <Alert className="mb-4">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Upload Successful</AlertTitle>
                      <AlertDescription>
                        <p>Filename: {uploadResults.image.filename}</p>
                        <p>Size: {Math.round(uploadResults.image.size / 1024)} KB</p>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={handleImageUpload} 
                    disabled={!imageFile || isUploading.image}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <FileUp size={16} />
                    {isUploading.image ? "Uploading..." : "Upload Image"}
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Upload Questions
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle size={16} className="text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <p>Upload questions in JSON, CSV, or XLSX format. Download a template below.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardTitle>
                  <CardDescription>
                    Upload questions in JSON, CSV, or XLSX format
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Label htmlFor="questionsFile">Questions File</Label>
                    <Input 
                      id="questionsFile" 
                      type="file" 
                      accept=".json,.csv,.xlsx,.xls"
                      onChange={(e) => setQuestionsFile(e.target.files ? e.target.files[0] : null)}
                      className="mt-2"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Label className="text-xs text-muted-foreground w-full mb-1">Download template:</Label>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(`/api/admin/tests/template/questions/download?format=xlsx&module=${selectedTest?.module || 'reading'}`, '_blank')}
                        className="flex items-center justify-center gap-1 text-xs"
                      >
                        <Download size={12} />
                        XLSX
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(`/api/admin/tests/template/questions/download?format=csv&module=${selectedTest?.module || 'reading'}`, '_blank')}
                        className="flex items-center justify-center gap-1 text-xs"
                      >
                        <Download size={12} />
                        CSV
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(`/api/admin/tests/template/questions/download?format=json&module=${selectedTest?.module || 'reading'}`, '_blank')}
                        className="flex items-center justify-center gap-1 text-xs"
                      >
                        <Download size={12} />
                        JSON
                      </Button>
                    </div>
                  </div>
                  {uploadResults.questions && (
                    <Alert className="mb-4">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Upload Successful</AlertTitle>
                      <AlertDescription>
                        <p>Questions added: {uploadResults.questions.count}</p>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={handleQuestionsUpload} 
                    disabled={!questionsFile || isUploading.questions}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <FileUp size={16} />
                    {isUploading.questions ? "Uploading..." : "Upload Questions"}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}