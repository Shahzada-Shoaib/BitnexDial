import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PhoneProvider } from "../src/phone";
import Layout from "../components/Layout";
import Script from "next/script";
import GlobalIncomingCallAlert from "../components/IncomingCallAlert";
import { CallStatusProvider } from "./context/callStatusContext";
import { QueryProviders } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  
  return (
    <html lang="en">
      <head>
        {/* UI flags for phone.js */}
        <Script id="ui-flags" strategy="beforeInteractive">
          {`
            localStorage.setItem("UiCustomDialButton", "1");
            localStorage.setItem("UiCustomAddBuddy", "1");
            localStorage.setItem("UiCustomConfigMenu", "1");
            localStorage.setItem("UiCustomSortAndFilterButton", "1");
            localStorage.setItem("UiCustomEditBuddy", "1");
            localStorage.setItem("UiCustomMediaSettings", "1");
            localStorage.setItem("UiCustomMessageAction", "1");
          `}
        </Script>

        {/* All dependencies for SIP, jQuery, Croppie, etc */}
        <Script src="https://cdn.socket.io/4.6.1/socket.io.min.js" strategy="beforeInteractive" />
        <Script src="https://dtd6jl0d42sve.cloudfront.net/lib/jquery/jquery-3.6.1.min.js" strategy="beforeInteractive" />
        <Script src="https://dtd6jl0d42sve.cloudfront.net/lib/jquery/jquery-ui-1.13.2.min.js" strategy="beforeInteractive" />
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/croppie/2.6.5/croppie.min.js" strategy="beforeInteractive" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/croppie/2.6.5/croppie.min.css" />
        <Script src="https://dtd6jl0d42sve.cloudfront.net/lib/Moment/moment-with-locales-2.24.0.min.js" strategy="beforeInteractive" />
        <Script src="https://dtd6jl0d42sve.cloudfront.net/lib/SipJS/sip-0.20.0.min.js" strategy="beforeInteractive" />

        {/* GLOBAL phone.js - ensures dialer is ready on ALL pages */}
        <Script
          src="/phone.js"
          strategy="beforeInteractive"
          id="phonejs"
        />
      </head>
<body
  className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}
  suppressHydrationWarning={true}
>
  <QueryProviders>
    <PhoneProvider>
      <CallStatusProvider>
      <Layout>
        {children}
      </Layout>
      <GlobalIncomingCallAlert />
      </CallStatusProvider>
    </PhoneProvider>
  </QueryProviders>
</body>
    </html>
  );
}