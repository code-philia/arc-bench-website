import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type Heading = {
  level: number;
  text: string;
  id: string;
};

export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractTextContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map((child) => extractTextContent(child)).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractTextContent(node.props.children);
  }
  return "";
}

export function extractHeadings(markdown: string): Heading[] {
  return markdown
    .split("\n")
    .flatMap((line) => {
      const match = /^(##|###)\s+(.+)$/.exec(line.trim());
      if (!match) {
        return [];
      }
      return [
        {
          level: match[1].length,
          text: match[2].trim(),
          id: slugify(match[2].trim()),
        },
      ];
    });
}

export default function MarkdownDocument({
  markdown,
  assetsBaseUrl,
  referencesBaseUrl,
}: {
  markdown: string;
  assetsBaseUrl: string;
  referencesBaseUrl: string;
}) {
  let rewrittenMarkdown = markdown;
  if (referencesBaseUrl) {
    rewrittenMarkdown = rewrittenMarkdown.replaceAll("(./reference/", `(${referencesBaseUrl}/`);
  }
  if (assetsBaseUrl) {
    rewrittenMarkdown = rewrittenMarkdown
      .replaceAll("(./assets/", `(${assetsBaseUrl}/`)
      .replaceAll("(assets/", `(${assetsBaseUrl}/`);
  }

  return (
    <div className="readme-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => {
            const text = extractTextContent(Children.toArray(children)).trim();
            return <h2 id={slugify(text)}>{children}</h2>;
          },
          h3: ({ children }) => {
            const text = extractTextContent(Children.toArray(children)).trim();
            return <h3 id={slugify(text)}>{children}</h3>;
          },
          img: ({ src = "", alt = "" }) => (
            <img src={src} alt={alt} className="ref-img" loading="lazy" />
          ),
        }}
      >
        {rewrittenMarkdown}
      </ReactMarkdown>
    </div>
  );
}
