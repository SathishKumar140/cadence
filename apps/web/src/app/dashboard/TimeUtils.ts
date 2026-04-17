/**
 * Converts a time range string like "18:00-19:00" from a source timezone 
 * to the user's local browser timezone.
 */
export function convertTimeRange(
  timeRange: string,
  sourceTz: string,
  localTz: string = Intl.DateTimeFormat().resolvedOptions().timeZone
): string {
  try {
    const [startS, endS] = timeRange.split('-');
    
    const convert = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      
      // We use a dummy date (today) for the conversion context
      
      // Create a string representation in the source timezone
      
      // we need to find the offset difference.
      const getOffset = (tz: string) => {
        const date = new Date();
        const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
        const tzDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
        return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60);
      };

      const sourceOffset = getOffset(sourceTz);
      const localOffset = getOffset(localTz);
      const diffMinutes = localOffset - sourceOffset;

      const totalMinutes = hours * 60 + minutes + diffMinutes;
      const newHours = (Math.floor(totalMinutes / 60) + 24) % 24;
      const newMinutes = (totalMinutes % 60 + 60) % 60;

      return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
    };

    return `${convert(startS)}-${convert(endS)}`;
  } catch (e) {
    console.error("Time conversion error:", e);
    return timeRange; // Fallback to original
  }
}
/**
 * Resolves an item's absolute date (YYYY-MM-DD).
 * Handles legacy items without dates by projecting to the current/next weekday.
 */
export function resolveItemDate(item: { day?: string; date?: string }): string {
  if (item.date && !isNaN(new Date(item.date).getTime())) {
    return item.date;
  }

  // Legacy fallback: Project to next occurrence of that weekday
  const now = new Date();
  const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const targetIdx = weekdays.indexOf(item.day?.toLowerCase() || "");
  
  if (targetIdx === -1) return 'TBA';

  const currentIdx = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon, 6=Sun
  let daysAhead = targetIdx - currentIdx;
  if (daysAhead < 0) daysAhead += 7;

  const resolvedDate = new Date();
  resolvedDate.setDate(now.getDate() + daysAhead);
  return resolvedDate.toISOString().split('T')[0];
}

/**
 * Calculates how many days an absolute date string is from "Start of Today".
 */
export function getDiffDays(dateStr: string): number {
  if (!dateStr || dateStr === 'TBA') return 999;
  
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const itemTime = new Date(dateStr).getTime();
  const msInDay = 24 * 60 * 60 * 1000;
  
  return Math.floor((itemTime - startOfToday) / msInDay);
}
