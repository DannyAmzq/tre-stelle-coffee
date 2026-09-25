'use client';

import Image from 'next/image';
import ScrollReveal from './ScrollReveal';
import { isImmersiveCoffeeEventEnabled } from './ImmersiveCoffeePopup';

import { IMMERSIVE_COFFEE_EVENTBRITE_URL } from '@/lib/events';

export default function FeaturedEvent() {
	// Check if the immersive coffee event is enabled
	const eventEnabled = isImmersiveCoffeeEventEnabled();

	// Don't render anything if event is not active
	if (!eventEnabled) return null;

	return (
		<section className="relative py-20 bg-soft-white overflow-hidden">
			{/* Decorative background elements */}
			<div className="absolute inset-0 z-0">
				<div className="absolute top-0 left-0 w-64 h-64 bg-secondary/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
				<div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/5 rounded-full translate-x-1/3 translate-y-1/3" />
			</div>

			<div className="container mx-auto px-4 relative z-10">
				<ScrollReveal>
					<div className="text-center mb-12">
						<span className="text-sm text-tertiary uppercase tracking-wider font-semibold mb-4 block">
							Featured Event
						</span>
						<h2 className="text-3xl md:text-5xl font-extrabold text-primary mb-4">
							Immersive Coffee Experience
						</h2>
						<p className="text-lg text-gray-600 max-w-2xl mx-auto">
							A one-of-a-kind sensory journey celebrating the art of specialty coffee
						</p>
					</div>
				</ScrollReveal>

				<div className="max-w-6xl mx-auto">
					<div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-center">
						{/* Event Image */}
						<ScrollReveal delay={0.2} className="w-full lg:w-1/2">
							<div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-secondary/20 group">
								<div className="relative aspect-[3/4] w-full max-w-md mx-auto">
									<Image
										src="/images/immersive-coffee-event.jpg"
										alt="Immersive Coffee Experience - Tre Stelle Coffee Co. - October 10, 2026"
										fill
										className="object-cover transition-transform duration-500 group-hover:scale-105"
									/>
								</div>
								{/* Overlay gradient */}
								<div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
							</div>
						</ScrollReveal>

						{/* Event Details */}
						<ScrollReveal delay={0.4} className="w-full lg:w-1/2">
							<div className="text-center lg:text-left">
								<div className="inline-flex items-center gap-2 bg-secondary/20 text-primary px-4 py-2 rounded-full mb-6">
									<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
									<span className="font-semibold">Saturday, October 10 • 6:30 PM – 8:00 PM CST</span>
								</div>

								<h3 className="text-2xl md:text-3xl font-bold text-primary mb-6">
									Hands-On Coffee Classes at Tre Stelle
								</h3>

								<p className="text-gray-700 mb-4 text-lg leading-relaxed">
									Hey coffee lovers! Join us for a unique in-person coffee experience featuring hands-on
									lessons and tasty sips. This experience is perfect for all levels — whether you&apos;re new
									to coffee or a seasoned enthusiast.
								</p>

								<p className="text-gray-700 mb-6 text-lg leading-relaxed">
									Learn from passionate coffee professionals and connect with others in the community
									during this immersive experience. Tickets are <strong>$60 per person</strong> — don&apos;t miss it!
								</p>

								<ul className="space-y-3 mb-8">
									<li className="flex items-start gap-3 text-gray-700">
										<svg className="w-6 h-6 text-secondary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
										</svg>
										<span>Latte making class where you will learn the fundamentals and refine your technique</span>
									</li>
									<li className="flex items-start gap-3 text-gray-700">
										<svg className="w-6 h-6 text-secondary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
										</svg>
										<span>Coffee cupping to taste, compare, and understand flavor profiles</span>
									</li>
									<li className="flex items-start gap-3 text-gray-700">
										<svg className="w-6 h-6 text-secondary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
										</svg>
										<span>Traditional Ethiopian Jebena experience focused on culture, ritual, and storytelling</span>
									</li>
								</ul>

								<div className="flex flex-wrap gap-4 justify-center lg:justify-start">
									<a
										href={IMMERSIVE_COFFEE_EVENTBRITE_URL}
										target="_blank"
										rel="noopener noreferrer"
										className="px-8 py-3 bg-secondary text-primary font-semibold rounded-full uppercase tracking-wide text-sm transition-all duration-300 hover:bg-primary hover:text-secondary border-2 border-secondary hover:border-primary shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
									>
										Get Tickets
									</a>
									<a
										href="/events"
										className="px-8 py-3 text-primary font-semibold rounded-full uppercase tracking-wide text-sm transition-all duration-300 hover:bg-primary hover:text-light border-2 border-primary"
									>
										View All Events
									</a>
								</div>
							</div>
						</ScrollReveal>
					</div>
				</div>
			</div>
		</section>
	);
}
