import { useState, useEffect } from "react";
import { Bell, FileText, Image, Zap, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBlog } from "@/hooks/useBlog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface OpportunityNotification {
  id: string;
  opportunity_id: string;
  title: string;
  message: string | null;
  sent_at: string;
  read_at: string | null;
  type: 'opportunity';
}

interface AutomationNotification {
  id: string;
  notification_type: string;
  title: string;
  message: string | null;
  article_id: string | null;
  created_at: string;
  read_at: string | null;
  type: 'automation';
}

type Notification = OpportunityNotification | AutomationNotification;

const getNotificationIcon = (notification: Notification) => {
  if (notification.type === 'opportunity') {
    return <Zap className="h-4 w-4 text-yellow-500" />;
  }
  
  const autoNotif = notification as AutomationNotification;
  switch (autoNotif.notification_type) {
    case 'article_generated':
      return <FileText className="h-4 w-4 text-primary" />;
    case 'images_generated':
      return <Image className="h-4 w-4 text-blue-500" />;
    case 'article_published':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'automation_scheduled':
      return <Zap className="h-4 w-4 text-primary" />;
    case 'automation_failed':
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    case 'article_renewed':
      return <RefreshCw className="h-4 w-4 text-blue-500" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
};

export function NotificationBell() {
  const { user } = useAuth();
  const { blog } = useBlog();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read_at).length;

  useEffect(() => {
    if (!user || !blog) return;

    async function fetchNotifications() {
      // Fetch opportunity notifications
      const { data: opportunityData } = await supabase
        .from("opportunity_notification_history")
        .select("*")
        .eq("user_id", user!.id)
        .eq("blog_id", blog!.id)
        .eq("notification_type", "in_app")
        .order("sent_at", { ascending: false })
        .limit(10);

      // Fetch automation notifications
      const { data: automationData } = await supabase
        .from("automation_notifications")
        .select("*")
        .eq("user_id", user!.id)
        .eq("blog_id", blog!.id)
        .order("created_at", { ascending: false })
        .limit(10);

      // Combine and sort by date
      const combined: Notification[] = [
        ...(opportunityData || []).map(n => ({ ...n, type: 'opportunity' as const })),
        ...(automationData || []).map(n => ({ ...n, type: 'automation' as const }))
      ].sort((a, b) => {
        const dateA = new Date(a.type === 'opportunity' ? a.sent_at : (a as AutomationNotification).created_at);
        const dateB = new Date(b.type === 'opportunity' ? b.sent_at : (b as AutomationNotification).created_at);
        return dateB.getTime() - dateA.getTime();
      }).slice(0, 20);

      setNotifications(combined);
    }

    fetchNotifications();

    // Subscribe to new opportunity notifications
    const opportunityChannel = supabase
      .channel(`opportunity_notifications_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "opportunity_notification_history",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if ((payload.new as { notification_type: string }).notification_type === "in_app") {
            const newNotif: OpportunityNotification = {
              ...(payload.new as Omit<OpportunityNotification, 'type'>),
              type: 'opportunity' as const
            };
            setNotifications((prev) => [newNotif, ...prev].slice(0, 20));
          }
        }
      )
      .subscribe();

    // Subscribe to new automation notifications
    const automationChannel = supabase
      .channel("automation_notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "automation_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif: AutomationNotification = {
            ...(payload.new as Omit<AutomationNotification, 'type'>),
            type: 'automation' as const
          };
          setNotifications((prev) => [newNotif, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(opportunityChannel);
      supabase.removeChannel(automationChannel);
    };
  }, [user, blog]);

  const markAsRead = async (notification: Notification) => {
    const table = notification.type === 'opportunity' 
      ? 'opportunity_notification_history' 
      : 'automation_notifications';
    
    await supabase
      .from(table)
      .update({ read_at: new Date().toISOString() })
      .eq("id", notification.id);

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n
      )
    );
  };

  const markAllAsRead = async () => {
    const unreadOpportunities = notifications.filter((n) => !n.read_at && n.type === 'opportunity').map((n) => n.id);
    const unreadAutomations = notifications.filter((n) => !n.read_at && n.type === 'automation').map((n) => n.id);
    
    if (unreadOpportunities.length > 0) {
      await supabase
        .from("opportunity_notification_history")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadOpportunities);
    }

    if (unreadAutomations.length > 0) {
      await supabase
        .from("automation_notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadAutomations);
    }

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
    );
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification);
    setOpen(false);
    
    if (notification.type === 'opportunity') {
      navigate("/articles?tab=opportunities");
    } else {
      const autoNotif = notification as AutomationNotification;
      if (autoNotif.article_id) {
        navigate(`/articles/${autoNotif.article_id}/edit`);
      } else {
        navigate("/articles");
      }
    }
  };

  const getNotificationDate = (notification: Notification): Date => {
    if (notification.type === 'opportunity') {
      return new Date((notification as OpportunityNotification).sent_at);
    }
    return new Date((notification as AutomationNotification).created_at);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notificações</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={markAllAsRead}
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  className={cn(
                    "w-full text-left p-4 hover:bg-muted/50 transition-colors",
                    !notification.read_at && "bg-primary/5"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      {getNotificationIcon(notification)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {!notification.read_at && (
                          <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                        <p className="font-medium text-sm truncate">
                          {notification.title}
                        </p>
                      </div>
                      {notification.message && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                          {notification.message}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(getNotificationDate(notification), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
