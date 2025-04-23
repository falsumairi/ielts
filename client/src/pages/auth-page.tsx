import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { CheckCircle, GraduationCap, Loader2, BookOpen, Headphones, Pen, Mic } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Layout from "@/components/layout/Layout";

// Login form schema
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Registration form schema
const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(20, "Username must be at most 20 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<string>("login");
  const [location, navigate] = useLocation();
  const { user, loginMutation, registerMutation } = useAuth();

  // Redirect to home if already logged in
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  // Login form setup
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Register form setup
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Form submission handlers
  const onLoginSubmit = (values: LoginFormValues) => {
    loginMutation.mutate({
      username: values.username,
      password: values.password,
    });
  };

  const onRegisterSubmit = (values: RegisterFormValues) => {
    registerMutation.mutate({
      username: values.username,
      email: values.email,
      password: values.password,
    });
  };

  if (user) {
    return (
      <div className="flex-center min-h-screen bg-neutral-bg">
        <div className="flex-col-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-neutral-dark">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout showAuthButtons={false}>
      <div className="bg-background flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="container-wide grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Brand and Hero Section - Appears first on mobile, second on desktop */}
          <div className="flex flex-col order-1 lg:order-2 slide-up">
            <div className="flex items-center mb-6">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-primary to-secondary flex-center text-white text-xl font-bold mr-4">
                <GraduationCap className="h-7 w-7" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold gradient-text">IELTS Exam Pro</h1>
            </div>
            
            <div className="ielts-card bg-card">
              <h2 className="text-2xl font-bold mb-2">Complete IELTS Preparation</h2>
              <p className="text-muted-foreground mb-8">
                Comprehensive practice platform covering all four IELTS modules with expert-designed questions and detailed feedback.
              </p>
              
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="flex flex-col space-y-5">
                  <div className="flex items-start">
                    <div className="bg-primary/10 p-2 rounded-full mr-3 flex-shrink-0">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">Reading</h3>
                      <p className="text-sm text-muted-foreground">Authentic passages with comprehensive questions</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="bg-secondary/10 p-2 rounded-full mr-3 flex-shrink-0">
                      <Headphones className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <h3 className="font-medium">Listening</h3>
                      <p className="text-sm text-muted-foreground">Realistic audio with challenging comprehension tests</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col space-y-5">
                  <div className="flex items-start">
                    <div className="bg-accent/10 p-2 rounded-full mr-3 flex-shrink-0">
                      <Pen className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-medium">Writing</h3>
                      <p className="text-sm text-muted-foreground">Timed tasks with detailed scoring criteria</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="bg-primary/10 p-2 rounded-full mr-3 flex-shrink-0">
                      <Mic className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">Speaking</h3>
                      <p className="text-sm text-muted-foreground">Simulated interviews with instant feedback</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-success mr-2 flex-shrink-0" />
                  <span className="text-sm">Detailed progress tracking and analytics</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-success mr-2 flex-shrink-0" />
                  <span className="text-sm">Expert-designed questions mirroring real IELTS exams</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-success mr-2 flex-shrink-0" />
                  <span className="text-sm">Personalized feedback to improve your band score</span>
                </div>
              </div>
            </div>
          </div>

          {/* Auth Forms - Appears second on mobile, first on desktop */}
          <div className="flex items-center justify-center order-2 lg:order-1 fade-in">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-md">
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              {/* Login Form */}
              <TabsContent value="login">
                <Card className="border-border shadow-lg">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
                    <CardDescription>
                      Sign in to continue your IELTS preparation
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...loginForm}>
                      <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                        <FormField
                          control={loginForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter your username" 
                                  className="border-input focus:border-primary" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={loginForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input 
                                  type="password" 
                                  placeholder="Enter your password" 
                                  className="border-input focus:border-primary" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end my-2">
                          <Link
                            href="/forgot-password"
                            className="text-xs text-primary hover:underline"
                          >
                            Forgot password?
                          </Link>
                        </div>
                        
                        <Button
                          type="submit"
                          className="w-full btn-graduate font-medium"
                          disabled={loginMutation.isPending}
                        >
                          {loginMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...
                            </>
                          ) : (
                            "Sign in"
                          )}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-4">
                    <Separator className="my-2" />
                    <div className="text-sm text-muted-foreground text-center">
                      Don't have an account?{" "}
                      <button
                        onClick={() => setActiveTab("register")}
                        className="text-primary font-medium hover:underline focus:outline-none"
                        type="button"
                      >
                        Create account
                      </button>
                    </div>
                  </CardFooter>
                </Card>
              </TabsContent>

              {/* Register Form */}
              <TabsContent value="register">
                <Card className="border-border shadow-lg">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
                    <CardDescription>
                      Register to start your IELTS preparation journey
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...registerForm}>
                      <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                        <FormField
                          control={registerForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Choose a username" 
                                  className="border-input focus:border-primary" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input 
                                  type="email" 
                                  placeholder="Enter your email" 
                                  className="border-input focus:border-primary" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input 
                                  type="password" 
                                  placeholder="Create a password" 
                                  className="border-input focus:border-primary" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirm Password</FormLabel>
                              <FormControl>
                                <Input 
                                  type="password" 
                                  placeholder="Confirm your password" 
                                  className="border-input focus:border-primary" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          className="w-full btn-graduate font-medium"
                          disabled={registerMutation.isPending}
                        >
                          {registerMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account...
                            </>
                          ) : (
                            "Create account"
                          )}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-4">
                    <Separator className="my-2" />
                    <div className="text-sm text-muted-foreground text-center">
                      Already have an account?{" "}
                      <button
                        onClick={() => setActiveTab("login")}
                        className="text-primary font-medium hover:underline focus:outline-none"
                        type="button"
                      >
                        Sign in
                      </button>
                    </div>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </Layout>
  );
}