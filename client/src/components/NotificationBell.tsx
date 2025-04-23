import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell size={20} />
          {!isCountLoading && unreadCount && unreadCount.count > 0 && (
            <Badge
              className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 bg-red-500"
              variant="default"
            >
              {unreadCount.count > 9 ? '9+' : unreadCount.count}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="flex flex-row justify-between items-center pb-4 border-b">
          <SheetTitle className="text-xl font-bold">Notifications</SheetTitle>
          <Button
            variant="ghost"
            disabled={markAllAsReadMutation.isPending || !notifications?.some(n => !n.isRead)}
            onClick={() => markAllAsReadMutation.mutate()}
          >
            {markAllAsReadMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Mark all as read
          </Button>
        </SheetHeader>
        
        <div className="mt-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : notifications?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No notifications to display
            </div>
          ) : (
            notifications?.map((notification) => (
              <Card 
                key={notification.id} 
                className={`cursor-pointer transition-all ${notification.isRead ? 'opacity-70' : 'shadow-md'}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <CardHeader className="pb-2 flex flex-row items-start gap-2">
                  <div>
                    <div className="flex justify-between">
                      <CardTitle className="text-base font-semibold">
                        {notification.title}
                      </CardTitle>
                      <div 
                        className={`w-2 h-2 rounded-full ${getPriorityColor(notification.priority)}`}
                        aria-label={`Priority: ${notification.priority}`}
                      />
                    </div>
                    <CardDescription className="text-xs">
                      {formatDate(notification.createdAt)}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <p className="text-sm">{notification.message}</p>
                </CardContent>
                <CardFooter className="pt-0 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering the card click handler
                      deleteNotificationMutation.mutate(notification.id);
                    }}
                  >
                    Delete
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}