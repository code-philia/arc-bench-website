import { ArrowRightOutlined, CheckCircleFilled, CloseOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";

import { useQuickStart } from "./QuickStartContext";

type RectState = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type Placement = "left" | "right" | "up" | "down";

function rectFromElement(element: HTMLElement): RectState {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function renderSnippet(code: string) {
  return code.split(/\r?\n/).map((line, index) => (
    <div key={`${line}-${index}`} className="quick-start-code-line">
      {line || " "}
    </div>
  ));
}

export default function QuickStartOverlay() {
  const { active, currentStep, advance, finish } = useQuickStart();
  const [targetRect, setTargetRect] = useState<RectState | null>(null);

  useEffect(() => {
    if (!active || !currentStep) {
      setTargetRect(null);
      return;
    }

    setTargetRect(null);

    const updateRect = () => {
      const element = document.querySelector<HTMLElement>(`[data-quickstart-id="${currentStep.targetId}"]`);
      if (!element) {
        setTargetRect(null);
        return;
      }
      setTargetRect(rectFromElement(element));
    };

    const raf = window.requestAnimationFrame(updateRect);
    const resizeObserver = new ResizeObserver(() => updateRect());
    const element = document.querySelector<HTMLElement>(`[data-quickstart-id="${currentStep.targetId}"]`);
    if (element) {
      resizeObserver.observe(element);
    }
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [active, currentStep]);

  const cardLayout = useMemo(() => {
    if (!targetRect) {
      return {
        style: { top: 110, left: "50%", transform: "translateX(-50%)" } as const,
        arrowDirection: "right" as Placement,
      };
    }

    const cardWidth = currentStep?.id === "submission-api-doc" ? 420 : 332;
    const cardHeight = currentStep?.id === "submission-api-doc" ? 280 : 180;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gap = 28;
    const margin = 24;

    const placements: Placement[] = currentStep?.preferredPlacement
      ? [
          currentStep.preferredPlacement,
          ...(["left", "right", "up", "down"] as Placement[]).filter((item) => item !== currentStep.preferredPlacement),
        ]
      : ["right", "left", "up", "down"];

    const scorePlacement = (placement: Placement) => {
      const available = placement === "left"
        ? targetRect.left
        : placement === "right"
          ? viewportWidth - (targetRect.left + targetRect.width)
          : placement === "up"
            ? targetRect.top
            : viewportHeight - (targetRect.top + targetRect.height);

      const fits = placement === "left" || placement === "right"
        ? available >= cardWidth + gap + margin
        : available >= cardHeight + gap + margin;

      return { placement, available, fits };
    };

    const bestPlacement = placements
      .map(scorePlacement)
      .sort((a, b) => {
        if (a.fits !== b.fits) {
          return a.fits ? -1 : 1;
        }
        return b.available - a.available;
      })[0]?.placement ?? "right";

    let top = 96;
    let left = 24;

    if (bestPlacement === "left") {
      top = targetRect.top + targetRect.height * 0.5 - cardHeight * 0.5;
      left = targetRect.left - cardWidth - gap;
    } else if (bestPlacement === "right") {
      top = targetRect.top + targetRect.height * 0.5 - cardHeight * 0.5;
      left = targetRect.left + targetRect.width + gap;
    } else if (bestPlacement === "up") {
      top = targetRect.top - cardHeight - gap;
      left = targetRect.left + targetRect.width * 0.5 - cardWidth * 0.5;
    } else {
      top = targetRect.top + targetRect.height + gap;
      left = targetRect.left + targetRect.width * 0.5 - cardWidth * 0.5;
    }

    top = Math.min(Math.max(76, top), viewportHeight - cardHeight - 24);
    left = Math.min(Math.max(24, left), viewportWidth - cardWidth - 24);

    return {
      style: { top, left },
      arrowDirection:
        bestPlacement === "left" ? "right" :
        bestPlacement === "right" ? "left" :
        bestPlacement === "up" ? "down" :
        "up",
    };
  }, [currentStep?.id, currentStep?.preferredPlacement, targetRect]);

  if (!active || !currentStep) {
    return null;
  }

  return (
    <div className="quick-start-overlay" aria-hidden="false">
      {targetRect ? (
        <>
          <button
            type="button"
            className="quick-start-focus-hitbox"
            style={{
              top: targetRect.top,
              left: targetRect.left,
              width: targetRect.width,
              height: targetRect.height,
            }}
            onClick={() => {
              if (currentStep.allowTargetClick) {
                void advance();
              }
            }}
          />
        </>
      ) : null}

      <div className={`quick-start-card arrow-${cardLayout.arrowDirection}`} style={cardLayout.style}>
        <span className="quick-start-arrow quick-start-card-arrow" aria-hidden="true" />
        <button
          type="button"
          className="quick-start-close"
          aria-label="Close quick start"
          onClick={finish}
        >
          <CloseOutlined />
        </button>
        <div className="quick-start-step">{currentStep.title}</div>
        <div className="quick-start-copy">{currentStep.message}</div>
        {currentStep.codeSnippet ? (
          <pre className="quick-start-code-block"><code>{renderSnippet(currentStep.codeSnippet)}</code></pre>
        ) : null}
        <button type="button" className="quick-start-next" onClick={() => void advance()}>
          <span>{currentStep.buttonLabel}</span>
          {currentStep.buttonLabel === "Done" ? <CheckCircleFilled /> : <ArrowRightOutlined />}
        </button>
      </div>
    </div>
  );
}
