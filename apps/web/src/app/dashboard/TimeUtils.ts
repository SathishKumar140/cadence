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
      const date = new Date();
      
      // Create a string representation in the source timezone
      const sourceDateStr = new Intl.DateTimeFormat('en-US', {
        timeZone: sourceTz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date);
      
      // This is a bit complex with native JS. 
      // A better way for pure JS without a library:
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: sourceTz,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      });
      
      // We need to find the offset difference.
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
