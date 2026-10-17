import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { formatDate } from "@/lib/dates";

/**
 * "5 minuten geleden", with the Belgian date and time as tooltip.
 *
 * The server and the browser render this a moment apart, so the text can
 * differ by a minute. `suppressHydrationWarning` keeps the server's text
 * instead of failing hydration and re-rendering the page (#142).
 */
export function RelativeTime({
  date,
  addSuffix = true,
}: {
  date: Date | string | number;
  addSuffix?: boolean;
}) {
  const value = new Date(date);
  return (
    <time
      dateTime={value.toISOString()}
      title={formatDate(value, "d MMM yyyy HH:mm")}
      suppressHydrationWarning
    >
      {formatDistanceToNow(value, { addSuffix, locale: nl })}
    </time>
  );
}
