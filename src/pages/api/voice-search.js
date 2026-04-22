import { generateText, Output } from "ai";
import { z } from "zod";

const shoeSearchSchema = z.object({
  brand: z
    .enum(["Nike", "New Balance", "any"])
    .nullable()
    .describe("The brand of shoe to filter by"),
  subBrand: z
    .enum(["jordan", "dunk", "any"])
    .nullable()
    .describe("Sub-brand filter for Nike shoes (Jordan or Dunk)"),
  maxPrice: z
    .number()
    .nullable()
    .describe("Maximum price in dollars (e.g., 150 means under $150)"),
  color: z
    .string()
    .nullable()
    .describe(
      "Color to filter by (e.g., blue, red, black, white, green, orange, purple, pink, gray)"
    ),
  searchTerm: z
    .string()
    .nullable()
    .describe("Specific shoe name or collaboration to search for"),
  response: z
    .string()
    .describe("A friendly, concise response to show the user"),
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query } = req.body;

  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    const { output } = await generateText({
      model: "openai/gpt-4o-mini",
      output: Output.object({
        schema: shoeSearchSchema,
      }),
      messages: [
        {
          role: "system",
          content: `You are a helpful shoe finder assistant. Parse the user's natural language query to extract search filters for a shoe catalog.

Available data:
- Brands: Nike, New Balance
- Sub-brands (Nike only): Jordan (Air Jordan shoes), Dunk (Nike Dunk shoes)
- Colors: blue, red, black, white, green, orange, purple, pink, gray, yellow, teal
- Prices range from $39 to $25,000+

Guidelines:
- If user mentions "Jordan" or "Air Jordan", set brand to "Nike" and subBrand to "jordan"
- If user mentions "Dunk", set brand to "Nike" and subBrand to "dunk"
- If user says "under $X" or "less than $X", extract maxPrice as the number
- If user mentions "cheap" or "affordable", use maxPrice of 150
- Extract any color mentioned
- For specific shoe names or collaborations (Travis Scott, Off-White, etc.), put in searchTerm
- Always provide a friendly, brief response (1-2 sentences) telling the user what you're showing them`,
        },
        {
          role: "user",
          content: query,
        },
      ],
    });

    return res.status(200).json({
      success: true,
      filters: output,
    });
  } catch (error) {
    console.error("Voice search error:", error);
    return res.status(500).json({
      error: "Failed to process query",
      message: error.message,
    });
  }
}
