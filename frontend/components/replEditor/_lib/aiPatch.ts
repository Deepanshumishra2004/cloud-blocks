type Edit = { search: string; replace: string };
type AiResponse = {
  type: "chat" | "code" | "mixed";
  message: string | null;
  edits: Edit[] | null;
};

export type AiPatchResult = {
  content: string;
  response: {
    type: "chat" | "code" | "mixed";
    message: string | null;
    linesAdded: number;
    linesRemoved: number;
  };
};

export function computeAiPatch({
  responseJson,
  currentContent,
}: {
  responseJson: string;
  currentContent: string;
}): AiPatchResult {
  let parsed: AiResponse;

  try {
    const clean = responseJson.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    parsed = JSON.parse(clean) as AiResponse;
  } catch {
    return {
      content: currentContent,
      response: {
        type: "chat",
        message: responseJson.trim() || "No response",
        linesAdded: 0,
        linesRemoved: 0,
      },
    };
  }

  const edits = parsed.edits ?? [];
  let next = currentContent;
  let linesAdded = 0;
  let linesRemoved = 0;

  for (const edit of edits) {
    const idx = next.indexOf(edit.search);
    if (idx === -1) continue;
    linesRemoved += edit.search.split("\n").length;
    linesAdded += edit.replace ? edit.replace.split("\n").length : 0;
    next = next.slice(0, idx) + edit.replace + next.slice(idx + edit.search.length);
  }

  return {
    content: next,
    response: {
      type: parsed.type,
      message: parsed.message ?? null,
      linesAdded,
      linesRemoved,
    },
  };
}

export function buildFullFilePatch(previousContent: string, nextContent: string) {
  return [{ rangeOffset: 0, rangeLength: previousContent.length, text: nextContent }];
}
