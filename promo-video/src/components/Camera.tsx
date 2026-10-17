import React, {createContext, useContext} from 'react';
import {AbsoluteFill} from 'remotion';

/**
 * Віртуальна камера. Уся сцена живе всередині неї; рух камери — це
 * scale (наїзд / від'їзд), x/y (панорама), rotate (крен) і rotateX/Y (нахил).
 * Шари <Parallax depth> усередині рухаються з різною швидкістю:
 *   depth < 1 — фон (повільніше за камеру), depth > 1 — передній план (швидше).
 */
export type CameraState = {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  rotateX: number;
  rotateY: number;
};

const identity: CameraState = {x: 0, y: 0, scale: 1, rotate: 0, rotateX: 0, rotateY: 0};
const CameraContext = createContext<CameraState>(identity);

export const Camera: React.FC<
  Partial<CameraState> & {
    children: React.ReactNode;
    perspective?: number;
    /** Точка, у яку «дивиться» камера (для наїзду в конкретну точку), у px від центру. */
    originX?: number;
    originY?: number;
    style?: React.CSSProperties;
  }
> = ({children, perspective = 1600, originX = 0, originY = 0, style, ...cam}) => {
  const c = {...identity, ...cam};
  return (
    <CameraContext.Provider value={c}>
      <AbsoluteFill
        style={{
          transformOrigin: `calc(50% + ${originX}px) calc(50% + ${originY}px)`,
          transform: `perspective(${perspective}px) translate3d(${c.x}px, ${c.y}px, 0) rotateX(${c.rotateX}deg) rotateY(${c.rotateY}deg) rotate(${c.rotate}deg) scale(${c.scale})`,
          ...style,
        }}
      >
        {children}
      </AbsoluteFill>
    </CameraContext.Provider>
  );
};

export const useCamera = () => useContext(CameraContext);

/** Шар паралаксу: додатково зсуває/масштабує вміст відносно камери. */
export const Parallax: React.FC<{
  depth: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({depth, children, style}) => {
  const cam = useCamera();
  const k = depth - 1;
  // загальний зсув шару = cam.x * depth; камера вже дала cam.x
  const dx = cam.x * k;
  const dy = cam.y * k;
  const totalScale = 1 + (cam.scale - 1) * depth;
  const extraScale = totalScale / cam.scale;
  return (
    <AbsoluteFill
      style={{
        transform: `translate3d(${dx}px, ${dy}px, 0) scale(${extraScale})`,
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
