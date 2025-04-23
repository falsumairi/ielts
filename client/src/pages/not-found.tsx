import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <Layout>
      <div className="min-h-[calc(100vh-4rem)] w-full flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4 border-border">
          <CardContent className="pt-6">
            <div className="flex mb-4 gap-2">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <h1 className="text-2xl font-bold">404 Page Not Found</h1>
            </div>

            <p className="mt-4 text-sm text-muted-foreground mb-6">
              The page you're looking for doesn't exist or has been moved.
            </p>
            
            <Link href="/">
              <Button className="w-full flex items-center gap-2">
                <Home className="h-4 w-4" />
                Return to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
