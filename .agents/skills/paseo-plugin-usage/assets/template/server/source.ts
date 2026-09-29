import { readFile } from "node:fs/promises";
import {
  hashAccountKey,
  toneFromUsedPct,
  windowFromUsedPct,
  type UsageReport,
} from "@getpaseo/plugin/server/usage";
import { z } from "zod";
import { localUsageInputSchema, type LocalUsageInput } from "../shared/input";
import { buildLocalWindow } from "./local-window";

const meterSchema = z.object({
  accountRef: z.string().min(1).max(256),
  accountLabel: z.string().min(1).max(120).optional(),
  window: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
      usedActions: z.number().int().nonnegative(),
      actionLimit: z.number().int().positive(),
    })
    .optional(),
});

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === code
  );
}

async function readMeter(path: string): Promise<z.output<typeof meterSchema>> {
  return meterSchema.parse(JSON.parse(await readFile(path, "utf8")));
}

export async function discoverLocalUsage(): Promise<LocalUsageInput[]> {
  const path = process.env["PASEO_LOCAL_USAGE_FILE"];
  if (!path) {
    return [];
  }
  try {
    const meter = await readMeter(path);
    return [{ path, accountRef: meter.accountRef }];
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return [];
    }
    throw error;
  }
}

export async function identifyLocalUsage(
  value: unknown,
): Promise<{ readonly key: string; readonly label?: string } | null> {
  const input = localUsageInputSchema.parse(value);
  try {
    const meter = await readMeter(input.path);
    if (meter.accountRef !== input.accountRef) {
      return null;
    }
    return {
      key: hashAccountKey(input.accountRef),
      ...(meter.accountLabel ? { label: meter.accountLabel } : {}),
    };
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return null;
    }
    throw error;
  }
}

export async function fetchLocalUsage(value: unknown): Promise<UsageReport> {
  const input = localUsageInputSchema.parse(value);
  try {
    const meter = await readMeter(input.path);
    if (meter.accountRef !== input.accountRef) {
      return {
        status: "error",
        windows: [],
        error: "Configured account does not match the requested account.",
      };
    }
    if (!meter.window) {
      return {
        status: "available",
        windows: [],
        details: [
          {
            id: "activity",
            label: "Activity",
            value: "No local activity recorded.",
          },
        ],
      };
    }
    const localWindow = buildLocalWindow(meter.window);
    return {
      status: "available",
      windows: [
        windowFromUsedPct({
          id: "local-activity",
          label: "Local activity",
          utilizationPct: localWindow.utilizationPct,
          resetsAt: localWindow.resetsAt,
          tone: toneFromUsedPct(localWindow.utilizationPct),
          headline: true,
        }),
      ],
      details: [
        { id: "activity", label: "Activity", value: localWindow.detail },
      ],
    };
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return { status: "unavailable", windows: [] };
    }
    return {
      status: "error",
      windows: [],
      error:
        error instanceof Error ? error.message : "Unknown local meter error.",
    };
  }
}
