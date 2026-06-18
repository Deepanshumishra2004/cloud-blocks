"use client";

// Minimal, dependency-free markdown renderer for agent chat. Handles the subset
// models actually emit: fenced code blocks (with copy), inline code, bold,
// italic, links, headings, and bullet/numbered lists. Not a full CommonMark
// parser — intentionally small and safe (no raw HTML).

import { Fragment, type ReactNode, useState } from "react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        });
      }}
      className="text-[10px] px-1.5 py-0.5 rounded text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/40 overflow-hidden my-1.5">
      <div className="flex items-center justify-between px-2 py-0.5 border-b border-white/8 bg-white/3">
        <span className="text-[10px] font-mono text-white/30">{lang || "code"}</span>
        <CopyButton text={code} />
      </div>
      <pre className="text-[11px] leading-relaxed font-mono text-white/80 px-2.5 py-2 overflow-x-auto whitespace-pre">{code}</pre>
    </div>
  );
}

// Inline formatting: `code`, **bold**, *italic*, [text](url). Tokenized in one
// pass so the patterns don't clobber each other.
function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(<Fragment key={`${keyBase}-t${i}`}>{text.slice(last, m.index)}</Fragment>);
    const tok = m[0];
    if (tok.startsWith("`")) {
      nodes.push(
        <code key={`${keyBase}-c${i}`} className="px-1 py-0.5 rounded bg-white/10 font-mono text-[0.92em] text-(--brand)">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("**")) {
      nodes.push(<strong key={`${keyBase}-b${i}`} className="font-semibold text-white/90">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("*")) {
      nodes.push(<em key={`${keyBase}-i${i}`}>{tok.slice(1, -1)}</em>);
    } else {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok);
      if (mm) {
        // Only allow safe URL schemes — block javascript:/data: etc. (model
        // output is untrusted; an unsanitized href is an XSS vector).
        const safe = /^(https?:|mailto:|\/|#)/i.test(mm[2].trim());
        nodes.push(
          safe ? (
            <a key={`${keyBase}-l${i}`} href={mm[2]} target="_blank" rel="noopener noreferrer" className="text-(--brand) underline underline-offset-2 break-all">
              {mm[1]}
            </a>
          ) : (
            <span key={`${keyBase}-l${i}`}>{mm[1]}</span>
          ),
        );
      }
    }
    last = m.index + tok.length;
    i++;
  }
  if (last < text.length) nodes.push(<Fragment key={`${keyBase}-tEnd`}>{text.slice(last)}</Fragment>);
  return nodes;
}

export function Markdown({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;
  let key = 0;
  let listBuf: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (!listBuf) return;
    const items = listBuf.items;
    const ordered = listBuf.ordered;
    out.push(
      ordered ? (
        <ol key={`k${key++}`} className="list-decimal pl-5 space-y-0.5 my-1">
          {items.map((it, idx) => <li key={idx}>{renderInline(it, `ol${key}-${idx}`)}</li>)}
        </ol>
      ) : (
        <ul key={`k${key++}`} className="list-disc pl-5 space-y-0.5 my-1">
          {items.map((it, idx) => <li key={idx}>{renderInline(it, `ul${key}-${idx}`)}</li>)}
        </ul>
      ),
    );
    listBuf = null;
  };

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    const fence = /^```(\w+)?\s*$/.exec(line.trim());
    if (fence) {
      flushList();
      const lang = fence[1];
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) { body.push(lines[i]); i++; }
      i++; // skip closing fence
      out.push(<CodeBlock key={`k${key++}`} code={body.join("\n")} lang={lang} />);
      continue;
    }

    // heading
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      const level = heading[1].length;
      out.push(
        <p key={`k${key++}`} className={`font-semibold text-white/90 ${level <= 2 ? "text-sm" : "text-xs"} mt-1.5`}>
          {renderInline(heading[2], `h${key}`)}
        </p>,
      );
      i++;
      continue;
    }

    // list item
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (bullet || ordered) {
      const isOrdered = Boolean(ordered);
      const item = (bullet ?? ordered)![1];
      if (!listBuf || listBuf.ordered !== isOrdered) { flushList(); listBuf = { ordered: isOrdered, items: [] }; }
      listBuf.items.push(item);
      i++;
      continue;
    }

    // blank line
    if (line.trim() === "") {
      flushList();
      i++;
      continue;
    }

    // paragraph (merge consecutive non-special lines)
    flushList();
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^```/.test(lines[i].trim()) &&
      !/^#{1,4}\s/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push(
      <p key={`k${key++}`} className="whitespace-pre-wrap leading-relaxed">
        {renderInline(para.join("\n"), `p${key}`)}
      </p>,
    );
  }
  flushList();

  return <div className="text-xs text-white/75 space-y-1">{out}</div>;
}
