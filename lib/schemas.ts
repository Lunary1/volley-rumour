import { z } from "zod";
import {
  RUMOUR_DIVISIONS,
  RUMOUR_SOURCE_TYPES,
  SOURCE_URL_MAX_LENGTH,
  type RumourDivision,
  type RumourSourceType,
} from "@/lib/rumours";
import {
  CLASSIFIED_DESCRIPTION_MAX_LENGTH,
  CLASSIFIED_GENDERS,
  CLASSIFIED_TYPES,
  POSITION_LABELS,
  PROVINCE_LABELS,
  TRAINER_DIPLOMA_LABELS,
  divisionMatchesGender,
  isPersonAd,
  isPlayerAd,
} from "@/lib/classifieds-utils";

// Common validators
const trimmedString = z.string().trim().min(1, "Veld mag niet leeg zijn");

// Rumour categories
export const RUMOUR_CATEGORIES = [
  "transfer",
  "trainer_transfer",
  "player_retirement",
  "trainer_retirement",
] as const;

export type RumourCategory = (typeof RUMOUR_CATEGORIES)[number];

// Helper to determine which fields are relevant per category
export function isTransferCategory(category: string): boolean {
  return category === "transfer" || category === "trainer_transfer";
}
export function isPlayerCategory(category: string): boolean {
  return category === "transfer" || category === "player_retirement";
}

const divisionSchema = z.enum(
  Object.keys(RUMOUR_DIVISIONS) as [RumourDivision, ...RumourDivision[]],
  { errorMap: () => ({ message: "Selecteer een geldig niveau" }) },
);

// Rumour schema — conditional validation based on category
export const createRumourSchema = z
  .object({
    category: z.enum(RUMOUR_CATEGORIES, {
      errorMap: () => ({ message: "Selecteer een geldig type gerucht" }),
    }),
    lastName: trimmedString
      .min(2, "Achternaam moet minstens 2 tekens zijn")
      .max(100, "Achternaam is te lang"),
    firstName: trimmedString
      .min(2, "Voornaam moet minstens 2 tekens zijn")
      .max(100, "Voornaam is te lang"),
    gender: z.enum(["male", "female"]).optional(),
    currentClub: trimmedString
      .min(1, "Huidige club is verplicht")
      .max(200, "Clubnaam is te lang"),
    currentDivision: divisionSchema.optional(),
    destinationClub: z.string().max(200, "Clubnaam is te lang").optional(),
    destinationDivision: divisionSchema.optional(),
    description: z
      .string()
      .max(2000, "Beschrijving is te lang")
      .optional()
      .or(z.literal("")),
    // Source and the rules declaration (#67, D-003, D-052)
    sourceType: z.enum(
      Object.keys(RUMOUR_SOURCE_TYPES) as [
        RumourSourceType,
        ...RumourSourceType[],
      ],
      { errorMap: () => ({ message: "Kies waar je gerucht vandaan komt" }) },
    ),
    sourceUrl: z
      .string()
      .trim()
      .max(SOURCE_URL_MAX_LENGTH, "De link is te lang")
      .regex(
        /^https?:\/\/\S+$/i,
        "Geef een geldige link op, die begint met http:// of https://",
      )
      .optional(),
    declaredRules: z.literal(true, {
      errorMap: () => ({
        message: "Bevestig dat je de regels voor geruchten volgt",
      }),
    }),
  })
  .superRefine((data, ctx) => {
    // Gender is required for player categories
    if (isPlayerCategory(data.category) && !data.gender) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Geslacht is verplicht voor spelers",
        path: ["gender"],
      });
    }

    // Destination club is required for transfer categories
    if (isTransferCategory(data.category)) {
      if (!data.destinationClub || data.destinationClub.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Vul de nieuwe club in",
          path: ["destinationClub"],
        });
      }
    }
  });

const enumOf = <T extends string>(labels: Record<T, string>, message: string) =>
  z.enum(Object.keys(labels) as [T, ...T[]], {
    errorMap: () => ({ message }),
  });

