import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Communication {
  id: string;
  communication_date: string;
}

interface CommunicationsHeatmapProps {
  communications: Communication[];
  selectedMonth?: Date;
}

// Week starts on Saturday (6), then Sun (0), Mon (1), Tue (2), Wed (3), Thu (4), Fri (5)
const DAY_ORDER = [6, 0, 1, 2, 3, 4, 5];
const DAY_LABELS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const CommunicationsHeatmap = ({ communications, selectedMonth }: CommunicationsHeatmapProps) => {
  const displayMonth = selectedMonth || new Date();
  const monthStart = startOfMonth(displayMonth);
  const monthEnd = endOfMonth(displayMonth);

  const activityMap = useMemo(() => {
    const map: Record<string, number> = {};
    communications.forEach((comm) => {
      const dateKey = format(new Date(comm.communication_date), 'yyyy-MM-dd');
      map[dateKey] = (map[dateKey] || 0) + 1;
    });
    return map;
  }, [communications]);

  const maxActivity = useMemo(() => {
    const values = Object.values(activityMap);
    return values.length > 0 ? Math.max(...values) : 0;
  }, [activityMap]);

  const getIntensityStyle = (count: number): React.CSSProperties => {
    if (count === 0) {
      return { 
        background: 'hsl(150 25% 91% / 0.5)',
      };
    }
    const ratio = count / Math.max(maxActivity, 1);
    const hue = 159;
    const saturation = 25 + (ratio * 57);
    const lightness = 91 - (ratio * 77);
    
    return { 
      background: `hsl(${hue} ${saturation}% ${lightness}%)`,
      boxShadow: ratio > 0.5 ? `0 0 ${6 + ratio * 4}px hsl(159 82% 14% / ${0.15 + ratio * 0.2})` : undefined,
    };
  };

  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const weeks = useMemo(() => {
    const result: (Date | null)[][] = [];
    let currentWeek: (Date | null)[] = [];
    
    const firstDay = monthDays[0];
    const firstDayOfWeek = getDay(firstDay);
    const saturdayIndex = DAY_ORDER.indexOf(firstDayOfWeek);
    
    for (let i = 0; i < saturdayIndex; i++) {
      currentWeek.push(null);
    }

    monthDays.forEach((day) => {
      const dayOfWeek = getDay(day);
      
      if (dayOfWeek === 6 && currentWeek.length > 0) {
        while (currentWeek.length < 7) {
          currentWeek.push(null);
        }
        result.push(currentWeek);
        currentWeek = [];
      }
      
      currentWeek.push(day);
    });

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      result.push(currentWeek);
    }

    return result;
  }, [monthDays]);

  const today = new Date();
  const todayKey = format(today, 'yyyy-MM-dd');
  const monthLabel = format(displayMonth, 'MMMM yyyy');

  return (
    <div className="flex flex-col h-full w-full">
      {/* Heatmap container - centered */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Month label */}
        <div className="text-xs text-muted-foreground mb-3 font-medium">{monthLabel}</div>
        
        {/* Grid + Legend row */}
        <div className="flex items-center gap-3">
          {/* Day labels column */}
          <div className="flex flex-col gap-1">
            {DAY_LABELS.map((label, idx) => (
              <div 
                key={idx} 
                className="h-[18px] text-[9px] text-muted-foreground leading-[18px] text-right flex items-center justify-end"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Weeks grid */}
          <div className="flex gap-1">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-1">
                {DAY_ORDER.map((targetDay, rowIndex) => {
                  const day = week[rowIndex];
                  
                  if (!day) {
                    return <div key={rowIndex} className="w-[18px] h-[18px] rounded-sm bg-transparent" />;
                  }
                  
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const count = activityMap[dateKey] || 0;
                  const isToday = dateKey === todayKey;

                  return (
                    <TooltipProvider key={rowIndex} delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`w-[18px] h-[18px] rounded-sm cursor-pointer transition-all duration-200 hover:scale-110 ${
                              isToday ? 'ring-1 ring-primary ring-offset-1 ring-offset-background' : ''
                            }`}
                            style={getIntensityStyle(count)}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs bg-popover backdrop-blur-lg shadow-lg z-50">
                          <div className="font-medium">{format(day, 'EEE, MMM dd')}</div>
                          <div className="text-muted-foreground">
                            {count} communication{count !== 1 ? 's' : ''}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend - right side, vertically centered */}
          <div className="flex flex-col items-center gap-1 text-[9px] text-muted-foreground pl-2">
            <span>More</span>
            <div className="flex flex-col gap-0.5">
              <div className="w-[12px] h-[12px] rounded-sm" style={{ background: 'hsl(159 82% 14%)' }} />
              <div className="w-[12px] h-[12px] rounded-sm" style={{ background: 'hsl(157 55% 52%)' }} />
              <div className="w-[12px] h-[12px] rounded-sm" style={{ background: 'hsl(150 25% 91%)' }} />
            </div>
            <span>Less</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunicationsHeatmap;