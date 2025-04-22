import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation } from "wouter";
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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

// OTP Verification schema
const verificationSchema = z.object({
  otp: z.string().min(6, "Please enter all 6 digits").max(6),
});

type VerificationValues = z.infer<typeof verificationSchema>;

export default function VerifyEmail() {
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [isVerified, setIsVerified] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [countdown, setCountdown] = useState(60);
  const [isConfirming, setIsConfirming] = useState(false);
  
  // Parse email from URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");
    
    if (emailParam) {
      setEmail(emailParam);
    } else {
      // If no email in URL, redirect to login
      navigate("/auth");
    }
    
    // Start countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [navigate]);
  
  // Form setup
  const form = useForm<VerificationValues>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      otp: "",
    },
  });
  
  // Verify email mutation
  const verifyEmail = useMutation({
    mutationFn: async (values: VerificationValues & { email: string }) => {
      const response = await apiRequest("POST", "/api/verify-email", values);
      return response.json();
    },
    onSuccess: () => {
      setIsVerified(true);
      toast({
        title: "Email verified",
        description: "Your email has been successfully verified.",
      });
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/auth");
      }, 3000);
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message || "The verification code is invalid or has expired.",
        variant: "destructive",
      });
    },
  });
  
  // Resend verification code mutation
  const resendVerification = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", "/api/resend-verification", { email });
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
        title: "Verification code resent",
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
  
  // Form submission handler
  const onSubmit = (values: VerificationValues) => {
    if (email) {
      verifyEmail.mutate({ ...values, email });
    } else {
      toast({
        title: "Error",
        description: "Email address is missing. Please go back to the registration page.",
        variant: "destructive",
      });
    }
  };
  
  const handleResendCode = () => {
    if (countdown === 0 && email) {
      resendVerification.mutate(email);
    }
  };
  
  // If email is verified
  if (isVerified) {
    return (
      <div className="min-h-screen bg-neutral-bg flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="flex-center mb-4">
              <div className="h-12 w-12 rounded-full bg-success/20 flex-center text-success">
                <CheckCircle className="h-6 w-6" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Email Verified</CardTitle>
            <CardDescription>Your email has been successfully verified. You'll be redirected to the login page shortly.</CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col space-y-4">
            <Button asChild className="w-full">
              <Link href="/auth">
                Go to Login
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-neutral-bg flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md shadow-lg">
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
          <CardTitle className="text-2xl font-bold">Verify Your Email</CardTitle>
          <CardDescription>
            We've sent a verification code to <span className="font-medium">{email}</span>. Enter the 6-digit code below to verify your email address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="otp"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Verification Code</FormLabel>
                    <FormControl>
                      <InputOTP maxLength={6} {...field}>
                        <InputOTPGroup>
                          <InputOTPSlot />
                          <InputOTPSlot />
                          <InputOTPSlot />
                          <InputOTPSlot />
                          <InputOTPSlot />
                          <InputOTPSlot />
                        </InputOTPGroup>
                      </InputOTP>
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
                    onClick={handleResendCode}
                    disabled={resendVerification.isPending}
                  >
                    {resendVerification.isPending ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Resend verification code"
                    )}
                  </Button>
                )}
              </div>
              
              <Button
                type="submit"
                className="w-full"
                disabled={verifyEmail.isPending || !form.formState.isValid}
              >
                {verifyEmail.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Email"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col">
          <div className="text-sm text-muted-foreground text-center">
            Already verified?{" "}
            <Link href="/auth" className="text-primary font-medium hover:underline">
              Return to login
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}