import { useNavigate } from 'react-router-dom';
import { Package, TrendingUp, ClipboardList, Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';
import Layout from '@/components/Layout';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';

const LAST_SECTION_KEY = 'scale_last_section';

export type SectionType = 'sales' | 'operations' | 'supply-chain' | 'admin';

export const saveLastSection = (section: SectionType) => {
  localStorage.setItem(LAST_SECTION_KEY, section);
};

export const getLastSection = (): SectionType | null => {
  return localStorage.getItem(LAST_SECTION_KEY) as SectionType | null;
};

const HomeHub = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';

  const handleSectionClick = (section: SectionType) => {
    saveLastSection(section);
    if (section === 'sales') {
      navigate('/dashboard');
    } else if (section === 'operations') {
      navigate('/operations');
    } else if (section === 'admin') {
      navigate('/admin/quarterly-plans');
    } else {
      navigate('/materials');
    }
  };

  const sections = [
    {
      id: 'sales' as SectionType,
      title: t('hub.sales', 'Sales'),
      subtitle: t('hub.salesSubtitle', 'Track leads, communications, and pipeline'),
      icon: TrendingUp,
      gradient: 'from-orange-500/10 to-amber-500/10',
      iconColor: 'text-primary',
      borderHover: 'hover:border-primary/50',
    },
    {
      id: 'operations' as SectionType,
      title: t('hub.operations', 'Operations'),
      subtitle: t('hub.operationsSubtitle', 'Manage orders, deliveries, and execution'),
      icon: ClipboardList,
      gradient: 'from-blue-500/10 to-indigo-500/10',
      iconColor: 'text-blue-600',
      borderHover: 'hover:border-blue-500/50',
    },
    {
      id: 'supply-chain' as SectionType,
      title: t('hub.supplyChain', 'Supply'),
      subtitle: t('hub.supplyChainSubtitle', 'Manage materials, suppliers, and logistics'),
      icon: Package,
      gradient: 'from-emerald-500/10 to-teal-500/10',
      iconColor: 'text-emerald-600',
      borderHover: 'hover:border-emerald-500/50',
    },
    ...(isAdmin ? [{
      id: 'admin' as SectionType,
      title: t('hub.admin', 'Admin'),
      subtitle: t('hub.adminSubtitle', 'Strategic planning, approvals, and executive oversight'),
      icon: Shield,
      gradient: 'from-violet-500/10 to-purple-500/10',
      iconColor: 'text-violet-600',
      borderHover: 'hover:border-violet-500/50',
    }] : []),
  ];

  return (
    <Layout>
      <div className="min-h-[calc(100vh-2rem)] min-h-[calc(100dvh-2rem)] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 safe-container">
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            {t('hub.welcome', 'Welcome to Scale')}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {t('hub.selectSection', 'Select a section to get started')}
          </p>
        </div>

        <div className={`grid grid-cols-1 ${sections.length === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'} gap-4 sm:gap-6 md:gap-8 max-w-6xl w-full px-4 sm:px-0`}>
          {sections.map((section) => (
            <Card
              key={section.id}
              onClick={() => handleSectionClick(section.id)}
              className={`
                relative overflow-hidden cursor-pointer
                p-8 rounded-2xl border-2 border-border/50
                bg-gradient-to-br ${section.gradient}
                transition-all duration-300 ease-out
                hover:scale-[1.02] hover:shadow-xl
                ${section.borderHover}
                group
              `}
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className={`
                  p-4 rounded-2xl bg-background/80 backdrop-blur-sm
                  transition-transform duration-300 group-hover:scale-110
                `}>
                  <section.icon className={`h-12 w-12 ${section.iconColor}`} />
                </div>
                <h2 className="text-xl font-semibold text-foreground">
                  {section.title}
                </h2>
              </div>

              {/* Subtle shine effect on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default HomeHub;
