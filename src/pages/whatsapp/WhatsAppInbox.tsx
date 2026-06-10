import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import {
  Send,
  Paperclip,
  Search,
  Phone,
  MoreVertical,
  Check,
  CheckCheck,
  Clock,
  Image as ImageIcon,
  FileText,
  MessageSquare,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface Conversation {
  id: string;
  their_phone: string;
  status: string;
  last_message_at: string | null;
  first_message_at: string | null;
  summary: string | null;
  account_id: string | null;
  contact_id: string | null;
  created_at: string;
}

interface Message {
  id: string;
  conversation_id: string | null;
  direction: string;
  message_type: string;
  text_body: string | null;
  media_caption: string | null;
  template_name: string | null;
  happened_at: string;
  meta_message_id: string;
  from_phone: string | null;
  to_phone: string | null;
}

interface WabaAccount {
  id: string;
  waba_id: string;
  phone_number_id: string | null;
  display_phone_number: string | null;
  verified_name: string | null;
  status: string;
}

export default function WhatsAppInbox() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch WABA accounts
  const { data: wabaAccounts } = useQuery({
    queryKey: ['waba-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waba_accounts_safe' as any)
        .select('*')
        .eq('status', 'active');
      if (error) throw error;
      return data as unknown as WabaAccount[];
    },
  });

  const activeWaba = wabaAccounts?.[0];

  // Fetch conversations
  const { data: conversations, isLoading: loadingConversations } = useQuery({
    queryKey: ['whatsapp-conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as Conversation[];
    },
  });

  // Fetch messages for selected conversation
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ['whatsapp-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('happened_at', { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!conversationId,
  });

  // Get selected conversation
  const selectedConversation = conversations?.find(c => c.id === conversationId);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!activeWaba?.phone_number_id || !selectedConversation?.their_phone) {
        throw new Error('No active WABA or conversation');
      }

      const { data, error } = await supabase.functions.invoke('send-whatsapp-message', {
        body: {
          phone_number_id: activeWaba.phone_number_id,
          to: selectedConversation.their_phone,
          type: 'text',
          content: { body: text },
          waba_id: activeWaba.waba_id,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to send');
      return data;
    },
    onSuccess: () => {
      setMessageInput('');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', conversationId] });
      toast.success('Message sent');
    },
    onError: (error) => {
      toast.error(`Failed to send: ${error.message}`);
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', conversationId] });
          queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    sendMessageMutation.mutate(messageInput.trim());
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'HH:mm');
  };

  const formatConversationTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'dd/MM/yy');
  };

  const getInitials = (phone: string) => {
    return phone.slice(-2);
  };

  const filteredConversations = conversations?.filter(conv =>
    conv.their_phone.includes(searchQuery) ||
    conv.summary?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Conversations List */}
      <div className="w-80 border-r border-border flex flex-col">
        {/* Search Header */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Conversations */}
        <ScrollArea className="flex-1">
          {loadingConversations ? (
            <div className="p-3 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations?.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No conversations yet</p>
            </div>
          ) : (
            <div>
              {filteredConversations?.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/whatsapp/inbox/${conv.id}`)}
                  className={`w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left ${
                    conv.id === conversationId ? 'bg-muted' : ''
                  }`}
                >
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                      {getInitials(conv.their_phone)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground truncate">
                        +{conv.their_phone}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatConversationTime(conv.last_message_at)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.summary || 'No messages'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="h-16 px-4 border-b border-border flex items-center justify-between bg-card">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                    {getInitials(selectedConversation.their_phone)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium text-foreground">
                    +{selectedConversation.their_phone}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedConversation.status === 'open' ? 'Active' : selectedConversation.status}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon">
                  <Phone className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {loadingMessages ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : ''}`}>
                      <Skeleton className="h-16 w-64 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {messages?.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-3 py-2 ${
                          msg.direction === 'outbound'
                            ? 'bg-green-600 text-white'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        {/* Message Type Indicator */}
                        {msg.message_type !== 'text' && (
                          <div className="flex items-center gap-1 text-xs opacity-75 mb-1">
                            {msg.message_type === 'image' && <ImageIcon className="w-3 h-3" />}
                            {msg.message_type === 'document' && <FileText className="w-3 h-3" />}
                            {msg.message_type === 'template' && (
                              <Badge variant="outline" className="text-xs py-0">
                                Template: {msg.template_name}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Message Body */}
                        <p className="text-sm whitespace-pre-wrap">
                          {msg.text_body || msg.media_caption || `[${msg.message_type}]`}
                        </p>

                        {/* Time and Status */}
                        <div className={`flex items-center justify-end gap-1 mt-1 ${
                          msg.direction === 'outbound' ? 'text-green-100' : 'text-muted-foreground'
                        }`}>
                          <span className="text-xs">
                            {formatMessageTime(msg.happened_at)}
                          </span>
                          {msg.direction === 'outbound' && (
                            <CheckCheck className="w-3 h-3" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-border bg-card">
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="icon">
                  <Paperclip className="w-5 h-5" />
                </Button>
                <Input
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  disabled={sendMessageMutation.isPending}
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
              <p className="text-sm">Choose a conversation from the list to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
