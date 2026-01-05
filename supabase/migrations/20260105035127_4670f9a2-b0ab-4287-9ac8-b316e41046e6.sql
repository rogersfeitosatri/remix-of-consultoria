-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'athlete');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Link clients to athlete users (optional auth account)
ALTER TABLE public.clients ADD COLUMN athlete_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create checkin_forms table
CREATE TABLE public.checkin_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.checkin_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own forms"
ON public.checkin_forms FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own forms"
ON public.checkin_forms FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own forms"
ON public.checkin_forms FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own forms"
ON public.checkin_forms FOR DELETE
USING (auth.uid() = user_id);

-- Create checkin_questions table
CREATE TABLE public.checkin_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID REFERENCES public.checkin_forms(id) ON DELETE CASCADE NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('short_text', 'long_text', 'multiple_choice', 'checkbox', 'scale')),
    options JSONB,
    scale_min INTEGER DEFAULT 1,
    scale_max INTEGER DEFAULT 10,
    is_required BOOLEAN DEFAULT false,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.checkin_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view questions of their forms"
ON public.checkin_questions FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.checkin_forms 
    WHERE id = form_id AND user_id = auth.uid()
));

CREATE POLICY "Users can insert questions to their forms"
ON public.checkin_questions FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM public.checkin_forms 
    WHERE id = form_id AND user_id = auth.uid()
));

CREATE POLICY "Users can update questions of their forms"
ON public.checkin_questions FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM public.checkin_forms 
    WHERE id = form_id AND user_id = auth.uid()
));

CREATE POLICY "Users can delete questions of their forms"
ON public.checkin_questions FOR DELETE
USING (EXISTS (
    SELECT 1 FROM public.checkin_forms 
    WHERE id = form_id AND user_id = auth.uid()
));

-- Public access for form submission
CREATE POLICY "Anyone can view active forms"
ON public.checkin_forms FOR SELECT
USING (is_active = true);

CREATE POLICY "Anyone can view questions of active forms"
ON public.checkin_questions FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.checkin_forms 
    WHERE id = form_id AND is_active = true
));

-- Create checkin_responses table
CREATE TABLE public.checkin_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID REFERENCES public.checkin_forms(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    responses JSONB NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.checkin_responses ENABLE ROW LEVEL SECURITY;

-- Admins can view responses
CREATE POLICY "Form owners can view responses"
ON public.checkin_responses FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.checkin_forms 
    WHERE id = form_id AND user_id = auth.uid()
));

-- Athletes can view their own responses
CREATE POLICY "Athletes can view their own responses"
ON public.checkin_responses FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE id = client_id AND athlete_user_id = auth.uid()
));

-- Anyone can insert responses (public form submission)
CREATE POLICY "Anyone can submit responses"
ON public.checkin_responses FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM public.checkin_forms 
    WHERE id = form_id AND is_active = true
));

-- Add trigger for updated_at on checkin_forms
CREATE TRIGGER update_checkin_forms_updated_at
BEFORE UPDATE ON public.checkin_forms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to automatically assign admin role to first user (existing consultants)
-- And athlete role when client account is created
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- By default, new signups that have a matching client record become athletes
    -- Otherwise they become admins (consultants)
    IF EXISTS (SELECT 1 FROM public.clients WHERE email = NEW.email) THEN
        INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'athlete');
        -- Link the client to this user
        UPDATE public.clients SET athlete_user_id = NEW.id WHERE email = NEW.email;
    ELSE
        INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger to assign role on user creation
CREATE TRIGGER on_auth_user_created_assign_role
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.assign_default_role();