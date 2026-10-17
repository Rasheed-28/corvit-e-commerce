import React from 'react';

/**
 * Shimmering skeleton loader for placeholder loading states.
 */
export const Skeleton = ({
  className = '',
  variant = 'rect',
  width,
  height,
  ...props
}) => {
  const variantClasses = {
    rect: 'rounded-lg',
    circle: 'rounded-full',
    text: 'rounded h-4 my-1',
  };

  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer bg-gray-200 ${variantClasses[variant] || 'rounded-lg'} ${className}`}
      style={style}
      {...props}
    />
  );
};
