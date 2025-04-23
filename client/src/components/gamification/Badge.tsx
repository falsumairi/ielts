import React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge as BadgeType } from '../../types/gamification';
import { BadgeRarity } from '../../types/enums';

interface BadgeProps {
  badge: BadgeType;
  isEarned?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

/**
 * Badge component for displaying achievement badges
 */
export function Badge({
  badge,
  isEarned = true,
  size = 'md',
  showTooltip = true,
  className
}: BadgeProps) {
  // Determine size class
  const sizeClass = {
    sm: 'h-12 w-12',
    md: 'h-16 w-16',
    lg: 'h-24 w-24',
  }[size];
  
  // Determine border color based on rarity
  const rarityBorderClass = isEarned ? {
    [BadgeRarity.COMMON]: 'border-gray-400',
    [BadgeRarity.UNCOMMON]: 'border-green-500',
    [BadgeRarity.RARE]: 'border-blue-500',
    [BadgeRarity.EPIC]: 'border-purple-500',
    [BadgeRarity.LEGENDARY]: 'border-amber-500',
  }[badge.rarity] : 'border-gray-300';
  
  // Determine background and opacity based on earned status
  const bgClass = isEarned 
    ? {
        [BadgeRarity.COMMON]: 'bg-gradient-to-br from-gray-200 to-gray-400',
        [BadgeRarity.UNCOMMON]: 'bg-gradient-to-br from-green-200 to-green-500',
        [BadgeRarity.RARE]: 'bg-gradient-to-br from-blue-200 to-blue-500',
        [BadgeRarity.EPIC]: 'bg-gradient-to-br from-purple-200 to-purple-600',
        [BadgeRarity.LEGENDARY]: 'bg-gradient-to-br from-amber-200 to-amber-500',
      }[badge.rarity]
    : 'bg-gray-200';
  
  const opacityClass = isEarned ? 'opacity-100' : 'opacity-50';
  
  // Define badge component
  const badgeComponent = (
    <div 
      className={cn(
        'rounded-full flex items-center justify-center border-2',
        sizeClass,
        rarityBorderClass,
        bgClass,
        opacityClass,
        className
      )}
    >
      {badge.imageUrl ? (
        <img 
          src={badge.imageUrl} 
          alt={badge.name} 
          className="h-3/4 w-3/4 object-contain" 
        />
      ) : (
        <div className="text-2xl font-bold">
          {badge.name.slice(0, 2)}
        </div>
      )}
    </div>
  );
  
  // If tooltip is disabled or the badge is not earned, return the badge without tooltip
  if (!showTooltip) {
    return badgeComponent;
  }
  
  // Otherwise, wrap in tooltip
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badgeComponent}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <div className="font-medium">{badge.name}</div>
          <div className="text-xs text-muted-foreground">{badge.description}</div>
          {!isEarned && (
            <div className="text-xs mt-1 font-medium text-primary">
              Not earned yet
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}