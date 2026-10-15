// The contact form (#81, D-017). Messages are stored and handled by staff at
// /admin/contact; staff answer by email, by hand.

/**
 * What a message is about. Keep in sync with the category check on
 * contact_messages in the migrations. Abuse goes through "Melden" and the
 * takedown form, not here.
 */
export const CONTACT_CATEGORIES = {
  question: "Vraag of feedback",
  account: "Mijn account of schorsing",
  privacy: "Privacy en mijn gegevens",
  partnership: "Samenwerking of pers",
  other: "Iets anders",
} as const;

export type ContactCategory = keyof typeof CONTACT_CATEGORIES;

export type ContactStatus = "open" | "handled";

export const CONTACT_NAME_MAX_LENGTH = 100;
export const CONTACT_EMAIL_MAX_LENGTH = 254;
export const CONTACT_MESSAGE_MIN_LENGTH = 10;
export const CONTACT_MESSAGE_MAX_LENGTH = 5000;
export const CONTACT_NOTE_MAX_LENGTH = 500;

/**
 * Messages per day. submit_contact_message() enforces them; keep the two in
 * sync.
 */
export const CONTACT_LIMITS = { perIp: 5, perEmail: 3 } as const;
