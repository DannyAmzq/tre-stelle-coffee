'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import ClientLayout from '../../components/layout/ClientLayout';
import FreeShippingBanner from '../../components/ui/FreeShippingBanner';

// Both popups are unmounted at the owner's request (Nov 2026). The components
// and their date gates are intentionally left in place — re-add the tags below
// to bring either back. Note that `isHolidayBoxEnabled` ALSO controls whether
// the Holiday Box product is listed and purchasable (FeaturedProducts,
// ProductListWithFilter, and the product page's 404 guard), so do not disable
// that flag to hide the popup — it would delist the product.

export default function InnerLayoutClient({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const isStudioPage = pathname?.startsWith('/studio');

	return (
		<>
			{!isStudioPage && <FreeShippingBanner />}
			{!isStudioPage && <Navbar />}
			{/* <SmoothScroller> - Assuming this is still intended to be commented out or handled elsewhere */}
			<ClientLayout>
				<div className={`flex-grow ${!isStudioPage ? 'mt-26 sm:mt-28' : ''}`}>{children}</div>
			</ClientLayout>
			{!isStudioPage && <Footer />}
			{/* </SmoothScroller> */}
		</>
	);
}
