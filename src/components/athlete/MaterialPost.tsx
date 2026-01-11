import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FormattedText } from '@/lib/formatText';
import { LinkifiedText } from '@/lib/linkify';
import rogersProfile from '@/assets/rogers-profile.jpg';

interface MaterialPostProps {
  id: string;
  title: string;
  content: string | null;
  contentType: 'text' | 'youtube_video';
  youtubeUrl?: string | null;
}

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    let videoId = urlObj.searchParams.get('v');
    if (!videoId && urlObj.hostname === 'youtu.be') {
      videoId = urlObj.pathname.slice(1);
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch {
    return null;
  }
}

export function MaterialPost({ id, title, content, contentType, youtubeUrl }: MaterialPostProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full text-left">
          <div className="flex items-start gap-3 p-4 bg-gray-900 border border-gray-800 rounded-xl hover:bg-gray-800/70 transition-colors cursor-pointer">
            {/* Profile photo */}
            <div className="flex-shrink-0">
              <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-[hsl(43,74%,49%)]">
                <img 
                  src={rogersProfile} 
                  alt="Rogers Feitosa" 
                  className="w-full h-[200%] object-cover object-[center_15%]"
                />
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[hsl(43,74%,49%)]">Rogers Feitosa</span>
                <span className="text-gray-500 text-sm">@rogersfeitosa</span>
              </div>
              <h3 className="font-semibold text-white mt-1 pr-6">{title}</h3>
            </div>

            {/* Expand indicator */}
            <div className="flex-shrink-0 text-gray-500 mt-3">
              {isOpen ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </div>
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="bg-gray-900 border-x border-b border-gray-800 rounded-b-xl -mt-2 pt-2">
          {/* Twitter-style post content */}
          <div className="flex gap-3 p-4 pt-0">
            {/* Left line connector */}
            <div className="flex-shrink-0 w-12 flex justify-center">
              <div className="w-0.5 h-full bg-gray-700 rounded-full"></div>
            </div>
            
            {/* Post content */}
            <div className="flex-1 min-w-0">
              {contentType === 'text' ? (
                <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                  <FormattedText text={content || ''} />
                </div>
              ) : (
                <div className="aspect-video rounded-xl overflow-hidden mt-2">
                  <iframe 
                    src={getYouTubeEmbedUrl(youtubeUrl || '') || ''} 
                    className="w-full h-full" 
                    allowFullScreen 
                  />
                </div>
              )}
              
              {/* Twitter-style footer */}
              <div className="flex items-center gap-6 mt-4 text-gray-500 text-sm">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </span>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
