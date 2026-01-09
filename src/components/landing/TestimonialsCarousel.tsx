import { useState, useEffect, useCallback } from "react";
import { Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import testimonial1 from "@/assets/testimonial-1.jpeg";
import testimonial2 from "@/assets/testimonial-2.jpeg";
import testimonial3 from "@/assets/testimonial-3.jpeg";
import testimonial4 from "@/assets/testimonial-4.jpeg";
import testimonial5 from "@/assets/testimonial-5.jpeg";
import testimonial6 from "@/assets/testimonial-6.jpeg";
import testimonial7 from "@/assets/testimonial-7.jpeg";

const testimonialImages = [
  testimonial1,
  testimonial2,
  testimonial3,
  testimonial4,
  testimonial5,
  testimonial6,
  testimonial7,
];

export default function TestimonialsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % testimonialImages.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + testimonialImages.length) % testimonialImages.length);
  }, []);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(nextSlide, 4000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, nextSlide]);

  const handleManualNav = (direction: 'prev' | 'next') => {
    setIsAutoPlaying(false);
    if (direction === 'prev') prevSlide();
    else nextSlide();
    // Resume auto-play after 10 seconds of inactivity
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  return (
    <section className="py-16 md:py-20 bg-gray-950">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-3 mb-10 md:mb-12">
          <Quote className="w-6 h-6 md:w-8 md:h-8 text-[hsl(43,74%,49%)]" />
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white">
            O que dizem os atletas
          </h2>
        </div>
        
        <div className="relative max-w-4xl mx-auto">
          {/* Main Carousel Container */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-[hsl(43,74%,49%)]/30">
            <div 
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
              {testimonialImages.map((img, index) => (
                <div 
                  key={index} 
                  className="min-w-full flex-shrink-0"
                >
                  <img
                    src={img}
                    alt={`Depoimento de atleta ${index + 1}`}
                    className="w-full h-auto object-contain max-h-[600px] mx-auto"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Buttons */}
          <Button
            variant="outline"
            size="icon"
            className="absolute left-2 md:-left-14 top-1/2 -translate-y-1/2 bg-black/80 border-[hsl(43,74%,49%)]/50 hover:bg-[hsl(43,74%,49%)] hover:text-black text-white rounded-full h-10 w-10 md:h-12 md:w-12"
            onClick={() => handleManualNav('prev')}
          >
            <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-2 md:-right-14 top-1/2 -translate-y-1/2 bg-black/80 border-[hsl(43,74%,49%)]/50 hover:bg-[hsl(43,74%,49%)] hover:text-black text-white rounded-full h-10 w-10 md:h-12 md:w-12"
            onClick={() => handleManualNav('next')}
          >
            <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
          </Button>

          {/* Dots Indicator */}
          <div className="flex justify-center gap-2 mt-6">
            {testimonialImages.map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 md:w-3 md:h-3 rounded-full transition-all duration-300 ${
                  index === currentIndex 
                    ? 'bg-[hsl(43,74%,49%)] w-6 md:w-8' 
                    : 'bg-gray-600 hover:bg-gray-500'
                }`}
                onClick={() => {
                  setCurrentIndex(index);
                  setIsAutoPlaying(false);
                  setTimeout(() => setIsAutoPlaying(true), 10000);
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}