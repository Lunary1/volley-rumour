import { z } from "zod";

// Common validators
const trimmedString = z.string().trim().min(1, "Veld mag niet leeg zijn");
const username = trimmedString
  .min(2, "Gebruikersnaam moet minstens 2 tekens zijn")
  .max(50, "Gebruikersnaam is te lang");
const email = trimmedString.email("Ongeldig e-mailadres");
const password = z.string().min(6, "Wachtwoord moet minstens 6 tekens zijn");

// Auth schemas
export const signUpSchema = z
  .object({
    email,
    password,
    confirmPassword: z.string(),
    username,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Wachtwoorden komen niet overeen",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email,
  password,
});

export const updateProfileSchema = z.object({
  username: username.optional(),
  bio: trimmedString.max(500, "Bio is te lang").optional(),
  location: trimmedString.max(100, "Locatie is te lang").optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: password,
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Wachtwoorden komen niet overeen",
    path: ["confirmPassword"],
  });

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
    currentDivision: z.string().optional(),
    destinationClub: z.string().optional(),
    destinationDivision: z.string().optional(),
    description: z
      .string()
      .max(2000, "Beschrijving is te lang")
      .optional()
      .or(z.literal("")),
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
          message: "Doelclub is verplicht voor transfers",
          path: ["destinationClub"],
        });
      }
    }
  });

export const confirmRumourSchema = z.object({
  rumourId: z.string().uuid("Ongeldig rumoer ID"),
});

// Message schema
export const sendMessageSchema = z.object({
  conversationId: z.string().uuid("Ongeldig conversatie ID"),
  content: trimmedString
    .min(1, "Bericht mag niet leeg zijn")
    .max(5000, "Bericht is te lang"),
});

// Classified schema
export const createClassifiedSchema = z.object({
  title: trimmedString
    .min(5, "Titel moet minstens 5 tekens zijn")
    .max(200, "Titel is te lang"),
  description: trimmedString
    .min(10, "Beschrijving moet minstens 10 tekens zijn")
    .max(2000, "Beschrijving is te lang"),
  adType: z.enum(
    [
      "team_seeks_trainer",
      "player_seeks_team",
      "player_seeks_player",
      "team_seeks_player",
      "other",
    ],
    {
      errorMap: () => ({ message: "Ongeldig advertentietype" }),
    },
  ),
});

// Contact/Message inquiry schema
export const contactSchema = z.object({
  email,
  subject: trimmedString
    .min(5, "Onderwerp moet minstens 5 tekens zijn")
    .max(200, "Onderwerp is te lang"),
  message: trimmedString
    .min(10, "Bericht moet minstens 10 tekens zijn")
    .max(5000, "Bericht is te lang"),
});

// Vote schema
export const createVoteSchema = z.object({
  rumourId: z.string().uuid("Ongeldig rumoer ID"),
  voteType: z.enum(["upvote", "downvote"], {
    errorMap: () => ({ message: "Ongeldig stemtype" }),
  }),
});

// Block schema
export const blockUserSchema = z.object({
  blockedUserId: z.string().uuid("Ongeldig gebruiker ID"),
});
