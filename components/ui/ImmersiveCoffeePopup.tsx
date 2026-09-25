'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { IMMERSIVE_COFFEE_EVENTBRITE_URL } from '@/lib/events';

export function isImmersiveCoffeeEventEnabled(now: Date = new Date()): boolean {
	const override = process.env.NEXT_PUBLIC_ENABLE_IMMERSIVE_COFFEE_EVENT;
	if (override === 'true') return true;
	if (override === 'false') return false;

	// Active now through the class on October 10, 2026, then auto-hides
	const start = new Date(2026, 8, 1, 0, 0, 0, 0); // September 1, 2026
	const end = new Date(2026, 9, 10, 23, 59, 59, 999); // October 10, 2026 end of day
	return now >= start && now <= end;
}

export default function ImmersiveCoffeePopup() {
	const [isVisible, setIsVisible] = useState(false);
	const [isMounted, setIsMounted] = useState(false);

	const eventEnabled = isImmersiveCoffeeEventEnabled();

	useEffect(() => {
		// Set mounted state to true after component mounts
		setIsMounted(true);

		// Check if popup has been shown in this session
		const hasSeenPopup = sessionStorage.getItem('immersiveCoffeeEventSeen');

		if (!hasSeenPopup) {
			// Show popup after a short delay for better UX
			const timer = setTimeout(() => {
				setIsVisible(true);
			}, 2000); // Show after 2 seconds

			return () => clearTimeout(timer);
		}
	}, []);

	const handleDismiss = () => {
		setIsVisible(false);
		sessionStorage.setItem('immersiveCoffeeEventSeen', 'true');
	};

	const handleGetTickets = () => {
		sessionStorage.setItem('immersiveCoffeeEventSeen', 'true');
		window.open(IMMERSIVE_COFFEE_EVENTBRITE_URL, '_blank');
		setIsVisible(false);
	};

	// Don't render anything until component is mounted on client
	if (!eventEnabled || !isMounted || !isVisible) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			{/* Overlay */}
			<div
				className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
				onClick={handleDismiss}
			/>

			{/* Modal Content */}
			<div className="relative bg-soft-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-300">
				{/* Close Button */}
				<button
					onClick={handleDismiss}
					className="absolute top-3 right-3 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/90 shadow-lg hover:shadow-xl transition-all duration-200 text-gray-600 hover:text-gray-800 cursor-pointer"
					aria-label="Close popup"
				>
					<svg
						className="w-6 h-6"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>

				{/* Event Image */}
				<div className="relative w-full aspect-[3/4]">
					<Image
						src="/images/immersive-coffee-event.jpg"
						alt="Immersive Coffee Experience - Tre Stelle Coffee Co. - October 10, 2026"
						fill
						className="object-cover"
						priority
					/>
				</div>

				{/* Event Details */}
				<div className="px-4 pt-4 pb-2 bg-[#f5f0e8]">
					<h3 className="text-xl font-bold text-primary mb-1">Hands-On Coffee Classes</h3>
					<p className="text-sm text-gray-600 mb-2">Saturday, October 10 &bull; 6:30 PM &ndash; 8:00 PM CST</p>
					<p className="text-gray-700 text-sm">
						Join us for an immersive coffee experience with hands-on latte art lessons and tastings. All levels welcome. <strong>$60/person.</strong>
					</p>
				</div>

				{/* Action Buttons */}
				<div className="px-4 pt-2 pb-4 flex flex-col gap-3 bg-[#f5f0e8]">
					<button
						onClick={handleGetTickets}
						className="w-full bg-primary text-light font-semibold py-3 px-6 rounded-full text-center transition-all duration-300 hover:bg-tertiary transform hover:scale-105 shadow-md hover:shadow-lg cursor-pointer"
					>
						Get Tickets on Eventbrite
					</button>
					<button
						onClick={handleDismiss}
						className="w-full bg-transparent text-primary font-medium py-2 px-6 rounded-full border-2 border-primary hover:bg-primary hover:text-light transition-all duration-300 cursor-pointer"
					>
						Maybe Later
					</button>
				</div>
			</div>
		</div>
	);
}
