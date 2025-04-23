import React from 'react';
import { cn } from '@/lib/utils';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge as BadgeType } from '../../types/gamification';
import { BadgeRarity } from '../../types/enums';

interface BadgeProps {
  badge: BadgeType;
  size?: 'sm' | 'md' | 'lg';
  isEarned?: boolean;
  showTooltip?: boolean;
  className?: string;
}

/**
 * Badge component that displays a badge with optional tooltip
 */
export function Badge({ 
  badge, 
  size = 'md', 
  isEarned = true, 
  showTooltip = true,
  className 
}: BadgeProps) {
  // Size classes based on the size prop
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };
  
  // Rarity border colors
  const rarityClasses = {
    [BadgeRarity.COMMON]: 'border-gray-400',
    [BadgeRarity.UNCOMMON]: 'border-green-500',
    [BadgeRarity.RARE]: 'border-blue-500',
    [BadgeRarity.EPIC]: 'border-purple-500',
    [BadgeRarity.LEGENDARY]: 'border-amber-500',
  };
  
  // Rarity background gradients for tooltips
  const rarityBackgrounds = {
    [BadgeRarity.COMMON]: 'bg-gradient-to-r from-gray-200 to-gray-300',
    [BadgeRarity.UNCOMMON]: 'bg-gradient-to-r from-green-200 to-green-300',
    [BadgeRarity.RARE]: 'bg-gradient-to-r from-blue-200 to-blue-300',
    [BadgeRarity.EPIC]: 'bg-gradient-to-r from-purple-200 to-purple-300',
    [BadgeRarity.LEGENDARY]: 'bg-gradient-to-r from-amber-200 to-amber-300',
  };
  
  const BadgeContent = (
    <div 
      className={cn(
        'relative rounded-full overflow-hidden border-2',
        sizeClasses[size],
        isEarned 
          ? rarityClasses[badge.rarity as BadgeRarity] 
          : 'border-gray-300 opacity-50 grayscale',
        className
      )}
    >
      <img 
        src={badge.imageUrl} 
        alt={badge.name} 
        className="w-full h-full object-cover"
      />
    </div>
  );
  
  if (!showTooltip) {
    return BadgeContent;
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {BadgeContent}
        </TooltipTrigger>
        <TooltipContent 
          className={cn(
            'p-3 max-w-xs border-2',
            rarityBackgrounds[badge.rarity as BadgeRarity],
            rarityClasses[badge.rarity as BadgeRarity]
          )}
        >
          <div className="font-semibold text-sm">{badge.name}</div>
          <div className="text-xs opacity-90 mt-1">{badge.description}</div>
          <div className="text-xs mt-2 italic">
            {isEarned 
              ? `Rarity: ${badge.rarity.charAt(0).toUpperCase() + badge.rarity.slice(1)}` 
              : 'Not yet earned'}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}