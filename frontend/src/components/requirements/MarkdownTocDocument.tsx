import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import MarkdownDocument, { extractHeadings } from "./MarkdownDocument";

type MarkdownTocDocumentProps = {
  markdown: string;
  assetsBaseUrl: string;
  referencesBaseUrl: string;
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

export default function MarkdownTocDocument({
  markdown,
  assetsBaseUrl,
  referencesBaseUrl,
  tocTitle = "Contents",
  emptyText = "No sections found.",
  bodyClassName,
  tocClassName,
  scrollClassName,
  tocDataQuickstartId,
  scrollDataQuickstartId,
}: MarkdownTocDocumentProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const headings = useMemo(() => extractHeadings(markdown).filter((heading) => heading.level === 2), [markdown]);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(headings[0]?.id ?? null);

  const syncActiveHeading = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || headings.length === 0) {
      setActiveHeadingId(null);
      return;
    }

    const containerTop = container.getBoundingClientRect().top;
    const activationOffset = 12;

    let nextActiveId = headings[0]?.id ?? null;

    for (const heading of headings) {
      const element = document.getElementById(heading.id);
      if (!element) {
        continue;
      }

      const top = element.getBoundingClientRect().top - containerTop;
      if (top <= activationOffset) {
        nextActiveId = heading.id;
      } else {
        break;
      }
    }

    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 4) {
      nextActiveId = headings[headings.length - 1]?.id ?? nextActiveId;
    }

    setActiveHeadingId((current) => (current === nextActiveId ? current : nextActiveId));
  }, [headings]);

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
    setActiveHeadingId(headings[0]?.id ?? null);

    if (headings.length === 0) {
      return;
    }

    const currentHash = window.location.hash.slice(1);
    const initialHeadingId = headings.some((heading) => heading.id === currentHash) ? currentHash : headings[0].id;

    window.requestAnimationFrame(() => {
      scrollToHeading(initialHeadingId, "auto");
      setActiveHeadingId(initialHeadingId);
    });
  }, [headings, scrollToHeading]);

  return (
    <div className={joinClassNames("readme-body", bodyClassName)}>
      <aside
        className={joinClassNames("toc", tocClassName)}
        data-quickstart-id={tocDataQuickstartId}
      >
        <div className="toc-title">{tocTitle}</div>
        {headings.length === 0 ? (
          <div className="empty-state compact">{emptyText}</div>
        ) : (
          headings.map((heading) => (
            <button
              key={heading.id}
              type="button"
              className={`toc-item${activeHeadingId === heading.id ? " active" : ""}${heading.level === 3 ? " sub" : ""}`}
              onClick={() => {
                setActiveHeadingId(heading.id);
                scrollToHeading(heading.id, "auto");
                window.history.replaceState(null, "", `#${heading.id}`);
              }}
            >
              {heading.text}
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
