import React, { useMemo } from 'react';

interface HtmlAdFrameProps {
  html: string;
  title?: string;
  className?: string;
  interactive?: boolean;
}

const BASE_RESET_STYLE = `<style data-ad-reset>
html,body{margin:0!important;padding:0!important;width:100%!important;height:100%!important;overflow:hidden!important;box-sizing:border-box;}
*,*::before,*::after{box-sizing:border-box;}
</style>`;

const buildSandboxedSrcDoc = (rawHtml: string): string => {
  const trimmed = (rawHtml || '').trim();
  if (!trimmed) return '';

  const hasDocShell = /<html[\s>]/i.test(trimmed) || /<!doctype\s+html/i.test(trimmed);
  if (hasDocShell) {
    if (/<head[\s>]/i.test(trimmed)) {
      return trimmed.replace(/<head([^>]*)>/i, `<head$1>${BASE_RESET_STYLE}`);
    }
    return trimmed.replace(/<html([^>]*)>/i, `<html$1><head>${BASE_RESET_STYLE}</head>`);
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
${BASE_RESET_STYLE}
</head>
<body>${trimmed}</body>
</html>`;
};

const HtmlAdFrame: React.FC<HtmlAdFrameProps> = ({
  html,
  title = 'Reklam',
  className = '',
  interactive = false,
}) => {
  const srcDoc = useMemo(() => buildSandboxedSrcDoc(html), [html]);

  if (!srcDoc) return null;

  return (
    <iframe
      title={title}
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      scrolling="no"
      referrerPolicy="no-referrer"
      className={`w-full h-full border-0 block bg-transparent ${
        interactive ? 'pointer-events-auto' : 'pointer-events-none select-none'
      } ${className}`}
    />
  );
};

export default HtmlAdFrame;
