import Link from "next/link";

/**
 * The two declarations every user makes once (#75, D-003): on the sign-up
 * form and on /welkom. Unticked by default and required, so the browser
 * refuses to submit the form without both.
 */
export function TermsCheckboxes() {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">Leeftijd en voorwaarden</legend>
      <label className="flex items-start gap-3 text-sm text-foreground">
        <input
          type="checkbox"
          name="ageConfirmed"
          required
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
        />
        <span>Ik bevestig dat ik 16 jaar of ouder ben.</span>
      </label>
      <label className="flex items-start gap-3 text-sm text-foreground">
        <input
          type="checkbox"
          name="termsAccepted"
          required
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
        />
        <span>
          Ik aanvaard de{" "}
          <Link
            href="/voorwaarden"
            target="_blank"
            className="text-primary underline underline-offset-4"
          >
            voorwaarden
          </Link>{" "}
          en heb de{" "}
          <Link
            href="/privacy"
            target="_blank"
            className="text-primary underline underline-offset-4"
          >
            privacyverklaring
          </Link>{" "}
          gelezen.
        </span>
      </label>
    </fieldset>
  );
}
