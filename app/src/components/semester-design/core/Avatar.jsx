import React from 'react';
import { Icon } from './Icon.jsx';
const initials = (n = '') => n.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
/** Initials in a tinted square that follows the corner setting — never a photo, never derived from an email. Empty name → profile glyph. */
export function Avatar({ name = '', size = 40 }) {
  const l = initials(name);
  if (!l) return <Icon name="profile" size={size} />;
  return <span className="avatar" aria-hidden="true" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>{l}</span>;
}
