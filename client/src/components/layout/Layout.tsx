import { ReactNode } from "react";
import Header from "./Header";

interface LayoutProps {
  children: ReactNode;
  showAuthButtons?: boolean;
}

export default function Layout({ children, showAuthButtons = true }: LayoutProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header showAuthButtons={showAuthButtons} />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}