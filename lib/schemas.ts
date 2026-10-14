import { z } from "zod";

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

// Message schema
export const sendMessageSchema = z.object({
  conversationId: z.string().uuid("Ongeldig conversatie ID"),
  content: trimmedString
    .min(1, "Bericht mag niet leeg zijn")
    .max(5000, "Bericht is te lang"),
});

