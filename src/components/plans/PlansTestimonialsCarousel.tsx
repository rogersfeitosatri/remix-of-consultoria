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

export default function PlansTestimonialsCarousel() {
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
    <section className="py-16 md:py-24 bg-black">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Quote className="w-6 h-6 md:w-8 md:h-8 text-white" />
        </div>
        <h2 className="text-2xl md:text-4xl font-bold text-center text-white mb-3">
          O que dizem os atletas
        </h2>
        <p className="text-gray-400 text-center mb-10 md:mb-14 max-w-xl mx-auto">
          Resultados reais de atletas que transformaram sua performance com acompanhamento nutricional especializado
        </p>
        
        <div className="relative w-full max-w-sm sm:max-w-md mx-auto flex flex-col items-center">
          {/* Main Carousel Container */}
          <div className="relative overflow-hidden rounded-2xl bg-zinc-900 p-3 w-full border border-zinc-800">
            <div className="relative aspect-[9/16] w-full max-h-[450px] sm:max-h-[500px] flex items-center justify-center rounded-xl bg-zinc-800/50 p-2">
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
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Buttons */}
          <Button
            variant="outline"
            size="icon"
            className="absolute left-0 sm:-left-6 md:-left-14 top-1/2 -translate-y-1/2 bg-zinc-900 border-zinc-700 hover:bg-white hover:text-black text-white rounded-full h-10 w-10 md:h-12 md:w-12 z-20 transition-all"
            onClick={() => handleManualNav('prev')}
          >
            <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-0 sm:-right-6 md:-right-14 top-1/2 -translate-y-1/2 bg-zinc-900 border-zinc-700 hover:bg-white hover:text-black text-white rounded-full h-10 w-10 md:h-12 md:w-12 z-20 transition-all"
            onClick={() => handleManualNav('next')}
          >
            <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
          </Button>

          {/* Dots Indicator */}
          <div className="flex justify-center gap-2 mt-6">
            {testimonialImages.map((_, index) => (
              <button
                key={index}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex 
                    ? 'bg-white w-6' 
                    : 'bg-zinc-600 hover:bg-zinc-500 w-2'
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
