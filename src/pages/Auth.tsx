import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight, Check, Timer } from 'lucide-react';
import runnerHero from '@/assets/runner-hero.jpg';

type AuthMode = 'login' | 'forgot-password';

export default function Auth() {
  const { user, loading } = useAuth();
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  
  const [mode, setMode] = useState<AuthMode>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(43,74%,49%)]" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (mode === 'forgot-password') {
        const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        
        if (error) {
          toast({
            title: 'Erro',
            description: 'Não foi possível enviar o email de recuperação.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Email enviado!',
            description: 'Verifique sua caixa de entrada para redefinir sua senha.',
          });
          setMode('login');
        }
      } else if (mode === 'login') {
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          let message = 'Erro ao fazer login. Verifique suas credenciais.';
          if (error.message.includes('Invalid login credentials')) {
            message = 'Email ou senha incorretos.';
          }
          toast({
            title: 'Erro no login',
            description: message,
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro inesperado. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'login': return 'Acesse sua conta';
      case 'forgot-password': return 'Recuperar senha';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'login': return 'Entre para acessar seu acompanhamento personalizado';
      case 'forgot-password': return 'Enviaremos um link para redefinir sua senha';
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-gray-800">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/" className="font-bold text-lg text-[hsl(43,74%,49%)]">Rogers Feitosa</Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="pt-20 min-h-screen flex">
        {/* Left Side - Image and Benefits (hidden on mobile) */}
        <div className="hidden lg:flex lg:w-1/2 relative">
          <img 
            src={runnerHero} 
            alt="Corredor em ação" 
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent" />
          
          <div className="relative z-10 flex flex-col justify-center p-12 max-w-xl">
            <div className="inline-flex items-center gap-2 bg-[hsl(43,74%,49%)] text-black px-4 py-2 rounded-full text-sm font-bold mb-6 w-fit">
              <Timer className="w-4 h-4" />
              Área Exclusiva para Membros
            </div>
            
            <h1 className="text-3xl lg:text-4xl font-bold leading-tight mb-6">
              Transforme sua performance
            </h1>
            
            <div className="space-y-4">
              {[
                'Suporte exclusivo'
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-[hsl(43,74%,49%)] rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-black" />
                  </div>
                  <span className="text-gray-300">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side - Auth Form */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-gray-950">
          <div className="w-full max-w-md">
            {/* Mobile header */}
            <div className="lg:hidden mb-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(43,74%,49%)] to-[hsl(43,74%,35%)]">
                <span className="text-2xl font-bold text-black">RF</span>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl lg:text-3xl font-bold text-white mb-2">{getTitle()}</h2>
              <p className="text-gray-400">{getSubtitle()}</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="seu@email.com"
                  required
                  className="h-12 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 focus:border-[hsl(43,74%,49%)] focus:ring-[hsl(43,74%,49%)]"
                />
              </div>

              {mode !== 'forgot-password' && (
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    minLength={6}
                    required
                    className="h-12 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 focus:border-[hsl(43,74%,49%)] focus:ring-[hsl(43,74%,49%)]"
                  />
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-12 bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-black font-bold text-base" 
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'login' && 'Entrar'}
                {mode === 'forgot-password' && 'Enviar Email'}
                {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
                {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>


            {/* Forgot password link */}
            {mode === 'login' && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setMode('forgot-password')}
                  className="text-sm text-gray-400 hover:text-[hsl(43,74%,49%)] transition-colors"
                >
                  Esqueceu sua senha?
                </button>
              </div>
            )}

            {/* Back to login for forgot password */}
            {mode === 'forgot-password' && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-sm text-gray-400 hover:text-[hsl(43,74%,49%)] transition-colors"
                >
                  ← Voltar para login
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 bg-black border-t border-gray-800 text-gray-500 text-center text-xs">
        <p>© 2026 Rogers Feitosa. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
