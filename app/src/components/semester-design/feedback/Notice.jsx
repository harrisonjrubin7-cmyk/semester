import React from 'react';
/** A one-line service or context notice. role=status — quiet, never a giant red banner. */
export function Notice({ head, children }) {
  return <p className="notice" role="status">{head && <strong className="notice-head">{head}</strong>}{children}</p>;
}
