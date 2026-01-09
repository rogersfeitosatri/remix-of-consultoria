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
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  return (
    <section className="py-12 md:py-16 bg-gray-950">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-3 mb-8 md:mb-10">
          <Quote className="w-5 h-5 md:w-6 md:h-6 text-[hsl(43,74%,49%)]" />
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white">
            O que dizem os atletas
          </h2>
        </div>
        
        <div className="relative w-full max-w-xs sm:max-w-sm mx-auto flex flex-col items-center">
          {/* Main Carousel Container with Fade */}
          <div className="relative overflow-hidden rounded-xl bg-gray-900 p-2 sm:p-3 w-full">
            <div className="relative aspect-[9/16] w-full max-h-[350px] sm:max-h-[400px] flex items-center justify-center rounded-lg border border-gray-600/50 bg-gray-800/50 p-2">
              {testimonialImages.map((img, index) => (
                <div 
                  key={index} 
                  className={`absolute inset-2 flex items-center justify-center transition-opacity duration-500 ease-in-out ${
                    index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                  }`}
                >
                  <img
                    src={img}
                    alt={`Depoimento de atleta ${index + 1}`}
                    className="max-w-full max-h-full object-contain rounded-md"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Buttons */}
          <Button
            variant="outline"
            size="icon"
            className="absolute left-0 sm:-left-4 md:-left-12 top-1/2 -translate-y-1/2 bg-black/80 border-[hsl(43,74%,49%)]/50 hover:bg-[hsl(43,74%,49%)] hover:text-black text-white rounded-full h-8 w-8 md:h-10 md:w-10 z-20"
            onClick={() => handleManualNav('prev')}
          >
            <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-0 sm:-right-4 md:-right-12 top-1/2 -translate-y-1/2 bg-black/80 border-[hsl(43,74%,49%)]/50 hover:bg-[hsl(43,74%,49%)] hover:text-black text-white rounded-full h-8 w-8 md:h-10 md:w-10 z-20"
            onClick={() => handleManualNav('next')}
          >
            <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
          </Button>

          {/* Dots Indicator */}
          <div className="flex justify-center gap-1.5 mt-4">
            {testimonialImages.map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex 
                    ? 'bg-[hsl(43,74%,49%)] w-5' 
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