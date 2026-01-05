import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PersonStanding, Loader2, ArrowLeft } from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'forgot-password';

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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
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
      } else {
        if (!formData.fullName.trim()) {
          toast({
            title: 'Nome obrigatório',
            description: 'Por favor, informe seu nome completo.',
            variant: 'destructive',
          });
          setIsSubmitting(false);
          return;
        }
        
        const { error } = await signUp(formData.email, formData.password, formData.fullName);
        if (error) {
          let message = 'Erro ao criar conta. Tente novamente.';
          if (error.message.includes('already registered')) {
            message = 'Este email já está cadastrado. Tente fazer login.';
          }
          toast({
            title: 'Erro no cadastro',
            description: message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Conta criada!',
            description: 'Você já pode acessar sua conta.',
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
      case 'login': return 'Entre na sua conta';
      case 'signup': return 'Crie sua conta';
      case 'forgot-password': return 'Recuperar senha';
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-xl">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60">
              <PersonStanding className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-card-foreground">RF Assessoria</h1>
            <p className="mt-2 text-muted-foreground">{getTitle()}</p>
          </div>

          {/* Back button for forgot password */}
          {mode === 'forgot-password' && (
            <button
              type="button"
              onClick={() => setMode('login')}
              className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para login
            </button>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-card-foreground">Nome Completo</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Seu nome"
                  required={mode === 'signup'}
                  className="bg-background border-input"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-card-foreground">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="seu@email.com"
                required
                className="bg-background border-input"
              />
            </div>

            {mode !== 'forgot-password' && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-card-foreground">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  minLength={6}
                  required
                  className="bg-background border-input"
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'login' && 'Entrar'}
              {mode === 'signup' && 'Criar Conta'}
              {mode === 'forgot-password' && 'Enviar Email'}
            </Button>
          </form>

          {/* Forgot password link */}
          {mode === 'login' && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setMode('forgot-password')}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Esqueceu sua senha?
              </button>
            </div>
          )}

          {/* Toggle login/signup */}
          {mode !== 'forgot-password' && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
