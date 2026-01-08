import { ExternalLink } from 'lucide-react';
import { usePublicLinkBioItems } from '@/hooks/useLinkBio';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import rogersProfile from '@/assets/rogers-profile.jpg';

export default function LinkBio() {
  const { data: items = [], isLoading } = usePublicLinkBioItems();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(43,74%,49%)]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="pt-8 pb-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-[hsl(43,74%,49%)]">
            <img 
              src={rogersProfile} 
              alt="Rogers Feitosa" 
              className="w-full h-full object-cover object-top scale-150"
            />
          </div>
        </div>
        <h1 className="text-xl font-bold text-[hsl(43,74%,49%)]">ROGERS FEITOSA</h1>
        <p className="text-gray-400 text-sm">Nutrição e Treinamento</p>
      </header>

      {/* Links */}
      <main className="max-w-lg mx-auto px-4 pb-12 space-y-4">
        {items.length === 0 ? (
          <p className="text-center text-gray-400 py-8">Nenhum link disponível</p>
        ) : (
          items.map((item) => (
            <a
              key={item.id}
              href={item.link_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full"
            >
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-[hsl(43,74%,49%)]/50 hover:bg-gray-800 transition-all duration-300 group">
                <div className="flex items-center gap-4">
                  {item.image_url && (
                    <img 
                      src={item.image_url} 
                      alt={item.title}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-bold text-white group-hover:text-[hsl(43,74%,49%)] transition-colors">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-sm text-gray-400 mt-1">{item.description}</p>
                    )}
                  </div>
                  <ExternalLink className="h-5 w-5 text-gray-500 group-hover:text-[hsl(43,74%,49%)] transition-colors" />
                </div>
              </div>
            </a>
          ))
        )}

        {/* Login Button */}
        <div className="pt-6">
          <Link to="/auth">
            <Button className="w-full bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-black font-semibold">
              Área do Membro / Entrar
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-gray-500 text-sm">
        <p>© 2026 Rogers Feitosa. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
