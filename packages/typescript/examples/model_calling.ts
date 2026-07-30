import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

const model = process.env.MODEL || "gpt-4.1";

export async function chatCompletionsExample(prompt: string): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "You are a coding agent." },
      { role: "user", content: prompt },
    ],
  });
  return response.choices?.[0]?.message?.content || "";
}

export async function responsesExample(prompt: string): Promise<string> {
  const response = await client.responses.create({
    model,
    instructions: "You are a coding agent.",
    input: [{ role: "user", content: prompt }],
  });
  return response.output_text || "";
}
