import React from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/layout/Layout';
import { useGamification } from '@/hooks/use-gamification';
import { useAuth } from '@/hooks/use-auth';
import { AchievementCard } from '@/components/gamification/AchievementCard';
import { Leaderboard } from '@/components/gamification/Leaderboard';
import { Badge } from '@/components/gamification/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge as BadgeType } from '../types/gamification';
import { BadgeRarity, BadgeType as BadgeTypeEnum } from '../types/enums';
import { Loader2 } from 'lucide-react';

export default function AchievementsPage() {
  const { user } = useAuth();
  const { 
    gamificationData, 
    allBadges, 
    leaderboard,
    isGamificationLoading,
    isBadgesLoading,
    isLeaderboardLoading,
    hasBadge
  } = useGamification();

  // Group badges by type
  const badgesByType = React.useMemo(() => {
    if (!allBadges) return {};
    
    return allBadges.reduce((acc, badge) => {
      const type = badge.type as BadgeTypeEnum;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(badge);
      return acc;
    }, {} as Record<BadgeTypeEnum, BadgeType[]>);
  }, [allBadges]);

  // Badge types to display in tabs
  const badgeTypes = Object.keys(badgesByType) as BadgeTypeEnum[];

  if (isGamificationLoading || isBadgesLoading || isLeaderboardLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Loading achievements...</p>
        </div>
      </Layout>
    );
  }

  if (!gamificationData || !allBadges || !leaderboard) {
    return (
      <Layout>
        <div className="text-center py-10">
          <p>No achievement data available. Please try again later.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Achievements | IELTS Exam Platform</title>
      </Helmet>

      <div className="container py-6 space-y-8">
        <h1 className="text-3xl font-bold">Achievements & Rewards</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Achievement card */}
          <div className="md:col-span-2">
            <AchievementCard 
              achievement={gamificationData.achievement}
              currentLevel={gamificationData.currentLevel}
              nextLevel={gamificationData.nextLevel}
              progress={gamificationData.levelProgress}
              badges={gamificationData.badges}
            />
          </div>
          
          {/* Leaderboard */}
          <div>
            <Leaderboard 
              entries={leaderboard} 
              currentUserId={user?.id}
            />
          </div>
        </div>
        
        {/* All badges section */}
        <Card>
          <CardHeader>
            <CardTitle>Available Badges</CardTitle>
            <CardDescription>
              Earn badges by completing activities and reaching milestones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={badgeTypes[0]}>
              <TabsList className="mb-4">
                {badgeTypes.map(type => (
                  <TabsTrigger key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {badgeTypes.map(type => (
                <TabsContent key={type} value={type} className="mt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {badgesByType[type].map(badge => (
                      <div key={badge.id} className="flex flex-col items-center">
                        <Badge 
                          badge={badge} 
                          isEarned={hasBadge(badge.id)}
                          size="lg"
                        />
                        <span className="mt-2 text-xs font-medium text-center">
                          {badge.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}