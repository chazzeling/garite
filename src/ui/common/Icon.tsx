// 선 아이콘 (의존성 없이 인라인 SVG). 색은 currentColor를 따른다.
const PATHS = {
  pin: <><path d="M9 4h6l-1 5 3 3v1.5H7V12l3-3-1-5z" /><path d="M12 13.5V20" /></>,
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /></>,
  bag: <><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  send: <><path d="M21 3L10 14" /><path d="M21 3l-6.5 18-4-8-8-4L21 3z" /></>,
  modeFull: <rect x="5" y="3.5" width="14" height="17" rx="2.5" />,
  modeMedium: <rect x="5" y="6.5" width="14" height="11" rx="2.5" />,
  modeMini: <rect x="4" y="10" width="16" height="4" rx="2" />,
  bell: <><path d="M6 17v-6a6 6 0 0 1 12 0v6l1.5 2h-15L6 17z" /><path d="M10 21h4" /></>,
  minus: <path d="M6 12h12" />,
  close: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
  candle: <><rect x="9" y="11" width="6" height="9" rx="1" /><path d="M12 11V9.5" /><path d="M12 3c2.2 2 2.2 4.2 0 6-2.2-1.8-2.2-4 0-6z" /></>,
  bulb: <><path d="M9.5 17h5" /><path d="M10.5 20h3" /><path d="M12 3a6 6 0 0 0-3.4 10.9c.5.4.9 1 .9 1.6V17h5v-1.5c0-.6.4-1.2.9-1.6A6 6 0 0 0 12 3z" /></>,
  lamp: <><path d="M7 4h10l2 8H5z" /><path d="M12 12v6" /><path d="M8 20h8" /></>,
  chandelier: <><path d="M12 3v5" /><path d="M4 11c0-3 3-3 8-3s8 0 8 3H4z" /><path d="M6 11v4" /><path d="M12 11v4" /><path d="M18 11v4" /><path d="M5 17h2M11 17h2M17 17h2" /></>,
  stars: <><path d="M12 3l1.7 3.9 4.2.4-3.2 2.8 1 4.1L12 12l-3.7 2.2 1-4.1-3.2-2.8 4.2-.4z" /><path d="M5 19l.6 1.5 1.5.2-1.1 1 .3 1.5L5 22.3l-1.3.9.3-1.5-1.1-1 1.5-.2z" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3-6 7-6s7 2 7 6" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 19c0-3.5 2.7-5 6-5s6 1.5 6 5" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14c3 0 5 1.3 5 4" /></>,
  door: <><path d="M6 21V4h12v17" /><path d="M4 21h16" /><circle cx="14.5" cy="12.5" r=".6" /></>,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[name]}
    </svg>
  );
}
