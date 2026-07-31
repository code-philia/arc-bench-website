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
type Point = {
  x: number;
  y: number;
};
type SpotlightPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const VIEWPORT_MARGIN = 24;
const VIEWPORT_TOP_MARGIN = 84;
const CARD_GAP = 28;
const HIGHLIGHT_PADDING = 10;

function rectFromElement(element: HTMLElement): RectState {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getSpotlightPadding(stepId?: string): SpotlightPadding {
  if (stepId === "task-list-item") {
    return { top: 10, right: 10, bottom: 2, left: 10 };
  }

  return {
    top: HIGHLIGHT_PADDING,
    right: HIGHLIGHT_PADDING,
    bottom: HIGHLIGHT_PADDING,
    left: HIGHLIGHT_PADDING,
  };
}

function getTargetAnchor(rect: RectState, placement: Placement): Point {
  if (placement === "left") {
    return { x: rect.left, y: rect.top + rect.height / 2 };
  }
  if (placement === "right") {
    return { x: rect.left + rect.width, y: rect.top + rect.height / 2 };
  }
  if (placement === "up") {
    return { x: rect.left + rect.width / 2, y: rect.top };
  }
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height };
}

function getCardAnchor(cardRect: RectState, placement: Placement): Point {
  if (placement === "left") {
    return { x: cardRect.left + cardRect.width, y: cardRect.top + cardRect.height / 2 };
  }
  if (placement === "right") {
    return { x: cardRect.left, y: cardRect.top + cardRect.height / 2 };
  }
  if (placement === "up") {
    return { x: cardRect.left + cardRect.width / 2, y: cardRect.top + cardRect.height };
  }
  return { x: cardRect.left + cardRect.width / 2, y: cardRect.top };
}

function buildConnectorPath(from: Point, to: Point, placement: Placement): string {
  if (placement === "left" || placement === "right") {
    const midX = (from.x + to.x) / 2;
    return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
  }
  const midY = (from.y + to.y) / 2;
  return `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
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
    let observedElement: HTMLElement | null = null;

    const syncTargetRect = () => {
      const element = document.querySelector<HTMLElement>(`[data-quickstart-id="${currentStep.targetId}"]`);
      if (!element) {
        if (observedElement) {
          resizeObserver.disconnect();
          observedElement = null;
        }
        setTargetRect(null);
        return;
      }

      if (observedElement !== element) {
        resizeObserver.disconnect();
        resizeObserver.observe(element);
        observedElement = element;
      }

      setTargetRect(rectFromElement(element));
    };

    const resizeObserver = new ResizeObserver(() => syncTargetRect());
    const mutationObserver = new MutationObserver(() => syncTargetRect());
    const raf = window.requestAnimationFrame(syncTargetRect);

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    window.addEventListener("resize", syncTargetRect);
    window.addEventListener("scroll", syncTargetRect, true);

    return () => {
      window.cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", syncTargetRect);
      window.removeEventListener("scroll", syncTargetRect, true);
    };
  }, [active, currentStep]);

  const overlayLayout = useMemo(() => {
    const cardWidth = currentStep?.id === "submission-api-doc" ? 420 : 332;
    const cardHeight = currentStep?.id === "submission-api-doc" ? 280 : 180;
    const spotlightPadding = getSpotlightPadding(currentStep?.id);

    if (!targetRect) {
      return {
        cardStyle: {
          top: 110,
          left: "50%",
          width: cardWidth,
          transform: "translateX(-50%)",
        } as const,
        connectorPath: null as string | null,
        targetAnchor: null as Point | null,
        spotlightStyle: null as React.CSSProperties | null,
      };
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

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
        ? available >= cardWidth + CARD_GAP + VIEWPORT_MARGIN
        : available >= cardHeight + CARD_GAP + VIEWPORT_MARGIN;

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
      left = targetRect.left - cardWidth - CARD_GAP;
    } else if (bestPlacement === "right") {
      top = targetRect.top + targetRect.height * 0.5 - cardHeight * 0.5;
      left = targetRect.left + targetRect.width + CARD_GAP;
    } else if (bestPlacement === "up") {
      top = targetRect.top - cardHeight - CARD_GAP;
      left = targetRect.left + targetRect.width * 0.5 - cardWidth * 0.5;
    } else {
      top = targetRect.top + targetRect.height + CARD_GAP;
      left = targetRect.left + targetRect.width * 0.5 - cardWidth * 0.5;
    }

    top = clamp(top, VIEWPORT_TOP_MARGIN, viewportHeight - cardHeight - VIEWPORT_MARGIN);
    left = clamp(left, VIEWPORT_MARGIN, viewportWidth - cardWidth - VIEWPORT_MARGIN);

    const cardRect: RectState = { top, left, width: cardWidth, height: cardHeight };
    const targetAnchor = getTargetAnchor(targetRect, bestPlacement);
    const cardAnchor = getCardAnchor(cardRect, bestPlacement);
    const spotlightStyle = {
      top: targetRect.top - spotlightPadding.top,
      left: targetRect.left - spotlightPadding.left,
      width: targetRect.width + spotlightPadding.left + spotlightPadding.right,
      height: targetRect.height + spotlightPadding.top + spotlightPadding.bottom,
    };

    return {
      cardStyle: { top, left, width: cardWidth },
      connectorPath: buildConnectorPath(cardAnchor, targetAnchor, bestPlacement),
      targetAnchor,
      spotlightStyle,
    };
  }, [currentStep?.id, currentStep?.preferredPlacement, targetRect]);

  if (!active || !currentStep) {
    return null;
  }

  const isPositioned = Boolean(targetRect);

  return (
    <div className="quick-start-overlay" aria-hidden="false">
      {isPositioned && overlayLayout.spotlightStyle ? (
        <div className="quick-start-spotlight" style={overlayLayout.spotlightStyle} aria-hidden="true" />
      ) : null}
      {isPositioned && overlayLayout.connectorPath && overlayLayout.targetAnchor ? (
        <svg className="quick-start-connector" aria-hidden="true">
          <path className="quick-start-connector-path" d={overlayLayout.connectorPath} />
          <circle
            className="quick-start-connector-dot"
            cx={overlayLayout.targetAnchor.x}
            cy={overlayLayout.targetAnchor.y}
            r="5"
          />
        </svg>
      ) : null}
      <div className="quick-start-blocker" aria-hidden="true" />

      {isPositioned ? (
        <div className="quick-start-card" style={overlayLayout.cardStyle}>
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
      ) : null}
    </div>
  );
}
