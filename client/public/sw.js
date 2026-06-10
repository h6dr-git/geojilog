// 거지로그 서비스워커 — 웹 푸시 수신/클릭.
// 푸시 내용엔 민감정보(금액)가 없다(서버 원칙). 클릭하면 앱을 연다.
self.addEventListener("push", (event) => {
  let data = { title: "김집사", body: "회장님, 장부가 기다립니다." };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch { /* 기본 카피 사용 */ }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "geojilog-daily", // 같은 태그는 갱신(중복 알림 방지)
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      return self.clients.openWindow("/");
    })
  );
});
