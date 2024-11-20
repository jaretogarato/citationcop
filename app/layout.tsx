import { Metadata } from 'next'
import { AuthProvider } from '@/app/contexts/auth-contexts'
import Footer from '@/components/ui/Footer'
import Navbar from '@/components/ui/Navbar'
import { Toaster } from '@/components/ui/Toasts/toaster'
import { PropsWithChildren, Suspense } from 'react'
import { getURL } from '@/utils/helpers'
import 'styles/main.css'

// Update these variables with the desired content
const title = 'Fast, accurate reference validation for academic writing.';
const description =
  'Using best-in-class tools provided by technology partners including OpenAI, Google, and Grobid, SourceVerify quickly extracts and verifies references and citations from academic papers, saving you from otherwise long and tedious work.';
const imageUrl = '/images/sourceverify-thumbnail.png';
const url = 'https://sourceverify.ai';

export const metadata: Metadata = {
  metadataBase: new URL(getURL()),
  title: title,
  description: description,
  openGraph: {
    title: title,
    description: description,
    url: url,
    images: [
      {
        url: getURL(imageUrl),
        alt: 'SourceVerify Thumbnail'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: title,
    description: description,
    images: [
      {
        url: getURL(imageUrl),
        alt: 'SourceVerify Thumbnail'
      }
    ]
  }
};

export default async function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <body className="bg-gradient-to-b from-black via-blue-950 to-gray-900">
        <AuthProvider>
        <Navbar />
        <main
          id="skip"
          className="min-h-[calc(100dvh-4rem)] md:min-h[calc(100dvh-5rem)]"
        >
          {children}
        </main>
        <Footer />
        <Suspense>
          <Toaster />
        </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}

//import { Metadata } from 'next';
//import Footer from '@/components/ui/Footer';
//import Navbar from '@/components/ui/Navbar';
//import { Toaster } from '@/components/ui/Toasts/toaster';
//import { PropsWithChildren, Suspense } from 'react';
//import { getURL } from '@/utils/helpers';
//import 'styles/main.css';

//const title = 'SourceVerify';
//const description = 'Fast, accurate reference validation for academic writing.';

//export const metadata: Metadata = {
//  metadataBase: new URL(getURL()),
//  title: title,
//  description: description,
//  openGraph: {
//    title: title,
//    description: description
//  }
//};

//export default async function RootLayout({ children }: PropsWithChildren) {
//  return (
//    <html lang="en">
//      <body className="bg-gradient-to-b from-black via-blue-950 to-gray-900">
//        <Navbar />
//        <main
//          id="skip"
//          className="min-h-[calc(100dvh-4rem)] md:min-h[calc(100dvh-5rem)]"
//        >
//          {children}
//        </main>
//        <Footer />
//        <Suspense>
//          <Toaster />
//        </Suspense>
//      </body>
//    </html>
//  );
//}
