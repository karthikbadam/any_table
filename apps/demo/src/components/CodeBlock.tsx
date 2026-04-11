import { useCallback, useState } from "react";
import { Highlight, type PrismTheme } from "prism-react-renderer";

interface CodeBlockProps {
  code: string;
  title?: string;
}

// Empty theme: prism-react-renderer still applies `.token.<type>` classes
// from getTokenProps, but no inline colors. Actual colors come from
// styles.css using CSS variables that switch with prefers-color-scheme.
const emptyTheme: PrismTheme = {
  plain: {
    color: "inherit",
    backgroundColor: "transparent",
  },
  styles: [],
};

export function CodeBlock({ code, title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <div className="code-block">
      <div className="code-block-header">
        {title && <span className="code-block-title">{title}</span>}
        <button type="button" className="code-block-copy" onClick={handleCopy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <Highlight theme={emptyTheme} code={code} language="tsx">
        {({ className, tokens, getLineProps, getTokenProps }) => (
          <pre className={`code-block-pre ${className}`}>
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
        )}
      </Highlight>
    </div>
  );
}
