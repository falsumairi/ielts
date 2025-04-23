import React, { useEffect, useState } from 'react';
import { Bell, Check, Clock, ExternalLink, Info, Medal, Trash2, X, Sparkles, BookOpen } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';

type NotificationPriority = 'low' | 'medium' | 'high';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  isRead: boolean;
  actionLink?: string;
  createdAt: string;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // Fetch notifications
  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/notifications', { signal });
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      return response.json();
    },
    enabled: open, // Only fetch when the notification panel is open
  });

  // Fetch unread count
  const { data: unreadCount, isLoading: isCountLoading } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/count'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/notifications/count', { signal });
      if (!response.ok) {
        throw new Error('Failed to fetch unread count');
      }
      return response.json();
    },
    refetchInterval: 60000, // Refetch every minute
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
      });
      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/count'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to mark notification as read: ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive',
      });
    },
  });

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/count'] });
      toast({
        title: 'Success',
        description: 'All notifications marked as read',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to mark all notifications as read: ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive',
      });
    },
  });

  // Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/count'] });
      toast({
        title: 'Success',
        description: 'Notification deleted',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete notification: ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive',
      });
    },
  });

  // Handle notification click - mark as read and navigate if action link exists
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }

    if (notification.actionLink) {
      window.location.href = notification.actionLink;
    }
  };

  // Get priority color
  const getPriorityColor = (priority: NotificationPriority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-amber-500';
      case 'low':
      default:
        return 'bg-blue-500';
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  // Get the notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'vocabulary_review':
        return <BookOpen className="h-5 w-5 text-emerald-600" />;
      case 'test_reminder':
        return <Clock className="h-5 w-5 text-amber-500" />;
      case 'achievement':
        return <Medal className="h-5 w-5 text-yellow-500" />;
      case 'system':
        return <Info className="h-5 w-5 text-blue-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  // Get relative time
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    } else {
      return formatDate(dateString);
    }
  };

  // Group notifications by type
  const groupNotificationsByType = (notifications: Notification[] = []) => {
    return {
      all: notifications,
      unread: notifications.filter(n => !n.isRead),
      vocabulary: notifications.filter(n => n.type === 'vocabulary_review'),
      tests: notifications.filter(n => n.type === 'test_reminder'),
      achievements: notifications.filter(n => n.type === 'achievement'),
      system: notifications.filter(n => n.type === 'system')
    };
  };

  const groupedNotifications = groupNotificationsByType(notifications);
  
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell size={20} />
          {!isCountLoading && unreadCount && unreadCount.count > 0 && (
            <Badge
              className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 bg-red-500 animate-pulse"
              variant="default"
            >
              {unreadCount.count > 9 ? '9+' : unreadCount.count}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] h-screen p-0">
        <div className="flex flex-col h-full">
          <div className="p-4 border-b">
            <SheetHeader>
              <div className="flex flex-row justify-between items-center">
                <div>
                  <SheetTitle className="text-xl font-bold">Smart Notifications</SheetTitle>
                  <SheetDescription>Stay updated on your learning journey</SheetDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={markAllAsReadMutation.isPending || !notifications?.some(n => !n.isRead)}
                  onClick={() => markAllAsReadMutation.mutate()}
                >
                  {markAllAsReadMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Mark all as read
                </Button>
              </div>
            </SheetHeader>
          </div>
          
          <Tabs defaultValue="all" className="flex-1 flex flex-col">
            <div className="border-b">
              <TabsList className="w-full justify-start p-0 px-2 h-12">
                <TabsTrigger value="all" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                  All
                  {groupedNotifications.all.length > 0 && (
                    <Badge className="ml-2">{groupedNotifications.all.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="unread" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                  Unread
                  {groupedNotifications.unread.length > 0 && (
                    <Badge className="ml-2 bg-red-500">{groupedNotifications.unread.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="vocabulary" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Vocabulary
                </TabsTrigger>
                <TabsTrigger value="achievements" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                  <Medal className="h-4 w-4 mr-2" />
                  Achievements
                </TabsTrigger>
              </TabsList>
            </div>
            
            <ScrollArea className="flex-1">
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <div className="flex justify-center items-center h-32">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <TabsContent value="all" className="mt-0 space-y-0 py-2 px-4">
                      {groupedNotifications.all.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Bell className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                          <p>No notifications to display</p>
                        </div>
                      ) : (
                        groupedNotifications.all.map((notification) => (
                          <NotificationCard 
                            key={notification.id}
                            notification={notification}
                            icon={getNotificationIcon(notification.type)}
                            relativeTime={getRelativeTime(notification.createdAt)}
                            onDeleteClick={(e) => {
                              e.stopPropagation();
                              deleteNotificationMutation.mutate(notification.id);
                            }}
                            onClick={() => handleNotificationClick(notification)}
                          />
                        ))
                      )}
                    </TabsContent>
                    
                    <TabsContent value="unread" className="mt-0 space-y-0 py-2 px-4">
                      {groupedNotifications.unread.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Check className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                          <p>No unread notifications</p>
                        </div>
                      ) : (
                        groupedNotifications.unread.map((notification) => (
                          <NotificationCard 
                            key={notification.id}
                            notification={notification}
                            icon={getNotificationIcon(notification.type)}
                            relativeTime={getRelativeTime(notification.createdAt)}
                            onDeleteClick={(e) => {
                              e.stopPropagation();
                              deleteNotificationMutation.mutate(notification.id);
                            }}
                            onClick={() => handleNotificationClick(notification)}
                          />
                        ))
                      )}
                    </TabsContent>
                    
                    <TabsContent value="vocabulary" className="mt-0 space-y-0 py-2 px-4">
                      {groupedNotifications.vocabulary.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                          <p>No vocabulary notifications</p>
                        </div>
                      ) : (
                        groupedNotifications.vocabulary.map((notification) => (
                          <NotificationCard 
                            key={notification.id}
                            notification={notification}
                            icon={getNotificationIcon(notification.type)}
                            relativeTime={getRelativeTime(notification.createdAt)}
                            onDeleteClick={(e) => {
                              e.stopPropagation();
                              deleteNotificationMutation.mutate(notification.id);
                            }}
                            onClick={() => handleNotificationClick(notification)}
                          />
                        ))
                      )}
                    </TabsContent>
                    
                    <TabsContent value="achievements" className="mt-0 space-y-0 py-2 px-4">
                      {groupedNotifications.achievements.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Medal className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                          <p>No achievement notifications yet</p>
                          <p className="text-sm text-muted-foreground mt-2">Complete tests and vocabulary reviews to earn achievements</p>
                        </div>
                      ) : (
                        groupedNotifications.achievements.map((notification) => (
                          <NotificationCard 
                            key={notification.id}
                            notification={notification}
                            icon={getNotificationIcon(notification.type)}
                            relativeTime={getRelativeTime(notification.createdAt)}
                            onDeleteClick={(e) => {
                              e.stopPropagation();
                              deleteNotificationMutation.mutate(notification.id);
                            }}
                            onClick={() => handleNotificationClick(notification)}
                            highlight={true}
                          />
                        ))
                      )}
                    </TabsContent>
                  </>
                )}
              </AnimatePresence>
            </ScrollArea>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Notification Card Component
interface NotificationCardProps {
  notification: Notification;
  icon: React.ReactNode;
  relativeTime: string;
  onDeleteClick: (e: React.MouseEvent) => void;
  onClick: () => void;
  highlight?: boolean;
}

const NotificationCard: React.FC<NotificationCardProps> = ({ 
  notification, 
  icon,
  relativeTime,
  onDeleteClick,
  onClick,
  highlight = false
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        className={`mb-2 cursor-pointer transition-all hover:bg-accent/50 border-l-4 ${
          highlight 
            ? 'border-l-yellow-500' 
            : notification.isRead 
              ? 'border-l-transparent opacity-80' 
              : 'border-l-primary shadow-sm'
        }`}
        onClick={onClick}
      >
        <CardHeader className="p-3 pb-2 flex flex-row items-start gap-2">
          <div className="flex justify-between w-full items-start">
            <div className="flex gap-3">
              <div className="mt-1">{icon}</div>
              <div>
                <CardTitle className="text-base font-semibold line-clamp-1">
                  {notification.title}
                  {!notification.isRead && (
                    <span className="inline-block w-2 h-2 rounded-full bg-primary ml-2"></span>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  {relativeTime}
                </CardDescription>
              </div>
            </div>
            
            <div className="flex gap-1">
              {notification.actionLink && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = notification.actionLink!;
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/20"
                onClick={onDeleteClick}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <p className="text-sm">{notification.message}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}