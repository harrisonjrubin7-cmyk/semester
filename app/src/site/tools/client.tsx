import { hydrateRoot } from 'react-dom/client';
import { Tool, type ToolId, type ToolProps } from './Tools';

/**
 * The one script the public site ships, and only on tool pages.
 *
 * `render.tsx` writes the tool's first render into the page along with the
 * props it used; this hydrates the same component with the same props, so the
 * markup matches and the controls come alive. Without JavaScript the page
 * still shows the tool's starting state and says it needs scripts.
 */
for (const el of document.querySelectorAll<HTMLElement>('[data-tool]')) {
  const id = el.dataset.tool as ToolId;
  const props = JSON.parse(el.dataset.props ?? '{}') as ToolProps;
  hydrateRoot(el, <Tool id={id} props={props} />);
}
