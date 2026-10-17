import { z } from "zod";
import { SOURCE_URL_MAX_LENGTH } from "@/lib/rumours";

// Confirmed transfers (#70, #82). A transfer's type is its `category`, the
// same values everywhere: the database check, resolve_rumour(), the
// /transfers tabs and the cards. Keep in sync with check_transfer_fields() in
// the migrations.
export const TRANSFER_CATEGORIES = {
  player_male: "Speler",
  player_female: "Speelster",
  trainer_male: "Trainer",
  trainer_female: "Trainster",
  player_retirement: "Speler stopt",
  trainer_retirement: "Trainer stopt",
} as const;

export type TransferCategory = keyof typeof TRANSFER_CATEGORIES;

export const TRANSFER_CATEGORY_KEYS = Object.keys(TRANSFER_CATEGORIES) as [
  TransferCategory,
  ...TransferCategory[],
];

export function isRetirement(category: string): boolean {
  return category.endsWith("_retirement");
}

/** The /transfers tabs and the types each one shows. */
export const TRANSFER_TABS = [
  { value: "all", label: "Alles", categories: null },
  {
    value: "players",
    label: "Spelers",
    categories: ["player_male", "player_female"],
  },
  {
    value: "trainers",
    label: "Trainers",
    categories: ["trainer_male", "trainer_female"],
  },
  {
    value: "retirements",
    label: "Gestopt",
    categories: ["player_retirement", "trainer_retirement"],
  },
] as const satisfies readonly {
  value: string;
  label: string;
  categories: readonly TransferCategory[] | null;
}[];

/**
 * The transfer types a rumour of this category can become when a moderator
 * confirms it. resolve_rumour() refuses any other.
 */
export function transferCategoriesFor(
  rumourCategory: string,
): TransferCategory[] {
  switch (rumourCategory) {
    case "transfer":
      return ["player_male", "player_female"];
    case "trainer_transfer":
      return ["trainer_male", "trainer_female"];
    case "player_retirement":
    case "trainer_retirement":
      return [rumourCategory];
    default:
      return [];
  }
}

/**
 * The type to preselect when confirming: from the rumour's category and the
 * gender its author gave (#67). Null when the moderator has to choose.
 */
export function defaultTransferCategory(
  rumourCategory: string,
  gender: string | null,
): TransferCategory | null {
  const options = transferCategoriesFor(rumourCategory);
  if (options.length === 1) return options[0];
  if (gender === "male")
    return options.find((c) => c.endsWith("_male")) ?? null;
  if (gender === "female")
    return options.find((c) => c.endsWith("_female")) ?? null;
  return null;
}

export const TRANSFER_NAME_MAX_LENGTH = 100;
export const CLUB_NAME_MAX_LENGTH = 100;
export const RESOLUTION_NOTE_MAX_LENGTH = 500;

/**
 * An official source (club, federation or press, D-020): an http(s) link of
 * at most 500 characters. The database checks the same in
 * checked_source_url().
 */
export const sourceUrlSchema = z
  .string()
  .trim()
  .min(1, "Geef de link naar de officiële bron")
  .max(SOURCE_URL_MAX_LENGTH, "De link is te lang")
  .regex(
    /^https?:\/\/\S+$/i,
    "Geef een link die begint met http:// of https://",
  );
