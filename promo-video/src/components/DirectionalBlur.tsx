import React, {useId} from 'react';

/**
 * Motion blur уздовж однієї осі (для whip-pan). CSS blur() — ізотропний, тому
 * використовуємо SVG feGaussianBlur з різним stdDeviation по X і Y.
 */
export const DirectionalBlur: React.FC<{
  x?: number;
  y?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({x = 0, y = 0, children, style}) => {
  const id = 'dblur-' + useId().replace(/:/g, '');
  if (x < 0.3 && y < 0.3) return <div style={{position: 'absolute', inset: 0, ...style}}>{children}</div>;
  return (
    <>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={`${x} ${y}`} />
        </filter>
      </svg>
      <div style={{position: 'absolute', inset: 0, filter: `url(#${id})`, ...style}}>{children}</div>
    </>
  );
};
