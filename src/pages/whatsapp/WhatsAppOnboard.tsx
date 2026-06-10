import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { 
  CheckCircle2, 
  Circle, 
  MessageSquare, 
  Building2, 
  Phone, 
  Shield,
  Loader2,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { META_CONFIG } from '@/lib/meta-config';

declare global {
  interface Window {
    FB: {
      init: (params: {
        appId: string;
        cookie: boolean;
        xfbml: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: FBLoginResponse) => void,
        options: {
          config_id: string;
          response_type: string;
          override_default_response_type: boolean;
          extras: {
            sessionInfoVersion: number;
            feature: string;
            featureType: string;
          };
        }
      ) => void;
    };
    fbAsyncInit: () => void;
  }
}

interface FBLoginResponse {
  authResponse?: {
    code: string;
    accessToken?: string;
  };
  status: string;
}

interface SessionInfoData {
  type: string;
  event: string;
  data: {
    phone_number_id?: string;
    waba_id?: string;
    current_step?: string;
  };
}

type OnboardingStep = 'init' | 'fb-loading' | 'signing-up' | 'exchanging' | 'complete' | 'error';

export default function WhatsAppOnboard() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('init');
  const [error, setError] = useState<string | null>(null);
  const [fbLoaded, setFbLoaded] = useState(false);
  const [wabaInfo, setWabaInfo] = useState<{ waba_id?: string; phone_number_id?: string } | null>(null);

  // Load Facebook SDK
  useEffect(() => {
    if (window.FB) {
      setFbLoaded(true);
      return;
    }

    window.fbAsyncInit = function () {
    window.FB.init({
        appId: META_CONFIG.APP_ID,
        cookie: true,
        xfbml: true,
        version: 'v24.0',
      });
      setFbLoaded(true);
    };

    // Load the SDK asynchronously
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // Session info listener for Embedded Signup
  const handleSessionInfo = useCallback((event: MessageEvent) => {
    if (event.origin !== 'https://www.facebook.com') return;

    try {
      const data: SessionInfoData = JSON.parse(event.data);
      
      if (data.type === 'WA_EMBEDDED_SIGNUP') {
        console.log('Embedded Signup event:', data.event, data.data);

        if (data.event === 'FINISH') {
          const { phone_number_id, waba_id } = data.data;
          setWabaInfo({ phone_number_id, waba_id });
        } else if (data.event === 'CANCEL') {
          setCurrentStep('init');
          setError('Signup was cancelled');
        } else if (data.event === 'ERROR') {
          setCurrentStep('error');
          setError('An error occurred during signup');
        }
      }
    } catch {
      // Not a JSON message, ignore
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleSessionInfo);
    return () => window.removeEventListener('message', handleSessionInfo);
  }, [handleSessionInfo]);

  // Exchange token when we get WABA info
  useEffect(() => {
    if (wabaInfo?.waba_id && currentStep === 'signing-up') {
      // Wait for the FB login callback to complete
    }
  }, [wabaInfo, currentStep]);

  const launchWhatsAppSignup = () => {
    if (!fbLoaded) {
      toast.error('Facebook SDK not loaded yet');
      return;
    }

    if (!META_CONFIG.CONFIG_ID || META_CONFIG.CONFIG_ID === 'YOUR_CONFIG_ID_HERE') {
      toast.error('Meta configuration not set up. Please update src/lib/meta-config.ts with your App ID and Config ID.');
      return;
    }

    setCurrentStep('fb-loading');
    setError(null);

    // Use a regular function (not async) as FB.login callback, then handle async inside
    const handleFBResponse = (response: FBLoginResponse) => {
      if (response.authResponse?.code) {
        setCurrentStep('exchanging');
        
        // Handle async token exchange inside the sync callback
        supabase.functions.invoke('exchange-token', {
          body: {
            code: response.authResponse.code,
            waba_id: wabaInfo?.waba_id,
            phone_number_id: wabaInfo?.phone_number_id,
          },
        }).then(({ data, error: exchangeError }) => {
          if (exchangeError) {
            console.error('Token exchange error:', exchangeError);
            setCurrentStep('error');
            setError(exchangeError.message || 'Failed to complete onboarding');
            return;
          }

          if (data?.success) {
            setCurrentStep('complete');
            toast.success('WhatsApp Business account connected successfully!');
            
            // Navigate to inbox after delay
            setTimeout(() => {
              navigate('/whatsapp/inbox');
            }, 2000);
          } else {
            setCurrentStep('error');
            setError(data?.error || 'Failed to exchange token');
          }
        }).catch((err) => {
          console.error('Token exchange error:', err);
          setCurrentStep('error');
          setError(err instanceof Error ? err.message : 'Failed to complete onboarding');
        });
      } else {
        setCurrentStep('init');
        if (response.status !== 'unknown') {
          setError('Facebook login was not successful');
        }
      }
    };

    window.FB.login(handleFBResponse, {
      config_id: META_CONFIG.CONFIG_ID,
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        sessionInfoVersion: 2,
        feature: 'whatsapp_embedded_signup',
        featureType: 'coexistence',
      },
    });

    setCurrentStep('signing-up');
  };

  const steps = [
    { 
      key: 'connect', 
      label: 'Connect Facebook', 
      description: 'Authenticate with your Facebook Business account',
      icon: Building2 
    },
    { 
      key: 'waba', 
      label: 'Select WhatsApp Account', 
      description: 'Choose or create a WhatsApp Business Account',
      icon: MessageSquare 
    },
    { 
      key: 'phone', 
      label: 'Configure Phone Number', 
      description: 'Add a new or migrate existing phone number',
      icon: Phone 
    },
    { 
      key: 'verify', 
      label: 'Verification', 
      description: 'Complete business verification if required',
      icon: Shield 
    },
  ];

  const getStepStatus = (index: number) => {
    if (currentStep === 'complete') return 'complete';
    if (currentStep === 'error') return index === 0 ? 'error' : 'pending';
    if (currentStep === 'init') return 'pending';
    if (currentStep === 'signing-up' || currentStep === 'exchanging') {
      return index === 0 ? 'active' : 'pending';
    }
    return 'pending';
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
          <MessageSquare className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Connect WhatsApp Business
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Connect your WhatsApp Business account to send messages, manage templates, 
          and communicate with customers directly from this platform.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Steps Progress */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Onboarding Steps</CardTitle>
          <CardDescription>
            Complete these steps to connect your WhatsApp Business account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {steps.map((step, index) => {
              const status = getStepStatus(index);
              const Icon = step.icon;
              
              return (
                <div key={step.key} className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    {status === 'complete' ? (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    ) : status === 'active' ? (
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    ) : status === 'error' ? (
                      <AlertCircle className="w-6 h-6 text-destructive" />
                    ) : (
                      <Circle className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className={`font-medium ${
                        status === 'complete' ? 'text-green-600' :
                        status === 'active' ? 'text-primary' :
                        status === 'error' ? 'text-destructive' :
                        'text-muted-foreground'
                      }`}>
                        {step.label}
                      </span>
                      {status === 'active' && (
                        <Badge variant="secondary" className="text-xs">In Progress</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Main Action Card */}
      <Card>
        <CardContent className="pt-6">
          {currentStep === 'complete' ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Successfully Connected!
              </h3>
              <p className="text-muted-foreground mb-4">
                Your WhatsApp Business account has been connected. Redirecting to inbox...
              </p>
              <Button onClick={() => navigate('/whatsapp/inbox')}>
                Go to Inbox
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {currentStep === 'init' || currentStep === 'error' 
                  ? 'Ready to Connect' 
                  : 'Connecting...'}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Click the button below to start the WhatsApp Business onboarding process. 
                You'll be guided through connecting your Facebook Business account and 
                setting up your WhatsApp Business number.
              </p>

              <div className="space-y-4">
                <Button
                  size="lg"
                  onClick={launchWhatsAppSignup}
                  disabled={!fbLoaded || currentStep === 'signing-up' || currentStep === 'exchanging'}
                  className="gap-2"
                >
                  {(currentStep === 'signing-up' || currentStep === 'exchanging' || currentStep === 'fb-loading') && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  <MessageSquare className="w-4 h-4" />
                  {currentStep === 'init' || currentStep === 'error'
                    ? 'Connect WhatsApp Business'
                    : 'Processing...'}
                </Button>

                {!fbLoaded && (
                  <p className="text-sm text-muted-foreground">
                    Loading Facebook SDK...
                  </p>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-border">
                <h4 className="text-sm font-medium text-foreground mb-3">
                  What you'll need:
                </h4>
                <ul className="text-sm text-muted-foreground space-y-2 text-left max-w-md mx-auto">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    A Facebook Business account
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Access to your WhatsApp Business Account (or create new)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    A phone number for WhatsApp (new or existing)
                  </li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coexistence Info */}
      <Card className="mt-6 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                Coexistence Mode Supported
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                You can migrate an existing WhatsApp Business number from another provider 
                while maintaining your conversation history. This platform fully supports 
                Meta's coexistence requirements for Tech Provider approval.
              </p>
              <a 
                href="https://developers.facebook.com/docs/whatsapp/embedded-signup/coexistence" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2"
              >
                Learn more about coexistence
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
