import { useNavigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { 
  TrendingUp, 
  ClipboardList, 
  Package, 
  UserPlus, 
  FileText, 
  MessageSquare,
  Send,
  Plus,
  ArrowRight
} from 'lucide-react';

interface ModuleCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
  variant: 'sales' | 'operations' | 'supply';
}

const ModuleCard = ({ title, description, icon: Icon, onClick, variant }: ModuleCardProps) => {
  const variantStyles = {
    sales: 'bg-orange-50 hover:bg-orange-100 border-orange-200 dark:bg-orange-950/20 dark:hover:bg-orange-950/30 dark:border-orange-900/30',
    operations: 'bg-blue-50 hover:bg-blue-100 border-blue-200 dark:bg-blue-950/20 dark:hover:bg-blue-950/30 dark:border-blue-900/30',
    supply: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30 dark:border-emerald-900/30',
  };

  const iconStyles = {
    sales: 'text-primary',
    operations: 'text-blue-600 dark:text-blue-400',
    supply: 'text-emerald-600 dark:text-emerald-400',
  };

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 border-2 ${variantStyles[variant]}`}
      onClick={onClick}
    >
      <CardContent className="flex flex-col items-center justify-center p-6">
        <div className="p-3 rounded-xl bg-white/80 dark:bg-background/50 mb-3">
          <Icon className={`h-6 w-6 ${iconStyles[variant]}`} />
        </div>
        <h3 className="text-base font-medium text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
};

interface QuickActionProps {
  title: string;
  icon: React.ElementType;
  onClick: () => void;
}

const QuickAction = ({ title, icon: Icon, onClick }: QuickActionProps) => (
  <Button 
    variant="outline" 
    className="flex items-center gap-2 justify-start h-auto py-3 px-4"
    onClick={onClick}
  >
    <Icon className="h-4 w-4 text-primary" />
    <span>{title}</span>
  </Button>
);

const IndexContent = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  
  // Get user's display name from profile or fallback to email
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';

  return (
    <div className="flex-1 p-6 space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome back, {displayName}
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your sales, operations, and supply chain
        </p>
      </div>

      {/* Module Cards */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Modules</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ModuleCard 
            title="Sales" 
            description="Customers, Pipeline, Tasks"
            icon={TrendingUp} 
            variant="sales"
            onClick={() => navigate('/customers')}
          />
          <ModuleCard 
            title="Operations" 
            description="Orders, Deliveries"
            icon={ClipboardList} 
            variant="operations"
            onClick={() => navigate('/orders')}
          />
          <ModuleCard 
            title="Supply" 
            description="Materials, Suppliers"
            icon={Package} 
            variant="supply"
            onClick={() => navigate('/materials')}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction 
            title="Add Customer" 
            icon={UserPlus} 
            onClick={() => navigate('/customers/add')} 
          />
          <QuickAction 
            title="New Order" 
            icon={Plus} 
            onClick={() => navigate('/orders')} 
          />
          <QuickAction 
            title="Create Quote" 
            icon={FileText} 
            onClick={() => navigate('/pipeline')} 
          />
          <QuickAction 
            title="View Tasks" 
            icon={ArrowRight} 
            onClick={() => navigate('/tasks')} 
          />
        </div>
      </div>

      {/* WhatsApp Section */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">WhatsApp</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card 
            className="cursor-pointer hover:bg-muted/50 transition-colors border"
            onClick={() => navigate('/whatsapp')}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-base">Inbox</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                View and respond to WhatsApp messages
              </CardDescription>
            </CardContent>
          </Card>
          
          <Card 
            className="cursor-pointer hover:bg-muted/50 transition-colors border"
            onClick={() => navigate('/whatsapp/templates')}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-base">Templates</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Manage message templates
              </CardDescription>
            </CardContent>
          </Card>
          
          <Card 
            className="cursor-pointer hover:bg-muted/50 transition-colors border"
            onClick={() => navigate('/whatsapp/settings')}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-base">Send Message</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Send bulk or individual messages
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

const Index = () => (
  <ProtectedRoute>
    <AppLayout>
      <IndexContent />
    </AppLayout>
  </ProtectedRoute>
);

export default Index;
