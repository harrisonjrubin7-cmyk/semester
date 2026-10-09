import React from 'react';
import { Icon } from './Icon.jsx';
/** Icon-only control. `label` is required — it is the accessible name and the tooltip. */
export function IconButton({ icon, label, size = 'md', pressed, ...rest }) {
  return (
    <button type="button" className={'btn btn-icon' + (size === 'sm' ? ' btn-sm' : '')} aria-label={label} title={label} aria-pressed={pressed} {...rest}>
      <Icon name={icon} size={size === 'sm' ? 16 : 19} />
    </button>
  );
}
