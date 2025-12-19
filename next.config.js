const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  scope: "/",
  sw: "sw.js",
  workboxOptions: {
    importScripts: ['/sw-push.js'],
    // 정적 HTML 랜딩 페이지는 서비스 워커에서 제외
    navigateFallbackDenylist: [/^\/landing/, /^\/peaklanding/],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://supermax.kr/paca',
  },
}

module.exports = withPWA(nextConfig)
