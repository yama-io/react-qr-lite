import { useEffect, useRef, useState } from "react";

interface CodeBlockProps {
  code: string;
  /** Prefix every line with a "$" shell prompt. */
  prompt?: boolean;
  className?: string;
}

/** A code snippet in a mockup-code box with a copy button. */
export function CodeBlock({ code, prompt = false, className = "" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable (insecure context); silently ignore.
    }
  };

  return (
    <div className={`mockup-code relative w-full text-sm ${className}`}>
      <button
        type="button"
        className="btn btn-ghost btn-xs absolute top-2 right-2"
        onClick={copy}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      {code.split("\n").map((line, i) => (
        <pre key={i} {...(prompt ? { "data-prefix": "$" } : {})}>
          <code>{line.length > 0 ? line : " "}</code>
        </pre>
      ))}
    </div>
  );
}
