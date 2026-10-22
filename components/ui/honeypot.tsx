/**
 * A form field bots fill and people never see: off-screen, hidden from
 * screen readers and skipped by Tab. The server action drops a submission
 * whose `name` field has a value.
 */
export function Honeypot({
  id,
  name = "website",
}: {
  id: string;
  name?: string;
}) {
  return (
    <div
      aria-hidden
      className="absolute -left-[9999px] h-px w-px overflow-hidden"
    >
      <label htmlFor={id}>Website</label>
      <input id={id} name={name} type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}
