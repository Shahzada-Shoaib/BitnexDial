'use client';

import Script from 'next/script';
import PhoneInterface from '../../components/PhoneInterface';

export default function PhonePage() {
  return (
    <>
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



      {/* Now just render your main UI */}
      <PhoneInterface />
      <div id="PopupWindow"></div>
    </>
  );
}   
