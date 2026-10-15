// Sections of the admin area. A section without href is not built yet and
// shows as "Binnenkort"; give it an href when its page lands.
export interface AdminSection {
  label: string;
  description: string;
  href?: string;
  /** Issue that builds the section. */
  issue: number;
}

export const adminSections: AdminSection[] = [
  {
    label: "Moderatiewachtrij",
    description: "Nieuwe geruchten goedkeuren of afwijzen.",
    href: "/admin/wachtrij",
    issue: 66,
  },
  {
    label: "Meldingen",
    description:
      "Verwijderverzoeken en gemelde geruchten, zoekertjes en gesprekken behandelen.",
    href: "/admin/meldingen",
    issue: 69,
  },
  {
    label: "Contact",
    description: "Berichten uit het contactformulier lezen en afhandelen.",
    href: "/admin/contact",
    issue: 81,
  },
  {
    label: "Gebruikers",
    description: "Gebruikers opzoeken, schorsen en rollen beheren.",
    href: "/admin/gebruikers",
    issue: 80,
  },
  {
    label: "Logboek",
    description: "Wie welke moderatieactie deed, wanneer en waarom.",
    href: "/admin/logboek",
    issue: 64,
  },
];
