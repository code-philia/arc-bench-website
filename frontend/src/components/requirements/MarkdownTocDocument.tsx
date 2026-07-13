import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { RequirementNode } from "../../lib/taskTree";
import MarkdownDocument, { extractHeadings, slugify } from "./MarkdownDocument";

type TocEntry = {
  id: string;
  text: string;
  depth: number;
};

type MarkdownTocDocumentProps = {
  markdown: string;
  assetsBaseUrl: string;
  referencesBaseUrl: string;
  tocTree?: RequirementNode | null;
  tocTitle?: string;
  emptyText?: string;
  bodyClassName?: string;
  tocClassName?: string;
  scrollClassName?: string;
  tocDataQuickstartId?: string;
  scrollDataQuickstartId?: string;
};

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function flattenRequirementToc(node: RequirementNode, depth = 0): TocEntry[] {
  return node.children.flatMap((child) => ([
    {
      id: slugify(`${child.id} ${child.name}`),
      text: `${child.id} ${child.name}`,
      depth,
    },
    ...flattenRequirementToc(child, depth + 1),
  ]));
}

export default function MarkdownTocDocument({
  markdown,
  assetsBaseUrl,
  referencesBaseUrl,
  tocTree,
  tocTitle = "Contents",
  emptyText = "No sections found.",
  bodyClassName,
  tocClassName,
  scrollClassName,
  tocDataQuickstartId,
  scrollDataQuickstartId,
}: MarkdownTocDocumentProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const tocEntries = useMemo<TocEntry[]>(
    () => (tocTree ? flattenRequirementToc(tocTree) : extractHeadings(markdown).filter((heading) => heading.level >= 2).map((heading) => ({
      id: heading.id,
      text: heading.text,
      depth: Math.max(0, heading.level - 2),
    }))),
    [markdown, tocTree],
  );
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(tocEntries[0]?.id ?? null);

  const syncActiveHeading = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || tocEntries.length === 0) {
      setActiveHeadingId(null);
      return;
    }

    const containerTop = container.getBoundingClientRect().top;
    const activationOffset = 12;

    let nextActiveId = tocEntries[0]?.id ?? null;

    for (const entry of tocEntries) {
      const element = document.getElementById(entry.id);
      if (!element) {
        continue;
      }

      const top = element.getBoundingClientRect().top - containerTop;
      if (top <= activationOffset) {
        nextActiveId = entry.id;
      } else {
        break;
      }
    }

    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 4) {
      nextActiveId = tocEntries[tocEntries.length - 1]?.id ?? nextActiveId;
    }

    setActiveHeadingId((current) => (current === nextActiveId ? current : nextActiveId));
  }, [tocEntries]);

  const scrollToHeading = useCallback(
    (headingId: string, behavior: ScrollBehavior) => {
      const container = scrollContainerRef.current;
      const target = document.getElementById(headingId);
      if (!container || !target) {
        return;
      }

      const containerTop = container.getBoundingClientRect().top;
      const targetTop = target.getBoundingClientRect().top;
      const nextScrollTop = container.scrollTop + (targetTop - containerTop);

      container.scrollTo({
        top: Math.max(0, nextScrollTop),
        behavior,
      });
    },
    [],
  );

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      syncActiveHeading();
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    window.requestAnimationFrame(syncActiveHeading);

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [syncActiveHeading]);

  useEffect(() => {
    setActiveHeadingId(tocEntries[0]?.id ?? null);

    if (tocEntries.length === 0) {
      return;
    }

    const currentHash = window.location.hash.slice(1);
    const initialHeadingId = tocEntries.some((entry) => entry.id === currentHash) ? currentHash : tocEntries[0].id;

    window.requestAnimationFrame(() => {
      scrollToHeading(initialHeadingId, "auto");
      setActiveHeadingId(initialHeadingId);
    });
  }, [tocEntries, scrollToHeading]);

  return (
    <div className={joinClassNames("readme-body", bodyClassName)}>
      <aside
        className={joinClassNames("toc", tocClassName)}
        data-quickstart-id={tocDataQuickstartId}
      >
        <div className="toc-title">{tocTitle}</div>
        {tocEntries.length === 0 ? (
          <div className="empty-state compact">{emptyText}</div>
        ) : (
          tocEntries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`toc-item${activeHeadingId === entry.id ? " active" : ""}${entry.depth > 0 ? " sub" : ""}`}
              style={{ paddingLeft: `${10 + entry.depth * 16}px` }}
              onClick={() => {
                setActiveHeadingId(entry.id);
                scrollToHeading(entry.id, "auto");
                window.history.replaceState(null, "", `#${entry.id}`);
              }}
            >
              {entry.text}
            </button>
          ))
        )}
      </aside>
      <div
        ref={scrollContainerRef}
        className={joinClassNames("markdown-toc-scroll", scrollClassName)}
        data-quickstart-id={scrollDataQuickstartId}
      >
        <MarkdownDocument
          markdown={markdown}
          assetsBaseUrl={assetsBaseUrl}
          referencesBaseUrl={referencesBaseUrl}
        />
      </div>
    </div>
  );
}
