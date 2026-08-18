import { z } from "zod";

// Xbox gamertags and PSN usernames both fit this shape in practice —
// no official character-set spec is public for either, so this stays
// permissive rather than guessing at a stricter rule that might reject
// someone's real handle.
const handleSchema = z.string().trim().min(1).max(32);

export const linkXboxSchema = z.object({ gamertag: handleSchema });
export const linkPlayStationSchema = z.object({ psnUsername: handleSchema });
