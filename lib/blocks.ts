// Blocking (#73, J-07, D-018). The block_users migration refuses messages and
// new conversations between two users when either one blocked the other.

/** SQLSTATE the database raises for a message or conversation across a block. */
export const BLOCKED_ERROR_CODE = "VR008";

/** Neutral on purpose: it doesn't say who blocked whom (J-07). */
export const BLOCKED_MESSAGE = "Je kan deze gebruiker geen berichten sturen";
