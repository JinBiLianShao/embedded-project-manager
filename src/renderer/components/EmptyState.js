import React from 'react';
import { Icon } from './Icon.js';

export function EmptyState({ icon = 'package', title, hint, action }) {
  return (
    <div className="empty-state">
      <Icon name={icon} size={48}/>
      <p>{title}</p>
      {hint ? <p className="text-sm text-gray-500">{hint}</p> : null}
      {action}
    </div>
  );
}
