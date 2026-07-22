// src/api/providers.ts
//
// What can answer, and with which models.
//
// The picker calls this instead of hardcoding a list, so a provider added to
// src/providers/index.ts shows up in the UI with no client-side change.
//
//   GET                 -> every provider + availability
//   GET ?provider=ollama -> that provider's models too

import { NextResponse } from "next/server";
import { DEFAULT_PROVIDER_ID, PROVIDERS, getProvider } from "../providers/index.js";

export async function GET(req: Request): Promise<Response> {
  try {
    const wanted = new URL(req.url).searchParams.get("provider");

    const providers = await Promise.all(
      PROVIDERS.map(async (p) => {
        const { available, reason } = await p.isAvailable();
        return {
          id: p.id,
          label: p.label,
          available,
          reason,
          dynamicModels: p.dynamicModels,
          defaultModel: p.defaultModel,
        };
      }),
    );

    if (!wanted) {
      return NextResponse.json({ providers, defaultProvider: DEFAULT_PROVIDER_ID });
    }

    const provider = getProvider(wanted);

    // A provider that is down should not fail the whole request — the picker
    // still needs to render, showing why it cannot be used.
    let models: Array<{ id: string; label?: string }> = [];
    let modelsError: string | undefined;
    try {
      models = await provider.listModels();
    } catch (error) {
      modelsError = error instanceof Error ? error.message : String(error);
    }

    return NextResponse.json({
      providers,
      defaultProvider: DEFAULT_PROVIDER_ID,
      provider: wanted,
      models,
      modelsError,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
