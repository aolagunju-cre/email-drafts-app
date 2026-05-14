import Link from "next/link";
import { Mail } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center gap-3">
          <div className="rounded-full bg-blue-100 p-2">
            <Mail className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-lg leading-tight">Email Draft Generator</p>
            <p className="text-sm text-muted-foreground">Olagunjua Real Estate · Cresa</p>
          </div>
          <nav className="ml-auto flex items-center gap-1">
            <Link
              href="/dashboard"
              className="px-3 py-1.5 text-sm rounded-md hover:bg-slate-100 transition-colors font-medium"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/templates"
              className="px-3 py-1.5 text-sm rounded-md hover:bg-slate-100 transition-colors font-medium"
            >
              Templates
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