// Zoekertje schema (#71). Which fields apply depends on the type.
export const createClassifiedSchema = z
  .object({
    type: enumOf(CLASSIFIED_TYPES, "Selecteer een geldig type zoekertje"),
    firstName: z.string().trim().max(100, "Voornaam is te lang").optional(),
    lastName: z.string().trim().max(100, "Naam is te lang").optional(),
    teamName: z.string().trim().max(200, "Teamnaam is te lang").optional(),
    club: z.string().trim().max(200, "Clubnaam is te lang").optional(),
    gender: enumOf(CLASSIFIED_GENDERS, "Kies Dames of Heren"),
    position: enumOf(
      POSITION_LABELS,
      "Selecteer een geldige positie",
    ).optional(),
    diploma: enumOf(
      TRAINER_DIPLOMA_LABELS,
      "Selecteer een geldig diploma",
    ).optional(),
    division: divisionSchema,
    province: enumOf(PROVINCE_LABELS, "Selecteer een geldige provincie"),
    description: z
      .string()
      .trim()
      .max(CLASSIFIED_DESCRIPTION_MAX_LENGTH, "Beschrijving is te lang")
      .optional(),
  })
  .superRefine((data, ctx) => {
    const require = (ok: boolean, message: string, path: string) => {
      if (!ok)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });
    };

    if (isPersonAd(data.type)) {
      require((data.firstName?.length ?? 0) >=
        2, "Voornaam moet minstens 2 tekens zijn", "firstName");
      require((data.lastName?.length ?? 0) >=
        2, "Naam moet minstens 2 tekens zijn", "lastName");
    } else {
      require((data.teamName?.length ?? 0) >=
        2, "Teamnaam moet minstens 2 tekens zijn", "teamName");
    }
    if (data.type === "player_seeks_team") {
      require(!!data.club, "Clubnaam is verplicht", "club");
    }
    if (isPlayerAd(data.type)) {
      require(!!data.position, "Positie is verplicht", "position");
    }
    if (data.type === "trainer_seeks_team") {
      require(!!data.diploma, "Diploma is verplicht", "diploma");
    }
    require(divisionMatchesGender(
      data.division,
      data.gender,
    ), "Het niveau past niet bij Dames/Heren", "division");
  });

export type CreateClassifiedInput = z.infer<typeof createClassifiedSchema>;

// Accounts (#89): one password minimum for sign-up, reset and change. Supabase
// Auth enforces the same minimum (`minimum_password_length`).
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MIN_MESSAGE = `Wachtwoord moet minimaal ${PASSWORD_MIN_LENGTH} tekens zijn`;

// The sign-up trigger stores usernames in lowercase.
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

export const signUpSchema = z.object({
  username: z
    .string()
    .trim()
    .min(
      USERNAME_MIN_LENGTH,
      `Gebruikersnaam moet minimaal ${USERNAME_MIN_LENGTH} tekens zijn`,
    )
    .max(
      USERNAME_MAX_LENGTH,
      `Gebruikersnaam mag maximaal ${USERNAME_MAX_LENGTH} tekens zijn`,
    )
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Gebruik alleen letters, cijfers en _ in je gebruikersnaam",
    )
    .transform((v) => v.toLowerCase()),
  email: z.string().trim().email("Vul een geldig e-mailadres in"),
  password: z.string().min(PASSWORD_MIN_LENGTH, PASSWORD_MIN_MESSAGE),
});

export type SignUpField = keyof z.infer<typeof signUpSchema>;

// Message schema
export const sendMessageSchema = z.object({
  conversationId: z.string().uuid("Ongeldig conversatie ID"),
  content: trimmedString
    .min(1, "Bericht mag niet leeg zijn")
    .max(5000, "Bericht is te lang"),
  // The database allows an object of at most 500 characters (GHSA-fjw6).
  contactShared: z
    .object({
      email: z.string().trim().email("Ongeldig e-mailadres").max(254),
      phone: z.string().trim().max(30, "Telefoonnummer is te lang"),
    })
    .partial()
    .strict()
    .optional(),
});
