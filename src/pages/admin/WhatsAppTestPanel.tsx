import { AppLayout } from '@/components/layout/AppLayout';
import FataiTestPanel from '@/pages/supply/FataiTestPanel';

/**
 * WhatsApp Test Panel admin page.
 *
 * Wraps the WhatsApp/Fatai outreach test panel inside the standard AppLayout
 * so it has the sidebar and header.
 */
export default function WhatsAppTestPanel() {
  return (
    <AppLayout title="WhatsApp Test Panel">
      <FataiTestPanel />
    </AppLayout>
  );
}
