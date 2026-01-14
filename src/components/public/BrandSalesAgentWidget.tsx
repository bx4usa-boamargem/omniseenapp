import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, User, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface BrandSalesAgentWidgetProps {
  blogId: string;
  articleId?: string;
  articleTitle?: string;
  agentConfig: {
    is_enabled: boolean;
    agent_name: string;
    agent_avatar_url?: string | null;
    welcome_message: string;
    proactive_delay_seconds: number;
  };
  businessProfile?: {
    company_name?: string;
    logo_url?: string | null;
  } | null;
  primaryColor?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Generate a unique visitor ID
const getVisitorId = (): string => {
  const key = 'omniseen_visitor_id';
  let visitorId = localStorage.getItem(key);
  if (!visitorId) {
    visitorId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(key, visitorId);
  }
  return visitorId;
};

// Generate a session ID (resets on page reload)
const getSessionId = (): string => {
  const key = 'omniseen_session_id';
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = `s_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
};

// Get UTM params from URL
const getUtmParams = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    utm_source: urlParams.get('utm_source') || undefined,
    utm_medium: urlParams.get('utm_medium') || undefined,
    utm_campaign: urlParams.get('utm_campaign') || undefined,
  };
};

export function BrandSalesAgentWidget({
  blogId,
  articleId,
  articleTitle,
  agentConfig,
  businessProfile,
  primaryColor = '#6366f1',
}: BrandSalesAgentWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showProactive, setShowProactive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const visitorId = useRef(getVisitorId());
  const sessionId = useRef(getSessionId());
  const utmParams = useRef(getUtmParams());

  // Show proactive message after delay
  useEffect(() => {
    if (!agentConfig.is_enabled) return;
    
    const timer = setTimeout(() => {
      if (!isOpen && messages.length === 0) {
        setShowProactive(true);
      }
    }, (agentConfig.proactive_delay_seconds || 5) * 1000);

    return () => clearTimeout(timer);
  }, [agentConfig.is_enabled, agentConfig.proactive_delay_seconds, isOpen, messages.length]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Load existing conversation from localStorage
  useEffect(() => {
    const key = `omniseen_chat_${blogId}_${sessionId.current}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setMessages(data.messages || []);
        setConversationId(data.conversationId || null);
      } catch (e) {
        console.error('Failed to load saved conversation:', e);
      }
    }
  }, [blogId]);

  // Save conversation to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      const key = `omniseen_chat_${blogId}_${sessionId.current}`;
      localStorage.setItem(key, JSON.stringify({ messages, conversationId }));
    }
  }, [messages, conversationId, blogId]);

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: messageText.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setShowProactive(false);

    try {
      const { data, error } = await supabase.functions.invoke('brand-sales-agent', {
        body: {
          blog_id: blogId,
          article_id: articleId,
          article_title: articleTitle,
          visitor_id: visitorId.current,
          session_id: sessionId.current,
          message: messageText.trim(),
          ...utmParams.current,
        },
      });

      if (error) {
        console.error('Chat error:', error);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Desculpe, estou com dificuldades técnicas. Pode tentar novamente em alguns segundos?',
        }]);
      } else if (data) {
        if (data.conversation_id) {
          setConversationId(data.conversation_id);
        }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message || 'Desculpe, não consegui processar sua mensagem.',
        }]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro. Tente novamente.',
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [blogId, articleId, articleTitle, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleOpen = () => {
    setIsOpen(true);
    setShowProactive(false);
    
    // Send welcome message if first interaction
    if (messages.length === 0 && agentConfig.welcome_message) {
      setMessages([{ role: 'assistant', content: agentConfig.welcome_message }]);
    }
  };

  const handleProactiveClick = () => {
    handleOpen();
  };

  if (!agentConfig.is_enabled) {
    return null;
  }

  const agentInitial = agentConfig.agent_name?.charAt(0).toUpperCase() || 'C';

  return (
    <>
      {/* Proactive bubble */}
      {showProactive && !isOpen && (
        <div 
          className="fixed bottom-24 right-4 z-50 animate-in slide-in-from-right-5 fade-in duration-300"
          onClick={handleProactiveClick}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 max-w-[280px] cursor-pointer hover:shadow-2xl transition-shadow"
          >
            <button 
              onClick={(e) => { e.stopPropagation(); setShowProactive(false); }}
              className="absolute -top-2 -right-2 bg-gray-100 dark:bg-gray-700 rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <X className="h-3 w-3 text-gray-500" />
            </button>
            <div className="flex items-start gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                {agentConfig.agent_avatar_url ? (
                  <img src={agentConfig.agent_avatar_url} alt={agentConfig.agent_name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  agentInitial
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{agentConfig.agent_name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  {agentConfig.welcome_message?.substring(0, 60)}...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat widget button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-110 active:scale-95"
          style={{ backgroundColor: primaryColor }}
          aria-label="Abrir chat"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-6rem)] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
          {/* Header */}
          <div 
            className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700"
            style={{ backgroundColor: `${primaryColor}10` }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {agentConfig.agent_avatar_url ? (
                  <img src={agentConfig.agent_avatar_url} alt={agentConfig.agent_name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  agentInitial
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{agentConfig.agent_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {businessProfile?.company_name || 'Online agora'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Minimizar chat"
            >
              <Minimize2 className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-2",
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-xs shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {agentInitial}
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                    msg.role === 'user'
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-br-md'
                      : 'text-white rounded-bl-md'
                  )}
                  style={msg.role === 'assistant' ? { backgroundColor: primaryColor } : undefined}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-xs shrink-0"
                  style={{ backgroundColor: primaryColor }}
                >
                  {agentInitial}
                </div>
                <div 
                  className="rounded-2xl rounded-bl-md px-4 py-3 text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Digite sua mensagem..."
                disabled={isLoading}
                className="flex-1 text-base"
              />
              <Button
                type="submit"
                disabled={!input.trim() || isLoading}
                size="icon"
                style={{ backgroundColor: primaryColor }}
                className="hover:opacity-90"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
