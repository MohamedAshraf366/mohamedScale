import { Phone, MessageCircle, Users, Mail, Calendar, MoreHorizontal } from 'lucide-react';

export const COMMUNICATION_CHANNELS = [
  { value: 'WA', label: 'WhatsApp', icon: MessageCircle },
  { value: 'Phone call', label: 'Phone call', icon: Phone },
  { value: 'In person', label: 'In person', icon: Users },
  { value: 'Email', label: 'Email', icon: Mail },
  { value: 'Meeting', label: 'Meeting', icon: Calendar },
  { value: 'Others', label: 'Others', icon: MoreHorizontal },
] as const;

export type CommunicationChannel = typeof COMMUNICATION_CHANNELS[number]['value'];

export const getChannelInfo = (value: string | null | undefined) => {
  return COMMUNICATION_CHANNELS.find(c => c.value === value) || null;
};
