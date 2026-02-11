import { useCallback, useState } from "react";
import { Highlight, themes } from "prism-react-renderer";

interface CodeBlockProps {
  code: string;
  title?: string;
}

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
      <Highlight theme={themes.nightOwl} code={code} language="tsx">
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre className="code-block-pre">
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
