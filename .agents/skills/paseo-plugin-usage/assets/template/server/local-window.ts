export type LocalWindowInput = {
  readonly start: string;
  readonly end: string;
  readonly usedActions: number;
  readonly actionLimit: number;
};

export type LocalWindow = {
  readonly utilizationPct: number;
  readonly resetsAt: string;
  readonly detail: string;
};

export function buildLocalWindow(input: LocalWindowInput): LocalWindow {
  return {
    utilizationPct: (input.usedActions / input.actionLimit) * 100,
    resetsAt: input.end,
    detail: `${input.usedActions} of ${input.actionLimit} local actions since ${input.start}`,
  };
}
