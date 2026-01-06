CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'athlete'
);


--
-- Name: assign_default_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_default_role() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (new.id, new.raw_user_meta_data ->> 'full_name', new.email);
  RETURN new;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: checkin_forms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkin_forms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: checkin_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkin_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_id uuid NOT NULL,
    question_text text NOT NULL,
    question_type text NOT NULL,
    options jsonb,
    scale_min integer DEFAULT 1,
    scale_max integer DEFAULT 10,
    is_required boolean DEFAULT false,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    has_comment_field boolean DEFAULT false NOT NULL,
    comment_field_label text DEFAULT 'Se quiser explicar melhor, comente aqui'::text,
    comment_field_required boolean DEFAULT false NOT NULL,
    comment_field_type text DEFAULT 'short'::text,
    CONSTRAINT checkin_questions_comment_field_type_check CHECK ((comment_field_type = ANY (ARRAY['short'::text, 'medium'::text]))),
    CONSTRAINT checkin_questions_question_type_check CHECK ((question_type = ANY (ARRAY['short_text'::text, 'long_text'::text, 'multiple_choice'::text, 'checkbox'::text, 'scale'::text])))
);


--
-- Name: checkin_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkin_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_id uuid NOT NULL,
    client_id uuid NOT NULL,
    responses jsonb NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    service_type text NOT NULL,
    plan_type text NOT NULL,
    checkin_frequency text,
    has_checkin boolean DEFAULT false NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    monthly_value numeric(10,2) NOT NULL,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    plan_duration text DEFAULT 'monthly'::text,
    has_consultations boolean DEFAULT false,
    consultation_count integer DEFAULT 0,
    consultation_frequency text,
    first_consultation_date date,
    payment_type text DEFAULT 'pix'::text,
    payment_date date,
    athlete_user_id uuid,
    CONSTRAINT clients_checkin_frequency_check CHECK ((checkin_frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'biweekly'::text, 'monthly'::text, 'bimonthly'::text, 'quarterly'::text]))),
    CONSTRAINT clients_plan_type_check CHECK ((plan_type = ANY (ARRAY['consultoria'::text, 'premium'::text]))),
    CONSTRAINT clients_service_type_check CHECK ((service_type = ANY (ARRAY['nutrition'::text, 'training'::text, 'both'::text])))
);


--
-- Name: consultation_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consultation_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid NOT NULL,
    scheduled_date date NOT NULL,
    send_link_date date NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    due_date date NOT NULL,
    amount numeric(10,2) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'overdue'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: checkin_forms checkin_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkin_forms
    ADD CONSTRAINT checkin_forms_pkey PRIMARY KEY (id);


--
-- Name: checkin_questions checkin_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkin_questions
    ADD CONSTRAINT checkin_questions_pkey PRIMARY KEY (id);


--
-- Name: checkin_responses checkin_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkin_responses
    ADD CONSTRAINT checkin_responses_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: consultation_schedules consultation_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultation_schedules
    ADD CONSTRAINT consultation_schedules_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: checkin_forms update_checkin_forms_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_checkin_forms_updated_at BEFORE UPDATE ON public.checkin_forms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: clients update_clients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: consultation_schedules update_consultation_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_consultation_schedules_updated_at BEFORE UPDATE ON public.consultation_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payments update_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: checkin_questions checkin_questions_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkin_questions
    ADD CONSTRAINT checkin_questions_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.checkin_forms(id) ON DELETE CASCADE;


--
-- Name: checkin_responses checkin_responses_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkin_responses
    ADD CONSTRAINT checkin_responses_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: checkin_responses checkin_responses_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkin_responses
    ADD CONSTRAINT checkin_responses_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.checkin_forms(id) ON DELETE CASCADE;


--
-- Name: clients clients_athlete_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_athlete_user_id_fkey FOREIGN KEY (athlete_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: clients clients_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: consultation_schedules consultation_schedules_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultation_schedules
    ADD CONSTRAINT consultation_schedules_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: payments payments_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: payments payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can update roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: checkin_responses Anyone can submit responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can submit responses" ON public.checkin_responses FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.checkin_forms
  WHERE ((checkin_forms.id = checkin_responses.form_id) AND (checkin_forms.is_active = true)))));


--
-- Name: checkin_forms Anyone can view active forms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active forms" ON public.checkin_forms FOR SELECT USING ((is_active = true));


--
-- Name: checkin_questions Anyone can view questions of active forms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view questions of active forms" ON public.checkin_questions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.checkin_forms
  WHERE ((checkin_forms.id = checkin_questions.form_id) AND (checkin_forms.is_active = true)))));


--
-- Name: checkin_responses Athletes can view their own responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Athletes can view their own responses" ON public.checkin_responses FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.clients
  WHERE ((clients.id = checkin_responses.client_id) AND (clients.athlete_user_id = auth.uid())))));


--
-- Name: checkin_responses Form owners can view responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Form owners can view responses" ON public.checkin_responses FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.checkin_forms
  WHERE ((checkin_forms.id = checkin_responses.form_id) AND (checkin_forms.user_id = auth.uid())))));


--
-- Name: checkin_questions Users can delete questions of their forms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete questions of their forms" ON public.checkin_questions FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.checkin_forms
  WHERE ((checkin_forms.id = checkin_questions.form_id) AND (checkin_forms.user_id = auth.uid())))));


--
-- Name: clients Users can delete their own clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own clients" ON public.clients FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: consultation_schedules Users can delete their own consultation schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own consultation schedules" ON public.consultation_schedules FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: checkin_forms Users can delete their own forms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own forms" ON public.checkin_forms FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: payments Users can delete their own payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own payments" ON public.payments FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: checkin_questions Users can insert questions to their forms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert questions to their forms" ON public.checkin_questions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.checkin_forms
  WHERE ((checkin_forms.id = checkin_questions.form_id) AND (checkin_forms.user_id = auth.uid())))));


--
-- Name: clients Users can insert their own clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own clients" ON public.clients FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: consultation_schedules Users can insert their own consultation schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own consultation schedules" ON public.consultation_schedules FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: checkin_forms Users can insert their own forms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own forms" ON public.checkin_forms FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: payments Users can insert their own payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own payments" ON public.payments FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: checkin_questions Users can update questions of their forms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update questions of their forms" ON public.checkin_questions FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.checkin_forms
  WHERE ((checkin_forms.id = checkin_questions.form_id) AND (checkin_forms.user_id = auth.uid())))));


--
-- Name: clients Users can update their own clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own clients" ON public.clients FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: consultation_schedules Users can update their own consultation schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own consultation schedules" ON public.consultation_schedules FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: checkin_forms Users can update their own forms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own forms" ON public.checkin_forms FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: payments Users can update their own payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own payments" ON public.payments FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: checkin_questions Users can view questions of their forms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view questions of their forms" ON public.checkin_questions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.checkin_forms
  WHERE ((checkin_forms.id = checkin_questions.form_id) AND (checkin_forms.user_id = auth.uid())))));


--
-- Name: clients Users can view their own clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own clients" ON public.clients FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: consultation_schedules Users can view their own consultation schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own consultation schedules" ON public.consultation_schedules FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: checkin_forms Users can view their own forms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own forms" ON public.checkin_forms FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: payments Users can view their own payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own payments" ON public.payments FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: checkin_forms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checkin_forms ENABLE ROW LEVEL SECURITY;

--
-- Name: checkin_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checkin_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: checkin_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checkin_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: consultation_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consultation_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;