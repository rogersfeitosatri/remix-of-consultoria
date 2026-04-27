import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, MailMinus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type State =
  | { kind: 'loading' }
  | { kind: 'invalid'; message: string }
  | { kind: 'already' }
  | { kind: 'ready' }
  | { kind: 'submitting' }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    if (!token) {
      setState({ kind: 'invalid', message: 'Missing unsubscribe token.' });
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } },
        );
        const data = await res.json();
        if (!res.ok) {
          setState({ kind: 'invalid', message: data.error || 'Invalid or expired link.' });
          return;
        }
        if (data.valid === false && data.reason === 'already_unsubscribed') {
          setState({ kind: 'already' });
          return;
        }
        if (data.valid === true) {
          setState({ kind: 'ready' });
          return;
        }
        setState({ kind: 'invalid', message: 'Invalid response.' });
      } catch (e: any) {
        setState({ kind: 'error', message: e?.message || 'Network error' });
      }
    })();
  }, [token]);

  const onConfirm = async () => {
    if (!token) return;
    setState({ kind: 'submitting' });
    const { data, error } = await supabase.functions.invoke('handle-email-unsubscribe', {
      body: { token },
    });
    if (error) {
      setState({ kind: 'error', message: error.message });
      return;
    }
    if (data?.success) {
      setState({ kind: 'done' });
    } else if (data?.reason === 'already_unsubscribed') {
      setState({ kind: 'already' });
    } else {
      setState({ kind: 'error', message: 'Could not process unsubscribe.' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <MailMinus className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle>Email preferences</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {state.kind === 'loading' && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Validating link…
            </div>
          )}
          {state.kind === 'invalid' && (
            <div className="space-y-2">
              <XCircle className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-sm text-muted-foreground">{state.message}</p>
            </div>
          )}
          {state.kind === 'already' && (
            <div className="space-y-2">
              <CheckCircle2 className="h-8 w-8 text-primary mx-auto" />
              <p className="text-sm">You are already unsubscribed.</p>
            </div>
          )}
          {state.kind === 'ready' && (
            <>
              <p className="text-sm text-muted-foreground">
                Click below to stop receiving emails from us.
              </p>
              <Button onClick={onConfirm} className="w-full">
                Confirm unsubscribe
              </Button>
            </>
          )}
          {state.kind === 'submitting' && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Processing…
            </div>
          )}
          {state.kind === 'done' && (
            <div className="space-y-2">
              <CheckCircle2 className="h-8 w-8 text-primary mx-auto" />
              <p className="text-sm">You have been unsubscribed. Sorry to see you go!</p>
            </div>
          )}
          {state.kind === 'error' && (
            <div className="space-y-2">
              <XCircle className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-sm text-muted-foreground">{state.message}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
