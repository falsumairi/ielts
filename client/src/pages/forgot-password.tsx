import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Layout from "@/components/layout/Layout";

// Form schema
const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

// For the OTP verification form
const otpVerificationSchema = z.object({
  otp: z.string().min(6, "OTP must be at least 6 digits").max(6, "OTP must be at most 6 digits"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Confirm password is required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type OtpVerificationValues = z.infer<typeof otpVerificationSchema>;

export default function ForgotPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState<string>("");
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Timer for OTP expiration (60 seconds)
  const [countdown, setCountdown] = useState(60);
  
  // Forgot password form
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });
  
  // OTP verification form
  const otpForm = useForm<OtpVerificationValues>({
    resolver: zodResolver(otpVerificationSchema),
    defaultValues: {
      otp: "",
      password: "",
      confirmPassword: "",
    },
  });
  
  // Request password reset email mutation
  const requestPasswordReset = useMutation({
    mutationFn: async (values: ForgotPasswordValues) => {
      const response = await apiRequest("POST", "/api/password-reset/request", values);
      return response.json();
    },
    onSuccess: (data) => {
      setEmail(form.getValues().email);
      setShowOtpForm(true);
      
      // Start countdown for OTP expiration
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      toast({
        title: "Check your email",
        description: "We've sent a verification code to your email address.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset instructions. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Reset password with OTP mutation
  const resetPasswordWithOtp = useMutation({
    mutationFn: async (values: OtpVerificationValues & { email: string }) => {
      // Prepare data for the API
      const data = {
        email: values.email,
        token: values.otp,
        password: values.password
      };
      const response = await apiRequest("POST", "/api/password-reset/reset", data);
      return response.json();
    },
    onSuccess: () => {
      setIsSuccess(true);
      toast({
        title: "Password reset successful",
        description: "Your password has been reset successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password. The code may be invalid or expired.",
        variant: "destructive",
      });
    },
  });
  
  // Resend OTP mutation
  const resendOtp = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", "/api/resend-otp", { email });
      return response.json();
    },
    onSuccess: () => {
      setCountdown(60);
      
      // Reset countdown
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      toast({
        title: "OTP resent",
        description: "A new verification code has been sent to your email.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resend verification code.",
        variant: "destructive",
      });
    },
  });
  
  // Form submission handlers
  const onSubmit = (values: ForgotPasswordValues) => {
    requestPasswordReset.mutate(values);
  };
  
  const onOtpSubmit = (values: OtpVerificationValues) => {
    resetPasswordWithOtp.mutate({ ...values, email });
  };
  
  const handleResendOtp = () => {
    if (countdown === 0 && email) {
      resendOtp.mutate(email);
    }
  };
  
  // If the password reset was successful
  if (isSuccess) {
    return (
      <Layout showAuthButtons={false}>
        <div className="min-h-[calc(100vh-4rem)] bg-background flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
          <Card className="w-full max-w-md shadow-lg border-border">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center text-success">
                  <CheckCircle className="h-6 w-6" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">Password Reset Successful</CardTitle>
              <CardDescription>Your password has been reset successfully.</CardDescription>
            </CardHeader>
            <CardFooter className="flex flex-col space-y-4">
              <Button asChild className="w-full">
                <Link href="/auth">
                  Return to Login
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout showAuthButtons={false}>
      <div className="min-h-[calc(100vh-4rem)] bg-background flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md shadow-lg border-border">
          <CardHeader>
            <div className="flex items-center mb-2">
              <Button
                variant="ghost"
                size="sm"
                className="p-0 h-8 w-8 rounded-full"
                asChild
              >
                <Link href="/auth">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="sr-only">Back to login</span>
                </Link>
              </Button>
            </div>
            <CardTitle className="text-2xl font-bold">
              {showOtpForm ? "Verify Your Identity" : "Forgot Your Password?"}
            </CardTitle>
            <CardDescription>
              {showOtpForm
                ? "We've sent a verification code to your email. Enter the code and create a new password."
                : "Enter your email address and we'll send you a verification code to reset your password."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!showOtpForm ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your email address"
                            type="email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={requestPasswordReset.isPending}
                  >
                    {requestPasswordReset.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Verification Code"
                    )}
                  </Button>
                </form>
              </Form>
            ) : (
              <Form {...otpForm}>
                <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
                  <FormField
                    control={otpForm.control}
                    name="otp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Verification Code</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter 6-digit code"
                            {...field}
                            maxLength={6}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="text-sm text-center">
                    {countdown > 0 ? (
                      <p className="text-muted-foreground">
                        Code expires in <span className="font-medium">{countdown}</span> seconds
                      </p>
                    ) : (
                      <Button
                        variant="link"
                        className="p-0 h-auto text-primary"
                        onClick={handleResendOtp}
                        disabled={resendOtp.isPending}
                      >
                        {resendOtp.isPending ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          "Resend code"
                        )}
                      </Button>
                    )}
                  </div>
                  <FormField
                    control={otpForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Create a new password"
                            type="password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={otpForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Confirm your new password"
                            type="password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={resetPasswordWithOtp.isPending}
                  >
                    {resetPasswordWithOtp.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Resetting Password...
                      </>
                    ) : (
                      "Reset Password"
                    )}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
          <CardFooter className="flex flex-col">
            <div className="text-sm text-muted-foreground text-center">
              Remembered your password?{" "}
              <Link href="/auth" className="text-primary font-medium hover:underline">
                Back to login
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </Layout>
  );
}