import { z } from "zod";

export const tourStatusSchema = z.enum([
  "not_toured",
  "called",
  "scheduled",
  "toured",
  "rejected",
  "top_pick",
]);
export type TourStatus = z.infer<typeof tourStatusSchema>;

export const propertySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  listing_urls: z.array(z.string().url()),
  address: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  price: z.number().int().nullable(),
  beds: z.number().int().nullable(),
  baths: z.number().nullable(),
  square_feet: z.number().int().nullable(),
  photo_path: z.string().nullable(),
  tour_status: tourStatusSchema,
  star_rating: z.number().int().min(1).max(5).nullable(),
  notes: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
  rank: z.number().int().nullable(),
});
export type Property = z.infer<typeof propertySchema>;

export const propertyInsertSchema = z
  .object({
    listing_urls: z.array(z.string().url()),
    address: z.string().min(1),
    latitude: z.number(),
    longitude: z.number(),
    price: z.number().int().nullable(),
    beds: z.number().int().nullable(),
    baths: z.number().nullable(),
    square_feet: z.number().int().nullable(),
    photo_path: z.string().nullable(),
    photo_source_url: z.string().url().nullable().optional(),
    pros: z.array(z.string()).optional(),
  });
export type PropertyInsert = z.infer<typeof propertyInsertSchema>;

export const propertyPatchSchema = z.object({
  tour_status: tourStatusSchema.optional(),
  star_rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().optional(),
  pros: z.array(z.string()).optional(),
  cons: z.array(z.string()).optional(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  price: z.number().int().nullable().optional(),
  beds: z.number().int().nullable().optional(),
  baths: z.number().nullable().optional(),
  square_feet: z.number().int().nullable().optional(),
  photo_path: z.string().nullable().optional(),
  rank: z.number().int().nullable().optional(),
});
export type PropertyPatch = z.infer<typeof propertyPatchSchema>;
