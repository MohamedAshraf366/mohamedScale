import { ReactNode } from 'react';
import { SmartSidebar } from './SmartSidebar';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex w-full">
      <SmartSidebar />
      {/* Add left margin to account for fixed sidebar */}
      <div className="flex flex-col flex-1 ml-14 min-w-0">
        {title && (
          <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
            <h1 className="text-base font-medium">{title}</h1>
          </header>
        )}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
