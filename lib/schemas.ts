import { z } from "zod";
import {
  RUMOUR_DIVISIONS,
  RUMOUR_SOURCE_TYPES,
  SOURCE_URL_MAX_LENGTH,
  type RumourDivision,
  type RumourSourceType,
} from "@/lib/rumours";

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
    destinationClub: z.string().optional(),
    destinationDivision: divisionSchema.optional(),
    description: z
      .string()
      .max(2000, "Beschrijving is te lang")
      .optional()
      .or(z.literal("")),
    // Source and declarations (#67, D-003)
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
    declaredGoodFaith: z.literal(true, {
      errorMap: () => ({
        message: "Bevestig dat je dit gerucht te goeder trouw deelt",
      }),
    }),
    declaredSenior: z.literal(true, {
      errorMap: () => ({
        message:
          "Bevestig dat het gerucht over een seniorspeler of -trainer gaat",
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
