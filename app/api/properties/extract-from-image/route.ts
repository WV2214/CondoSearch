import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic();

const extractionSchema = {
  type: "object",
  properties: {
    address: {
      type: ["string", "null"],
      description:
        "Full street address as shown, including unit/apt number and city/state/zip if visible. Null if no address is shown.",
    },
    price: {
      type: ["number", "null"],
      description:
        "Monthly rent in dollars as a plain integer (no $ sign, no commas). Null if no price is shown.",
    },
    beds: {
      type: ["number", "null"],
      description:
        "Number of bedrooms as an integer. 0 for studio. Null if not visible.",
    },
    baths: {
      type: ["number", "null"],
      description:
        "Number of bathrooms (may be fractional, e.g. 1.5). Null if not visible.",
    },
    square_feet: {
      type: ["number", "null"],
      description: "Square footage as an integer. Null if not visible.",
    },
  },
  required: ["address", "price", "beds", "baths", "square_feet"],
  additionalProperties: false,
} as const;

const ALLOWED_MEDIA: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not configured. Add it to .env.local and restart the dev server.",
      },
      { status: 500 },
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file" }, { status: 400 });
  }

  const incoming = (file.type || "image/png").toLowerCase();
  const mediaType = ALLOWED_MEDIA[incoming];
  if (!mediaType) {
    return NextResponse.json(
      { error: `unsupported image type: ${file.type}` },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");

  const message = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    output_config: {
      format: {
        type: "json_schema",
        schema: extractionSchema,
      },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: "text",
            text: "This screenshot is from a real estate listing. Extract the property details into the structured output. Use null for any field you cannot read clearly — do not guess.",
          },
        ],
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json(
      { error: "no text returned from model" },
      { status: 500 },
    );
  }

  let parsed: {
    address: string | null;
    price: number | null;
    beds: number | null;
    baths: number | null;
    square_feet: number | null;
  };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    return NextResponse.json(
      { error: "model output was not valid JSON" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    extracted: parsed,
    usage: {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    },
  });
}
