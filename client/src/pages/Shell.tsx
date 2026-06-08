// 앱 셸 — 하단 탭바로 홈/기록/프로필 전환. (3단계: 프로필 실제 구현)
import { useState } from "react";
import Home from "@/pages/Home";
import HomeTab from "@/pages/HomeTab";
import Profile from "@/pages/Profile";
import BottomNav, { type MainNavTab } from "@/components/BottomNav";

export default function Shell() {
  const [tab, setTab] = useState<MainNavTab>("home");

  return (
    <>
      {tab === "home" && <HomeTab onRecord={() => setTab("records")} />}
      {tab === "records" && <Home />}
      {tab === "profile" && <Profile onGoRecords={() => setTab("records")} />}
      <BottomNav tab={tab} onChange={setTab} />
    </>
  );
}
