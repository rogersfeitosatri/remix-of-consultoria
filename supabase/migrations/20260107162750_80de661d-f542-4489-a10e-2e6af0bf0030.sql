-- Create link_bio_items table for managing bio links
CREATE TABLE public.link_bio_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  link_url TEXT,
  image_url TEXT,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.link_bio_items ENABLE ROW LEVEL SECURITY;

-- Policies for admin to manage their links
CREATE POLICY "Users can view their own link bio items"
  ON public.link_bio_items
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own link bio items"
  ON public.link_bio_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own link bio items"
  ON public.link_bio_items
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own link bio items"
  ON public.link_bio_items
  FOR DELETE
  USING (auth.uid() = user_id);

-- Public can view active link bio items (for the public link bio page)
CREATE POLICY "Anyone can view active link bio items"
  ON public.link_bio_items
  FOR SELECT
  USING (is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_link_bio_items_updated_at
  BEFORE UPDATE ON public.link_bio_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();