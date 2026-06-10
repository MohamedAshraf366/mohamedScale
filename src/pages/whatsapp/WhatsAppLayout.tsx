import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NavLink } from '@/components/NavLink';
import {
  MessageSquare,
  FileText,
  Settings,
  LayoutDashboard,
  LogOut,
  ArrowLeft,
  User,
  Plus,
} from 'lucide-react';
import logoHorizontal from '@/assets/scale-logo-horizontal.svg';

const navItems = [
  { to: '/whatsapp/inbox', label: 'Inbox', icon: MessageSquare },
  { to: '/whatsapp/templates', label: 'Templates', icon: FileText },
  { to: '/whatsapp/settings', label: 'Settings', icon: Settings },
];

export default function WhatsAppLayout() {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="flex items-center h-16 px-4">
          {/* Left: Logo & Back */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <img src={logoHorizontal} alt="Scale" className="h-7" />
              <span className="text-muted-foreground">/</span>
              <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <MessageSquare className="h-4 w-4" />
                <span className="font-medium">WhatsApp</span>
              </div>
            </div>
          </div>

          {/* Center: Navigation */}
          <nav className="flex-1 flex items-center justify-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                activeClassName="bg-muted text-foreground"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/whatsapp/onboard')}
              className="hidden sm:flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Account
            </Button>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/profile')}
              title="Profile"
            >
              <User className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
