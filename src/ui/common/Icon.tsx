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
