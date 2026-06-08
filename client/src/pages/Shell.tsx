// 앱 셸 — 하단 탭바로 홈/기록/프로필 전환.
// 2단계: 홈 탭 = 새 HomeTab(자르르 중심). 기록 = 기존 Home. 프로필 = 임시.
import { useState } from "react";
import Home from "@/pages/Home";
import HomeTab from "@/pages/HomeTab";
import Hwasubun from "@/components/Hwasubun";
import BottomNav, { type MainNavTab } from "@/components/BottomNav";

function Placeholder({ title }: { title: string }) {
  return (
    <div className="min-h-screen max-w-lg mx-auto px-4 pt-24 pb-24 text-center flex flex-col items-center">
      <Hwasubun level={0.5} size={112} />
      <p className="mt-5 text-base font-medium text-gray-700">{title}</p>
      <p className="mt-1 text-sm text-gray-400">곧 여기에 만들 거예요</p>
      <p className="mt-6 text-xs font-mono text-gray-300 tracking-widest">자르르가 기다리는 중…</p>
    </div>
  );
}

export default function Shell() {
  const [tab, setTab] = useState<MainNavTab>("home");

  return (
    <>
      {tab === "home" && <HomeTab onRecord={() => setTab("records")} />}
      {tab === "records" && <Home />}
      {tab === "profile" && <Placeholder title="프로필" />}
      <BottomNav tab={tab} onChange={setTab} />
    </>
  );
}
