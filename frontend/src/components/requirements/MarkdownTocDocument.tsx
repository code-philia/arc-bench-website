import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import type { RequirementNode } from "../../lib/taskTree";
import MarkdownDocument, { extractHeadings, extractRequirementId, slugify } from "./MarkdownDocument";

type TocEntry = {
  id: string;
  requirementId: string | null;
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
  return [
    {
      id: slugify(`${node.id} ${node.name}`),
      requirementId: node.id.toLowerCase(),
      text: `${node.id} ${node.name}`,
      depth,
    },
    ...node.children.flatMap((child) => flattenRequirementToc(child, depth + 1)),
  ];
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
  const resizeOriginRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const tocEntries = useMemo<TocEntry[]>(
    () => (tocTree ? flattenRequirementToc(tocTree) : extractHeadings(markdown).filter((heading) => heading.level >= 2).map((heading) => ({
      id: heading.id,
      requirementId: extractRequirementId(heading.text),
      text: heading.text,
      depth: Math.max(0, heading.level - 2),
    }))),
    [markdown, tocTree],
  );
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(tocEntries[0]?.id ?? null);
  const [tocWidth, setTocWidth] = useState(240);
  const [isResizingToc, setIsResizingToc] = useState(false);
  const isTocCollapsed = tocWidth <= 56;

  const findHeadingElement = useCallback((entry: TocEntry): HTMLElement | null => {
    const container = scrollContainerRef.current;
    if (!container) {
      return null;
    }

    // Scope the lookup to this document. Several requirement previews can be
    // mounted in the application, so document.getElementById can otherwise
    // select a heading from a different panel.
    const directMatch = Array.from(container.querySelectorAll<HTMLElement>("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]"))
      .find((heading) => heading.id === entry.id);
    if (directMatch) {
      return directMatch;
    }

    // Markdown is generated from YAML, but historical documents can format a
    // node title differently. The node ID remains stable, including leaf
    // nodes, and makes a reliable fallback target.
    if (entry.requirementId) {
      return Array.from(container.querySelectorAll<HTMLElement>("[data-requirement-id]"))
        .find((heading) => heading.dataset.requirementId === entry.requirementId) ?? null;
    }
    return null;
  }, []);

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
      const element = findHeadingElement(entry);
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
  }, [findHeadingElement, tocEntries]);

  const scrollToHeading = useCallback(
    (headingId: string, behavior: ScrollBehavior) => {
      const container = scrollContainerRef.current;
      const entry = tocEntries.find((candidate) => candidate.id === headingId);
      const target = entry ? findHeadingElement(entry) : null;
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
    [findHeadingElement, tocEntries],
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

  useEffect(() => {
    if (!isResizingToc) {
      return;
    }

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handlePointerMove = (event: PointerEvent) => {
      const origin = resizeOriginRef.current;
      if (!origin) {
        return;
      }

      const maxWidth = Math.min(420, Math.round(window.innerWidth * 0.42));
      const nextWidth = origin.startWidth + (event.clientX - origin.startX);
      setTocWidth(Math.max(0, Math.min(maxWidth, nextWidth)));
    };

    const handlePointerUp = () => {
      resizeOriginRef.current = null;
      setIsResizingToc(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizingToc]);

  const bodyStyle = useMemo<CSSProperties>(
    () => ({ "--toc-width": `${tocWidth}px` } as CSSProperties),
    [tocWidth],
  );

  return (
    <div
      className={joinClassNames(
        "readme-body",
        bodyClassName,
        isResizingToc ? "resizing" : undefined,
        isTocCollapsed ? "toc-collapsed" : undefined,
      )}
      style={bodyStyle}
    >
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
        className="toc-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize contents sidebar"
        onPointerDown={(event) => {
          if (window.innerWidth <= 820) {
            return;
          }
          event.preventDefault();
          resizeOriginRef.current = {
            startX: event.clientX,
            startWidth: tocWidth,
          };
          setIsResizingToc(true);
        }}
      >
        <span className="toc-resizer-handle" />
      </div>
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
