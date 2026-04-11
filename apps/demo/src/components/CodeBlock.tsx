import { useCallback, useEffect, useState } from "react";
import { Highlight, themes } from "prism-react-renderer";

interface CodeBlockProps {
  code: string;
  title?: string;
}

function useIsDark() {
  const [dark, setDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return dark;
}

export function CodeBlock({ code, title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const isDark = useIsDark();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  const theme = isDark ? themes.nightOwl : themes.github;

  return (
    <div className="code-block">
      <div className="code-block-header">
        {title && <span className="code-block-title">{title}</span>}
        <button type="button" className="code-block-copy" onClick={handleCopy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <Highlight theme={theme} code={code} language="tsx">
        {({ style, tokens, getLineProps, getTokenProps }) => {
          // Use the theme's token colors but let the chrome's --surface
          // show through so light/dark modes stay visually consistent.
          const { backgroundColor: _bg, background: _b, ...rest } = style;
          return (
            <pre className="code-block-pre" style={rest}>
              <code>
                {tokens.map((line, i) => (
                  <div key={i} {...getLineProps({ line })}>
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </div>
                ))}
              </code>
            </pre>
          );
        }}
      </Highlight>
    </div>
  );
}
