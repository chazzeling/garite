import { useEffect } from "react";
import { useEconomy } from "../store/economy";
import { useMe } from "../store/me";
import { useRoom } from "../store/room";
import { usePrivacy } from "../store/privacy";
import { useUpdate } from "../store/update";
import { useWindowPrefs } from "../store/windowPrefs";
import { UpdateBanner } from "../ui/common/UpdateBanner";
import { PokeBanner } from "../ui/common/PokeBanner";
import { ConsentDialog } from "../ui/common/ConsentDialog";
import { ProfileSetup } from "../ui/common/ProfileSetup";
import { KickedBanner } from "../ui/chat/KickedBanner";
import { ServerBanner } from "../ui/common/ServerBanner";
import { FullMode } from "../ui/modes/FullMode";
import { MediumMode } from "../ui/modes/MediumMode";
import { MiniMode } from "../ui/modes/MiniMode";
import { ensureNotificationPermission } from "./notify";
import { listenQuit } from "./quit";
import { startActivityListener } from "./activityListener";

export function App() {
  const mode = useWindowPrefs((s) => s.mode);
  const status = useMe((s) => s.status);
  const consent = usePrivacy((s) => s.appConsent);

  useEffect(() => {
    useWindowPrefs.getState().init();
    // 새 버전 확인: 켜고 10초 뒤 한 번, 이후 30분마다
    const first = setTimeout(() => void useUpdate.getState().check(), 10_000);
    const every = setInterval(() => void useUpdate.getState().check(), 30 * 60_000);
    void usePrivacy.getState().init(); // 저장된 동의 적용 (동의 전에는 프로그램을 읽지 않음)
    const unlisten = startActivityListener();
    // 종료 요청 → 방에서 나가기/닫기 → 종료
    const unlistenQuit = listenQuit(() => useRoom.getState().shutdown());
    return () => {
      clearTimeout(first);
      clearInterval(every);
      unlisten.then((fn) => fn());
      unlistenQuit.then((fn) => fn());
    };
  }, []);

  // 로그인 → 프로필 확인 → 내 방 접속
  useEffect(() => {
    void useMe
      .getState()
      .init()
      .then(() => useRoom.getState().start());
  }, []);

  // 프로필을 막 만들어 ready가 되면 내 방에 접속 (start는 겹쳐 불려도 한 번만 실행됨)
  useEffect(() => {
    if (status === "ready") {
      void useRoom.getState().start();
      void useEconomy.getState().start();
      void ensureNotificationPermission(); // 찌르기 OS 알림 권한 (처음 한 번 OS 승인 창)
    }
  }, [status]);

  // 동의를 묻는 창은 미니 모드(높이 44)에 들어가지 않으므로 먼저 최대 모드로 돌린다
  useEffect(() => {
    if (consent === null && mode === "mini") void useWindowPrefs.getState().setMode("full");
  }, [consent, mode]);

  if (status === "needsProfile") return <ProfileSetup />;
  if (mode === "mini") return <MiniMode />;
  return (
    <>
      {consent === null && <ConsentDialog />}
      <UpdateBanner />
      <PokeBanner />
      <KickedBanner />
      <ServerBanner />
      {mode === "medium" ? <MediumMode /> : <FullMode />}
    </>
  );
}
