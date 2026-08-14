import { z } from "zod";

export const resolveReportSchema = z.object({
  status: z.enum(["REVIEWED", "DISMISSED"]),
  hidePost: z.boolean().optional(),
});

export const rejectProductSchema = z.object({
  note: z.string().trim().max(280).optional(),
});

export type ResolveReportInput = z.infer<typeof resolveReportSchema>;
export type RejectProductInput = z.infer<typeof rejectProductSchema>;
