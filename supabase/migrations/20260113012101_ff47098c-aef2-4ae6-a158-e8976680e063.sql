-- Create message templates table for WhatsApp messages
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  template_key VARCHAR(100) NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  template_content TEXT NOT NULL,
  description TEXT,
  available_variables TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, template_key)
);

-- Enable Row Level Security
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own message templates" 
ON public.message_templates 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own message templates" 
ON public.message_templates 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own message templates" 
ON public.message_templates 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own message templates" 
ON public.message_templates 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_message_templates_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();