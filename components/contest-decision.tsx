import Link from "next/link";

/**
 * How to contest a moderation decision (DSA art. 16(5) and 17, #94). Shown
 * next to every decision the author or requester reads; the terms explain the
 * procedure under "Niet akkoord met een beslissing".
 */
export function ContestDecision() {
  return (
    <>
      {" "}
      Niet akkoord?{" "}
      <Link href="/contact" className="underline underline-offset-2">
        Laat het ons weten
      </Link>
      .
    </>
  );
}
