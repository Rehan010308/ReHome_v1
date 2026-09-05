const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const key = Deno.env.get("OPENROUTER_API_KEY");
    if (!key) {
      return Response.json(
        { error: "OPENROUTER_API_KEY is not set. Baseline vision remains in the client." },
        { status: 501, headers: cors }
      );
    }

    const body = await req.json();
    const image = body.image as string | undefined;
    const hint = body.visionHint ?? {};
    if (!image) {
      return Response.json({ error: "image is required" }, { status: 400, headers: cors });
    }

    const prompt = `You are ReHome intelligence. Analyze this unused household item.
Vision detector hint (may be wrong): ${JSON.stringify(hint)}

Return ONLY JSON with keys:
category, subCategory, itemType, condition, reusability, potentialUse, confidence (0-100 number),
destinationPath (one of: Direct reuse / donation, Refurbishment, Recycling, Responsible disposal),
whoMightNeed (short).

Prefer extending useful life over recycling.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("OPENROUTER_MODEL") ?? "openai/gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return Response.json({ error: "Upstream model error", detail }, { status: 502, headers: cors });
    }

    const payload = await response.json();
    const text = payload.choices?.[0]?.message?.content ?? "";
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd < 0) {
      return Response.json({ error: "Model did not return JSON" }, { status: 502, headers: cors });
    }
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    return Response.json(parsed, { headers: cors });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500, headers: cors }
    );
  }
});
