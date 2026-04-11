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
