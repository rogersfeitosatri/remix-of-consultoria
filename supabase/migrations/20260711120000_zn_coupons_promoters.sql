-- ZN Assessoria — cupons de desconto, criadores/divulgadores (afiliados) e
-- atribuição das assinaturas ao cupom/criador de origem (para ranking).

-- ---------- zn_promoters (criadores de conteúdo / divulgadores) ----------
CREATE TABLE IF NOT EXISTS public.zn_promoters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  handle text,                       -- @ / rede social
  contact text,                      -- email / whatsapp
  ref_code text,                     -- slug para link exclusivo (?ref=)
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ref_code)
);
CREATE INDEX IF NOT EXISTS idx_zn_promoters_user ON public.zn_promoters(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zn_promoters TO authenticated;
GRANT ALL ON public.zn_promoters TO service_role;
ALTER TABLE public.zn_promoters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "zn_promoters owner all" ON public.zn_promoters;
CREATE POLICY "zn_promoters owner all"
  ON public.zn_promoters FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------- zn_coupons ----------
-- discount_type:
--   'percent'      -> percent_off (%) aplicado ao valor do plano
--   'free_months'  -> free_months meses grátis antes da 1ª cobrança
-- applies_to (só para percent): 'first' (só 1ª cobrança) | 'all' (recorrente)
CREATE TABLE IF NOT EXISTS public.zn_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text,
  promoter_id uuid REFERENCES public.zn_promoters(id) ON DELETE SET NULL,
  discount_type text NOT NULL DEFAULT 'percent'
    CHECK (discount_type IN ('percent', 'free_months')),
  percent_off numeric(5,2) DEFAULT 0 CHECK (percent_off >= 0 AND percent_off <= 100),
  free_months integer DEFAULT 0 CHECK (free_months >= 0 AND free_months <= 12),
  applies_to text NOT NULL DEFAULT 'all' CHECK (applies_to IN ('first', 'all')),
  max_uses integer,                  -- null = ilimitado
  uses_count integer NOT NULL DEFAULT 0,
  valid_from date,
  valid_until date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);
CREATE INDEX IF NOT EXISTS idx_zn_coupons_user ON public.zn_coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_zn_coupons_code ON public.zn_coupons(lower(code));
CREATE INDEX IF NOT EXISTS idx_zn_coupons_promoter ON public.zn_coupons(promoter_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zn_coupons TO authenticated;
GRANT ALL ON public.zn_coupons TO service_role;
ALTER TABLE public.zn_coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "zn_coupons owner all" ON public.zn_coupons;
CREATE POLICY "zn_coupons owner all"
  ON public.zn_coupons FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------- zn_coupon_redemptions (auditoria de uso) ----------
CREATE TABLE IF NOT EXISTS public.zn_coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coupon_id uuid REFERENCES public.zn_coupons(id) ON DELETE SET NULL,
  promoter_id uuid REFERENCES public.zn_promoters(id) ON DELETE SET NULL,
  athlete_id uuid REFERENCES public.zn_athletes(id) ON DELETE SET NULL,
  code text,
  discount_type text,
  amount_off numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_zn_redemptions_user ON public.zn_coupon_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_zn_redemptions_coupon ON public.zn_coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_zn_redemptions_promoter ON public.zn_coupon_redemptions(promoter_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zn_coupon_redemptions TO authenticated;
GRANT ALL ON public.zn_coupon_redemptions TO service_role;
ALTER TABLE public.zn_coupon_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "zn_redemptions owner all" ON public.zn_coupon_redemptions;
CREATE POLICY "zn_redemptions owner all"
  ON public.zn_coupon_redemptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------- Atribuição nas tabelas existentes ----------
ALTER TABLE public.zn_athletes
  ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.zn_coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promoter_id uuid REFERENCES public.zn_promoters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code text;

ALTER TABLE public.zn_subscriptions
  ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.zn_coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promoter_id uuid REFERENCES public.zn_promoters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_zn_athletes_promoter ON public.zn_athletes(promoter_id);
CREATE INDEX IF NOT EXISTS idx_zn_subs_promoter ON public.zn_subscriptions(promoter_id);

-- ---------- updated_at triggers (reaproveita update_updated_at_column) ----------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS trg_zn_promoters_updated ON public.zn_promoters;
    CREATE TRIGGER trg_zn_promoters_updated BEFORE UPDATE ON public.zn_promoters
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    DROP TRIGGER IF EXISTS trg_zn_coupons_updated ON public.zn_coupons;
    CREATE TRIGGER trg_zn_coupons_updated BEFORE UPDATE ON public.zn_coupons
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Força o PostgREST a recarregar o cache de schema (evita
-- "Could not find the table ... in the schema cache" logo após aplicar).
NOTIFY pgrst, 'reload schema';
