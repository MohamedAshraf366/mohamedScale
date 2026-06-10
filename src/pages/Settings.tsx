import { useNavigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, ArrowRight } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();

  return (
    <ProtectedRoute>
      <AppLayout title="Settings">
        <div className="p-6 space-y-6 max-w-4xl">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Configure system preferences</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4.5 w-4.5 text-primary" />
                KPI Targets
              </CardTitle>
              <CardDescription>
                Set monthly performance targets. Weekly &amp; yearly values are auto-calculated.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/sales/targets")}>
                Manage Targets
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
};

export default Settings;
